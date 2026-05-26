import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    const category = searchParams.get('category')
    const days = parseInt(searchParams.get('days') || '30', 10)
    const branchId = searchParams.get('branchId')

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    startDate.setHours(0, 0, 0, 0)

    // Build the where clause for sale items
    const saleWhere: Prisma.SaleWhereInput = {
      saleDate: {
        gte: startDate,
      },
    }
    if (branchId) {
      saleWhere.branchId = branchId
    }

    // Get product IDs for category filter
    let categoryProductIds: string[] | null = null
    if (category) {
      const productsInCategory = await db.product.findMany({
        where: {
          category,
          ...(branchId ? { branchId } : {}),
        },
        select: { id: true },
      })
      categoryProductIds = productsInCategory.map((p) => p.id)
    }

    // Build sale item filter
    const saleItemWhere: Prisma.SaleItemWhereInput = {}
    if (productId) {
      saleItemWhere.productId = productId
    }
    if (categoryProductIds) {
      saleItemWhere.productId = { in: categoryProductIds }
    }

    const saleItems = await db.saleItem.findMany({
      where: {
        ...saleItemWhere,
        sale: saleWhere,
      },
      include: {
        sale: true,
      },
    })

    // Aggregate by date
    const dateMap: Record<
      string,
      {
        quantity: number
        revenue: number
      }
    > = {}

    for (const item of saleItems) {
      const dateStr = new Date(item.sale.saleDate).toISOString().split('T')[0]
      if (!dateMap[dateStr]) {
        dateMap[dateStr] = { quantity: 0, revenue: 0 }
      }
      dateMap[dateStr].quantity += item.quantitySold
      dateMap[dateStr].revenue += item.salePricePerUnit * item.quantitySold
    }

    // Fill in missing dates with zeros
    const result: { date: string; quantity: number; revenue: number }[] = []
    const currentDate = new Date(startDate)
    while (currentDate <= new Date()) {
      const dateStr = currentDate.toISOString().split('T')[0]
      const entry = dateMap[dateStr] || { quantity: 0, revenue: 0 }
      result.push({
        date: dateStr,
        quantity: entry.quantity,
        revenue: Math.round(entry.revenue * 100) / 100,
      })
      currentDate.setDate(currentDate.getDate() + 1)
    }

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('Trends GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
