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
    const period = searchParams.get('period') || 'monthly'
    const sortBy = searchParams.get('sortBy') || 'revenue'

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

    // Calculate date range based on period
    const now = new Date()
    let startDate: Date

    switch (period) {
      case 'daily':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'monthly':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
    }

    const saleWhere: Prisma.SaleWhereInput = {
      saleDate: {
        gte: startDate,
      },
      companyId,
    }
    if (branchId) {
      saleWhere.branchId = branchId
    }

    const saleItems = await db.saleItem.findMany({
      where: {
        sale: saleWhere,
      },
      include: {
        product: true,
      },
    })

    // Aggregate by product
    const productMap: Record<
      string,
      {
        productId: string
        productName: string
        productSku: string
        totalQuantity: number
        totalRevenue: number
        totalProfit: number
        salePrice: number
        currentStock: number
      }
    > = {}

    for (const item of saleItems) {
      if (!productMap[item.productId]) {
        productMap[item.productId] = {
          productId: item.productId,
          productName: item.product.name,
          productSku: item.product.sku,
          totalQuantity: 0,
          totalRevenue: 0,
          totalProfit: 0,
          salePrice: item.product.defaultSalePrice,
          currentStock: item.product.currentStockLevel,
        }
      }
      productMap[item.productId].totalQuantity += item.quantitySold
      productMap[item.productId].totalRevenue += item.salePricePerUnit * item.quantitySold
      productMap[item.productId].totalProfit +=
        (item.salePricePerUnit - item.costPricePerUnit) * item.quantitySold
    }

    // Sort by the specified criteria
    const results = Object.values(productMap).sort((a, b) => {
      if (sortBy === 'quantity') {
        return b.totalQuantity - a.totalQuantity
      }
      return b.totalRevenue - a.totalRevenue
    })

    // Round values
    const roundedResults = results.map((r) => ({
      ...r,
      totalRevenue: Math.round(r.totalRevenue * 100) / 100,
      totalProfit: Math.round(r.totalProfit * 100) / 100,
    }))

    return NextResponse.json({ success: true, data: roundedResults })
  } catch (error) {
    console.error('Best-sellers GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
