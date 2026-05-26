import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('branchId')
    const companyId = searchParams.get('companyId')

    // Build branch filter for all queries
    const branchFilter = branchId ? { branchId } : {}
    const companyFilter = companyId ? { companyId } : {}
    const combinedFilter = { ...branchFilter, ...companyFilter }

    // Get today's date range
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)

    // Today's sales
    const todaySales = await db.sale.findMany({
      where: {
        saleDate: {
          gte: todayStart,
          lt: todayEnd,
        },
        ...combinedFilter,
      },
      include: {
        saleItems: {
          include: {
            product: true,
          },
        },
      },
    })

    // Calculate today's revenue
    const todayRevenue = todaySales.reduce((sum, sale) => sum + sale.totalAmount, 0)

    // Calculate today's profit
    const todayProfit = todaySales.reduce((sum, sale) => {
      return sum + sale.saleItems.reduce((itemSum, item) => {
        return itemSum + (item.salePricePerUnit - item.costPricePerUnit) * item.quantitySold
      }, 0)
    }, 0)

    const todaySalesCount = todaySales.length

    // Top seller today
    const productSalesMap: Record<string, { productName: string; totalQuantity: number; totalRevenue: number }> = {}
    for (const sale of todaySales) {
      for (const item of sale.saleItems) {
        if (!productSalesMap[item.productId]) {
          productSalesMap[item.productId] = {
            productName: item.product.name,
            totalQuantity: 0,
            totalRevenue: 0,
          }
        }
        productSalesMap[item.productId].totalQuantity += item.quantitySold
        productSalesMap[item.productId].totalRevenue += item.salePricePerUnit * item.quantitySold
      }
    }

    let topSellerToday: { productName: string; totalQuantity: number; totalRevenue: number } | null = null
    for (const entry of Object.values(productSalesMap)) {
      if (!topSellerToday || entry.totalQuantity > topSellerToday.totalQuantity) {
        topSellerToday = entry
      }
    }

    // Low stock products
    const allProducts = await db.product.findMany({
      where: {
        ...branchFilter,
        ...companyFilter,
        isActive: true,
      },
    })
    const lowStockProducts = allProducts.filter(
      (p) => p.currentStockLevel <= p.reorderThreshold
    )

    // Total inventory value - calculate average purchase price per product
    const productsWithBatches = await db.product.findMany({
      where: {
        ...branchFilter,
        ...companyFilter,
        isActive: true,
      },
      include: {
        inventoryBatches: true,
      },
    })

    let totalInventoryValue = 0
    for (const product of productsWithBatches) {
      if (product.inventoryBatches.length > 0) {
        const totalPurchaseValue = product.inventoryBatches.reduce(
          (sum, batch) => sum + batch.purchasePricePerUnit * batch.quantityAdded,
          0
        )
        const totalPurchaseQty = product.inventoryBatches.reduce(
          (sum, batch) => sum + batch.quantityAdded,
          0
        )
        const avgPrice = totalPurchaseValue / totalPurchaseQty
        totalInventoryValue += product.currentStockLevel * avgPrice
      }
    }

    // Branch summary when no branch filter is applied
    let branchSummary: { id: string; name: string; code: string; todayRevenue: number; todaySalesCount: number }[] | undefined
    if (!branchId) {
      const branchWhere: { isActive: boolean; companyId?: string } = { isActive: true }
      if (companyId) branchWhere.companyId = companyId

      const branches = await db.branch.findMany({
        where: branchWhere,
      })
      branchSummary = await Promise.all(
        branches.map(async (branch) => {
          const branchSales = await db.sale.findMany({
            where: {
              saleDate: {
                gte: todayStart,
                lt: todayEnd,
              },
              branchId: branch.id,
              ...(companyId ? { companyId } : {}),
            },
          })
          return {
            id: branch.id,
            name: branch.name,
            code: branch.code,
            todayRevenue: Math.round(branchSales.reduce((sum, s) => sum + s.totalAmount, 0) * 100) / 100,
            todaySalesCount: branchSales.length,
          }
        })
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        todayRevenue: Math.round(todayRevenue * 100) / 100,
        todayProfit: Math.round(todayProfit * 100) / 100,
        todaySalesCount,
        topSellerToday,
        lowStockProducts,
        totalInventoryValue: Math.round(totalInventoryValue * 100) / 100,
        branchSummary,
      },
    })
  } catch (error) {
    console.error('Dashboard GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
