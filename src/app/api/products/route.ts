import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const category = searchParams.get('category')
    const lowStock = searchParams.get('lowStock') === 'true'

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

    return NextResponse.json({ success: true, data: result })
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
    const { name, sku, barcode, category, currentStockLevel, reorderThreshold, defaultSalePrice } = body

    if (!name || !sku || !category || currentStockLevel === undefined || reorderThreshold === undefined || defaultSalePrice === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, sku, category, currentStockLevel, reorderThreshold, defaultSalePrice' },
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
      },
    })

    return NextResponse.json({ success: true, data: product }, { status: 201 })
  } catch (error) {
    console.error('Products POST error:', error)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'A product with this SKU already exists' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
