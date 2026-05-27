import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { authenticateRequest, isManagerOrAbove } from '@/lib/auth'
import { safeValidate, productCreateSchema, productUpdateSchema, sanitizeString } from '@/lib/validation'
import { logAudit, getRequestInfo } from '@/lib/audit-log'

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const category = searchParams.get('category')
    const lowStock = searchParams.get('lowStock') === 'true'
    const branchId = searchParams.get('branchId')
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const where: Prisma.ProductWhereInput = {}

    // Tenant isolation: always filter by authenticated user's companyId
    where.companyId = auth.user.companyId

    // For employees and managers, restrict to their own branch unless they are admin
    if (auth.user.role !== 'CompanyAdmin') {
      // Employees and managers can only see their branch's products
      // But managers can optionally request other branches within the company
      if (branchId && branchId !== auth.user.branchId) {
        // Non-admin trying to access another branch - deny
        return NextResponse.json(
          { success: false, error: 'You can only view products for your assigned branch' },
          { status: 403 }
        )
      }
      where.branchId = auth.user.branchId
    } else {
      // Admin can filter by any branch within their company
      if (branchId) {
        where.branchId = branchId
      }
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
        { barcode: { contains: search } },
      ]
    }

    if (category) {
      where.category = category
    }

    if (!includeInactive) {
      where.isActive = true
    }

    const products = await db.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    // If lowStock is true, filter in-memory since Prisma SQLite doesn't support
    // comparing two fields directly in a simple way
    let result = products
    if (lowStock) {
      result = products.filter(
        (p) => p.currentStockLevel <= p.reorderThreshold
      )
    }

    // Calculate trending for each product
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    const productIds = result.map((p) => p.id)

    // Build sale filter with companyId from auth
    const saleFilterBase: Prisma.SaleWhereInput = {
      companyId: auth.user.companyId,
    }
    if (auth.user.role !== 'CompanyAdmin') {
      saleFilterBase.branchId = auth.user.branchId
    } else if (branchId) {
      saleFilterBase.branchId = branchId
    }

    // Get sale items for last 7 days
    const recentSaleItems = await db.saleItem.findMany({
      where: {
        productId: { in: productIds },
        sale: {
          saleDate: { gte: sevenDaysAgo },
          ...saleFilterBase,
        },
      },
    })

    // Get sale items for previous 7 days (7-14 days ago)
    const previousSaleItems = await db.saleItem.findMany({
      where: {
        productId: { in: productIds },
        sale: {
          saleDate: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
          ...saleFilterBase,
        },
      },
    })

    // Aggregate by product
    const recentSalesMap: Record<string, number> = {}
    for (const item of recentSaleItems) {
      recentSalesMap[item.productId] = (recentSalesMap[item.productId] || 0) + item.quantitySold
    }

    const previousSalesMap: Record<string, number> = {}
    for (const item of previousSaleItems) {
      previousSalesMap[item.productId] = (previousSalesMap[item.productId] || 0) + item.quantitySold
    }

    // Add trending field to each product
    const resultWithTrending = result.map((product) => {
      const recentQty = recentSalesMap[product.id] || 0
      const previousQty = previousSalesMap[product.id] || 0

      let trending: 'up' | 'down' | 'stable' | 'new' | 'no-sales' = 'no-sales'
      if (recentQty > 0 && previousQty === 0) {
        trending = 'new'
      } else if (recentQty > 0 && previousQty > 0) {
        if (recentQty > previousQty) trending = 'up'
        else if (recentQty < previousQty) trending = 'down'
        else trending = 'stable'
      } else if (recentQty === 0 && previousQty > 0) {
        trending = 'down'
      }

      return {
        ...product,
        trending,
        recentSalesQty: recentQty,
        previousSalesQty: previousQty,
      }
    })

    return NextResponse.json({ success: true, data: resultWithTrending })
  } catch (error) {
    console.error('Products GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Authentication required' },
        { status: 401 }
      )
    }

    if (!isManagerOrAbove(auth.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Only managers and admins can create products' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, sku, barcode, category, currentStockLevel, reorderThreshold, defaultSalePrice, branchId } = body

    // NEVER trust companyId from request - always use auth.user.companyId
    const companyId = auth.user.companyId

    // Validate input with Zod schema
    const validation = safeValidate(productCreateSchema, {
      name: name ? sanitizeString(String(name)) : name,
      sku: sku ? sanitizeString(String(sku)) : sku,
      barcode: barcode ? sanitizeString(String(barcode)) : barcode,
      category: category ? sanitizeString(String(category)) : category,
      currentStockLevel,
      reorderThreshold,
      defaultSalePrice,
      branchId,
      companyId,
    })

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.errors },
        { status: 400 }
      )
    }

    const validatedData = validation.data

    // Non-admin users can only create products in their own branch
    if (auth.user.role !== 'CompanyAdmin' && validatedData.branchId !== auth.user.branchId) {
      return NextResponse.json(
        { success: false, error: 'You can only create products for your assigned branch' },
        { status: 403 }
      )
    }

    // Validate branch belongs to the same company
    const branch = await db.branch.findUnique({ where: { id: validatedData.branchId } })
    if (!branch) {
      return NextResponse.json(
        { success: false, error: 'Branch not found' },
        { status: 404 }
      )
    }
    if (branch.companyId !== companyId) {
      return NextResponse.json(
        { success: false, error: 'Branch does not belong to your company' },
        { status: 400 }
      )
    }

    const product = await db.product.create({
      data: {
        name: validatedData.name,
        sku: validatedData.sku,
        barcode: validatedData.barcode || null,
        category: validatedData.category,
        currentStockLevel: validatedData.currentStockLevel,
        reorderThreshold: validatedData.reorderThreshold,
        defaultSalePrice: validatedData.defaultSalePrice,
        branchId: validatedData.branchId,
        companyId,
      },
    })

    // Audit log
    const reqInfo = getRequestInfo(request)
    logAudit({
      action: 'PRODUCT_CREATED',
      userId: auth.user.id,
      userEmail: auth.user.email,
      companyId: auth.user.companyId,
      branchId: validatedData.branchId,
      details: `Product "${validatedData.name}" (SKU: ${validatedData.sku}) created`,
      ...reqInfo,
    })

    return NextResponse.json({ success: true, data: product }, { status: 201 })
  } catch (error) {
    console.error('Products POST error:', error)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'A product with this SKU already exists in this branch' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Authentication required' },
        { status: 401 }
      )
    }

    if (!isManagerOrAbove(auth.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Only managers and admins can update products' },
        { status: 403 }
      )
    }

    const body = await request.json()

    // Validate input with Zod schema
    const sanitizedBody = {
      ...body,
      name: body.name !== undefined ? sanitizeString(String(body.name)) : body.name,
      sku: body.sku !== undefined ? sanitizeString(String(body.sku)) : body.sku,
      barcode: body.barcode !== undefined ? (body.barcode ? sanitizeString(String(body.barcode)) : body.barcode) : body.barcode,
      category: body.category !== undefined ? sanitizeString(String(body.category)) : body.category,
    }

    const validation = safeValidate(productUpdateSchema, sanitizedBody)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.errors },
        { status: 400 }
      )
    }

    const { id } = validation.data

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: id' },
        { status: 400 }
      )
    }

    const existing = await db.product.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    // Verify product belongs to user's company (tenant isolation)
    if (existing.companyId !== auth.user.companyId) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    // Non-admin users can only update products in their own branch
    if (auth.user.role !== 'CompanyAdmin' && existing.branchId !== auth.user.branchId) {
      return NextResponse.json(
        { success: false, error: 'You can only update products in your assigned branch' },
        { status: 403 }
      )
    }

    const updateData: {
      name?: string
      sku?: string
      barcode?: string | null
      category?: string
      reorderThreshold?: number
      defaultSalePrice?: number
      isActive?: boolean
    } = {}
    if (validation.data.name !== undefined) updateData.name = validation.data.name
    if (validation.data.sku !== undefined) updateData.sku = validation.data.sku
    if (validation.data.barcode !== undefined) updateData.barcode = validation.data.barcode
    if (validation.data.category !== undefined) updateData.category = validation.data.category
    if (validation.data.reorderThreshold !== undefined) updateData.reorderThreshold = validation.data.reorderThreshold
    if (validation.data.defaultSalePrice !== undefined) updateData.defaultSalePrice = validation.data.defaultSalePrice
    if (validation.data.isActive !== undefined) updateData.isActive = validation.data.isActive

    const product = await db.product.update({
      where: { id },
      data: updateData,
    })

    // Audit log
    const reqInfo = getRequestInfo(request)
    logAudit({
      action: 'PRODUCT_UPDATED',
      userId: auth.user.id,
      userEmail: auth.user.email,
      companyId: auth.user.companyId,
      branchId: existing.branchId,
      details: `Product "${existing.name}" (ID: ${id}) updated`,
      ...reqInfo,
    })

    return NextResponse.json({ success: true, data: product })
  } catch (error) {
    console.error('Products PUT error:', error)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'A product with this SKU already exists in this branch' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Authentication required' },
        { status: 401 }
      )
    }

    if (!isManagerOrAbove(auth.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Only managers and admins can delete products' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing required query param: id' },
        { status: 400 }
      )
    }

    const existing = await db.product.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    // Verify product belongs to user's company (tenant isolation)
    if (existing.companyId !== auth.user.companyId) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    // Non-admin users can only delete products in their own branch
    if (auth.user.role !== 'CompanyAdmin' && existing.branchId !== auth.user.branchId) {
      return NextResponse.json(
        { success: false, error: 'You can only delete products in your assigned branch' },
        { status: 403 }
      )
    }

    // Calculate trending before soft-delete
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    const recentSales = await db.saleItem.findMany({
      where: {
        productId: id,
        sale: { saleDate: { gte: sevenDaysAgo } },
      },
    })
    const previousSales = await db.saleItem.findMany({
      where: {
        productId: id,
        sale: { saleDate: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
      },
    })

    const recentQty = recentSales.reduce((sum, item) => sum + item.quantitySold, 0)
    const previousQty = previousSales.reduce((sum, item) => sum + item.quantitySold, 0)

    let trending: 'up' | 'down' | 'stable' | 'new' | 'no-sales' = 'no-sales'
    if (recentQty > 0 && previousQty === 0) {
      trending = 'new'
    } else if (recentQty > 0 && previousQty > 0) {
      if (recentQty > previousQty) trending = 'up'
      else if (recentQty < previousQty) trending = 'down'
      else trending = 'stable'
    } else if (recentQty === 0 && previousQty > 0) {
      trending = 'down'
    }

    const isBadTrending = trending === 'down' || trending === 'no-sales'

    // Soft delete - set isActive to false
    const product = await db.product.update({
      where: { id },
      data: { isActive: false },
    })

    // Audit log
    const reqInfo = getRequestInfo(request)
    logAudit({
      action: 'PRODUCT_DELETED',
      userId: auth.user.id,
      userEmail: auth.user.email,
      companyId: auth.user.companyId,
      branchId: existing.branchId,
      details: `Product "${existing.name}" (SKU: ${existing.sku}) deactivated (soft delete)`,
      ...reqInfo,
    })

    return NextResponse.json({
      success: true,
      data: product,
      trendingInfo: {
        trending,
        recentSalesQty: recentQty,
        previousSalesQty: previousQty,
        isBadTrending,
      },
      message: isBadTrending
        ? 'Product deactivated. Sales have been declining or non-existent.'
        : 'Product deactivated. Note: this product has positive or stable sales trends.',
    })
  } catch (error) {
    console.error('Products DELETE error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
