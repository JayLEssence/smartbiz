import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const category = searchParams.get('category')
    const lowStock = searchParams.get('lowStock') === 'true'
    const branchId = searchParams.get('branchId')
    const companyId = searchParams.get('companyId')
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const where: Prisma.ProductWhereInput = {}

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

    if (branchId) {
      where.branchId = branchId
    }

    if (companyId) {
      where.companyId = companyId
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

    // Build sale filter with companyId support
    const saleFilterBase: Prisma.SaleWhereInput = {}
    if (branchId) saleFilterBase.branchId = branchId
    if (companyId) saleFilterBase.companyId = companyId

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
    const body = await request.json()
    const { name, sku, barcode, category, currentStockLevel, reorderThreshold, defaultSalePrice, branchId, companyId } = body

    if (!name || !sku || !category || currentStockLevel === undefined || reorderThreshold === undefined || defaultSalePrice === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, sku, category, currentStockLevel, reorderThreshold, defaultSalePrice' },
        { status: 400 }
      )
    }

    if (!branchId) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: branchId' },
        { status: 400 }
      )
    }

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: companyId' },
        { status: 400 }
      )
    }

    // Validate branch belongs to the same company
    const branch = await db.branch.findUnique({ where: { id: branchId } })
    if (!branch) {
      return NextResponse.json(
        { success: false, error: 'Branch not found' },
        { status: 404 }
      )
    }
    if (branch.companyId !== companyId) {
      return NextResponse.json(
        { success: false, error: 'Branch does not belong to the specified company' },
        { status: 400 }
      )
    }

    const product = await db.product.create({
      data: {
        name,
        sku,
        barcode: barcode || null,
        category,
        currentStockLevel: Number(currentStockLevel),
        reorderThreshold: Number(reorderThreshold),
        defaultSalePrice: Number(defaultSalePrice),
        branchId,
        companyId,
      },
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
    const body = await request.json()
    const { id, name, sku, barcode, category, reorderThreshold, defaultSalePrice } = body

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

    const updateData: {
      name?: string
      sku?: string
      barcode?: string | null
      category?: string
      reorderThreshold?: number
      defaultSalePrice?: number
    } = {}
    if (name !== undefined) updateData.name = name
    if (sku !== undefined) updateData.sku = sku
    if (barcode !== undefined) updateData.barcode = barcode
    if (category !== undefined) updateData.category = category
    if (reorderThreshold !== undefined) updateData.reorderThreshold = Number(reorderThreshold)
    if (defaultSalePrice !== undefined) updateData.defaultSalePrice = Number(defaultSalePrice)

    const product = await db.product.update({
      where: { id },
      data: updateData,
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
