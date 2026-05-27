import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { authenticateRequest, isManagerOrAbove } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    // Authenticate the request
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    // Only managers and admins can access analytics
    if (!isManagerOrAbove(auth.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions. Only managers and admins can access analytics.' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    const category = searchParams.get('category')
    const days = parseInt(searchParams.get('days') || '30', 10)

    // SECURITY: Always use the authenticated user's companyId — never trust client-provided companyId
    const companyId = auth.user.companyId

    // Override branchId for non-admin users
    let branchId: string | undefined
    if (auth.user.role === 'CompanyAdmin') {
      branchId = searchParams.get('branchId') || undefined
    } else {
      // Managers can only see their own branch
      branchId = auth.user.branchId
    }

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    startDate.setHours(0, 0, 0, 0)

    // Build the where clause for sale items
    const saleWhere: Prisma.SaleWhereInput = {
      saleDate: {
        gte: startDate,
      },
      companyId,
    }
    if (branchId) {
      saleWhere.branchId = branchId
    }

    // Get product IDs for category filter
    let categoryProductIds: string[] | null = null
    if (category) {
      const productWhere: Prisma.ProductWhereInput = {
        category,
        companyId,
      }
      if (branchId) {
        productWhere.branchId = branchId
      }
      const productsInCategory = await db.product.findMany({
        where: productWhere,
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
