import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const reason = searchParams.get('reason')
    const branchId = searchParams.get('branchId')

    const where: Prisma.ShrinkageWhereInput = {}

    if (from || to) {
      where.dateRecorded = {}
      if (from) {
        where.dateRecorded.gte = new Date(from)
      }
      if (to) {
        where.dateRecorded.lte = new Date(to)
      }
    }

    if (reason) {
      where.reason = reason
    }

    if (branchId) {
      where.branchId = branchId
    }

    const shrinkages = await db.shrinkage.findMany({
      where,
      include: {
        product: true,
      },
    })

    // Get cost prices from inventory batches for financial loss calculation
    let totalFinancialLoss = 0
    const lossByReasonMap: Record<string, { totalLoss: number; count: number }> = {}
    const lossByProductMap: Record<string, { productName: string; totalLoss: number; count: number }> = {}

    for (const shrinkage of shrinkages) {
      // Find the most recent batch at the time of shrinkage for cost price
      const batch = await db.inventoryBatch.findFirst({
        where: {
          productId: shrinkage.productId,
          dateReceived: { lte: shrinkage.dateRecorded },
        },
        orderBy: { dateReceived: 'desc' },
      })

      const costPrice = batch ? batch.purchasePricePerUnit : 0
      const financialLoss = costPrice * shrinkage.quantityLost
      totalFinancialLoss += financialLoss

      // Aggregate by reason
      if (!lossByReasonMap[shrinkage.reason]) {
        lossByReasonMap[shrinkage.reason] = { totalLoss: 0, count: 0 }
      }
      lossByReasonMap[shrinkage.reason].totalLoss += financialLoss
      lossByReasonMap[shrinkage.reason].count += 1

      // Aggregate by product
      if (!lossByProductMap[shrinkage.productId]) {
        lossByProductMap[shrinkage.productId] = {
          productName: shrinkage.product.name,
          totalLoss: 0,
          count: 0,
        }
      }
      lossByProductMap[shrinkage.productId].totalLoss += financialLoss
      lossByProductMap[shrinkage.productId].count += 1
    }

    // Convert lossByReason to array format for frontend
    const lossByReason = Object.entries(lossByReasonMap).map(([reason, val]) => ({
      reason,
      totalLoss: Math.round(val.totalLoss * 100) / 100,
      count: val.count,
    }))

    // Convert lossByProduct to array format
    const lossByProduct = Object.entries(lossByProductMap).map(([productId, val]) => ({
      productId,
      productName: val.productName,
      totalLoss: Math.round(val.totalLoss * 100) / 100,
      count: val.count,
    }))

    // Branch breakdown when no specific branch filter
    let lossByBranch: { branchId: string; branchName: string; totalLoss: number; count: number }[] | undefined
    if (!branchId) {
      const branchLossMap: Record<string, { branchName: string; totalLoss: number; count: number }> = {}

      for (const shrinkage of shrinkages) {
        const batch = await db.inventoryBatch.findFirst({
          where: {
            productId: shrinkage.productId,
            dateReceived: { lte: shrinkage.dateRecorded },
          },
          orderBy: { dateReceived: 'desc' },
        })

        const costPrice = batch ? batch.purchasePricePerUnit : 0
        const financialLoss = costPrice * shrinkage.quantityLost

        if (!branchLossMap[shrinkage.branchId]) {
          const branch = await db.branch.findUnique({ where: { id: shrinkage.branchId } })
          branchLossMap[shrinkage.branchId] = {
            branchName: branch?.name || 'Unknown',
            totalLoss: 0,
            count: 0,
          }
        }
        branchLossMap[shrinkage.branchId].totalLoss += financialLoss
        branchLossMap[shrinkage.branchId].count += 1
      }

      lossByBranch = Object.entries(branchLossMap).map(([bid, val]) => ({
        branchId: bid,
        branchName: val.branchName,
        totalLoss: Math.round(val.totalLoss * 100) / 100,
        count: val.count,
      }))
    }

    return NextResponse.json({
      success: true,
      data: {
        totalFinancialLoss: Math.round(totalFinancialLoss * 100) / 100,
        totalItems: shrinkages.length,
        lossByReason,
        lossByProduct,
        lossByBranch,
      },
    })
  } catch (error) {
    console.error('Loss-report GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
