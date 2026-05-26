import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
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
    const allProducts = await db.product.findMany()
    const lowStockProducts = allProducts.filter(
      (p) => p.currentStockLevel <= p.reorderThreshold
    )

    // Total inventory value - calculate average purchase price per product
    const productsWithBatches = await db.product.findMany({
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

    return NextResponse.json({
      success: true,
      data: {
        todayRevenue: Math.round(todayRevenue * 100) / 100,
        todayProfit: Math.round(todayProfit * 100) / 100,
        todaySalesCount,
        topSellerToday,
        lowStockProducts,
        totalInventoryValue: Math.round(totalInventoryValue * 100) / 100,
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
