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
    const days = parseInt(searchParams.get('days') || '45', 10)

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

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    // Get all products with stock > 0
    const productWhere: Prisma.ProductWhereInput = {
      currentStockLevel: { gt: 0 },
      isActive: true,
      companyId,
    }
    if (branchId) {
      productWhere.branchId = branchId
    }

    const productsWithStock = await db.product.findMany({
      where: productWhere,
    })

    // Get the last sale for each product
    const result: {
      productId: string
      productName: string
      productSku: string
      category: string
      currentStockLevel: number
      defaultSalePrice: number
      lastSaleDate: Date | null
      daysSinceLastSale: number
      branchId: string
    }[] = []

    for (const product of productsWithStock) {
      const saleItemWhere: Prisma.SaleItemWhereInput = {
        productId: product.id,
      }

      const saleSubWhere: Prisma.SaleWhereInput = { companyId }
      if (branchId) {
        saleSubWhere.branchId = branchId
      }
      saleItemWhere.sale = saleSubWhere

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
