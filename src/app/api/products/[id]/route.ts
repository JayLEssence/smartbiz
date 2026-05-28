import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { authenticateRequest, isManagerOrAbove } from '@/lib/auth'
import { safeValidate, productUpdateSchema, sanitizeString } from '@/lib/validation'
import { logAudit, getRequestInfo } from '@/lib/audit-log'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Authentication required' },
        { status: 401 }
      )
    }

    const { id } = await params
    const product = await db.product.findUnique({ where: { id } })

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    // Tenant isolation: verify product belongs to user's company
    if (product.companyId !== auth.user.companyId) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    // Employees and managers can only see products from their own branch
    if (auth.user.role !== 'CompanyAdmin' && product.branchId !== auth.user.branchId) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: product })
  } catch (error) {
    console.error('Product GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const body = await request.json()

    // Sanitize string inputs
    const sanitizedBody = {
      id,
      name: body.name !== undefined ? sanitizeString(String(body.name)) : body.name,
      sku: body.sku !== undefined ? sanitizeString(String(body.sku)) : body.sku,
      barcode: body.barcode !== undefined ? (body.barcode ? sanitizeString(String(body.barcode)) : body.barcode) : body.barcode,
      category: body.category !== undefined ? sanitizeString(String(body.category)) : body.category,
      reorderThreshold: body.reorderThreshold,
      defaultSalePrice: body.defaultSalePrice,
      isActive: body.isActive,
    }

    // Validate input with Zod schema
    const validation = safeValidate(productUpdateSchema, sanitizedBody)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.errors },
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
    console.error('Product PUT error:', error)
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params

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
      data: {
        product,
        trending,
      },
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
    console.error('Product DELETE error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
