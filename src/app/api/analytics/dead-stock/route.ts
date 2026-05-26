import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '45', 10)
    const branchId = searchParams.get('branchId')
    const companyId = searchParams.get('companyId')

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    // Get all products with stock > 0
    const productWhere: Prisma.ProductWhereInput = {
      currentStockLevel: { gt: 0 },
      isActive: true,
    }
    if (branchId) {
      productWhere.branchId = branchId
    }
    if (companyId) {
      productWhere.companyId = companyId
    }

    const productsWithStock = await db.product.findMany({
      where: productWhere,
    })

    // Get the last sale for each product
    const result = []

    for (const product of productsWithStock) {
      const saleItemWhere: Prisma.SaleItemWhereInput = {
        productId: product.id,
      }
      if (branchId) {
        saleItemWhere.sale = { branchId }
      }
      if (companyId) {
        saleItemWhere.sale = { ...((saleItemWhere.sale as Prisma.SaleWhereInput) || {}), companyId }
      }

      const lastSaleItem = await db.saleItem.findFirst({
        where: saleItemWhere,
        include: { sale: true },
        orderBy: { sale: { saleDate: 'desc' } },
      })

      const lastSaleDate = lastSaleItem ? lastSaleItem.sale.saleDate : null
      const daysSinceLastSale = lastSaleDate
        ? Math.floor((Date.now() - new Date(lastSaleDate).getTime()) / (1000 * 60 * 60 * 24))
        : 999

      // Include if no sales in the last X days (or no sales at all)
      if (!lastSaleDate || daysSinceLastSale >= days) {
        result.push({
          productId: product.id,
          productName: product.name,
          productSku: product.sku,
          category: product.category,
          currentStockLevel: product.currentStockLevel,
          defaultSalePrice: product.defaultSalePrice,
          lastSaleDate,
          daysSinceLastSale: lastSaleDate ? daysSinceLastSale : 999,
          branchId: product.branchId,
        })
      }
    }

    // Sort by days since last sale descending
    result.sort((a, b) => b.daysSinceLastSale - a.daysSinceLastSale)

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('Dead-stock GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
