import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const product = await db.product.findUnique({ where: { id } })

    if (!product) {
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
    const { id } = await params
    const body = await request.json()
    const { name, sku, barcode, category, reorderThreshold, defaultSalePrice } = body

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
    console.error('Product PUT error:', error)
    const { Prisma } = await import('@prisma/client')
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
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

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
