import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { authenticateRequest, isManagerOrAbove } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    if (!isManagerOrAbove(auth.user.role)) {
      return NextResponse.json({ success: false, error: 'Manager access required' }, { status: 403 })
    }

    const companyId = auth.user.companyId
    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('branchId') || undefined

    // For non-admin users, restrict to their branch
    const effectiveBranchId = auth.user.role === 'BranchManager' ? auth.user.branchId : branchId

    // Calculate various health metrics
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // 1. Revenue Health (30 days)
    const sales = await db.sale.findMany({
      where: {
        companyId,
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        saleDate: { gte: thirtyDaysAgo },
      },
      select: { totalAmount: true, saleDate: true },
    })

    const totalRevenue30d = sales.reduce((sum, s) => sum + s.totalAmount, 0)
    const avgDailyRevenue = totalRevenue30d / 30

    // 2. Inventory Health
    const products = await db.product.findMany({
      where: {
        companyId,
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        isActive: true,
      },
      select: {
        currentStockLevel: true,
        reorderThreshold: true,
        defaultSalePrice: true,
      },
    })

    const totalProducts = products.length
    const lowStockProducts = products.filter(p => p.currentStockLevel <= p.reorderThreshold).length
    const outOfStockProducts = products.filter(p => p.currentStockLevel === 0).length
    const inventoryValue = products.reduce((sum, p) => sum + (p.currentStockLevel * p.defaultSalePrice), 0)

    // 3. Expense Health (30 days)
    const expenses = await db.expense.findMany({
      where: {
        companyId,
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        date: { gte: thirtyDaysAgo },
      },
      select: { amount: true, category: true },
    })

    const totalExpenses30d = expenses.reduce((sum, e) => sum + e.amount, 0)
    const expenseRatio = totalRevenue30d > 0 ? (totalExpenses30d / totalRevenue30d) * 100 : 0

    // 4. Shrinkage Health (30 days)
    const shrinkages = await db.shrinkage.findMany({
      where: {
        branch: { companyId },
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        dateRecorded: { gte: thirtyDaysAgo },
      },
      include: { product: { select: { defaultSalePrice: true } } },
    })

    const shrinkageLoss = shrinkages.reduce((sum, s) => sum + (s.quantityLost * s.product.defaultSalePrice), 0)
    const shrinkageRatio = totalRevenue30d > 0 ? (shrinkageLoss / totalRevenue30d) * 100 : 0

    // 5. Sales Velocity (7 days)
    const recentSales = await db.sale.findMany({
      where: {
        companyId,
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        saleDate: { gte: sevenDaysAgo },
      },
      select: { totalAmount: true },
    })

    const revenue7d = recentSales.reduce((sum, s) => sum + s.totalAmount, 0)
    const avgDailyRevenue7d = revenue7d / 7

    // 6. Customer Health
    const customerCount = await db.customer.count({
      where: {
        companyId,
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        isActive: true,
      },
    })

    // Calculate Health Scores (0-100)
    const revenueScore = Math.min(100, avgDailyRevenue7d > 0 ? Math.min(avgDailyRevenue7d / (avgDailyRevenue || 1) * 60, 100) : 0)
    const inventoryScore = totalProducts > 0 ? Math.max(0, 100 - (lowStockProducts / totalProducts * 100) - (outOfStockProducts / totalProducts * 50)) : 50
    const expenseScore = expenseRatio < 50 ? 100 : expenseRatio < 70 ? 70 : expenseRatio < 90 ? 40 : 20
    const shrinkageScore = shrinkageRatio < 1 ? 100 : shrinkageRatio < 3 ? 80 : shrinkageRatio < 5 ? 60 : shrinkageRatio < 10 ? 40 : 20
    const customerScore = customerCount > 50 ? 100 : customerCount > 20 ? 80 : customerCount > 10 ? 60 : customerCount > 0 ? 40 : 0

    // Overall Health Score (weighted)
    const overallScore = Math.round(
      revenueScore * 0.30 +
      inventoryScore * 0.25 +
      expenseScore * 0.20 +
      shrinkageScore * 0.15 +
      customerScore * 0.10
    )

    const grade = overallScore >= 90 ? 'A+' : overallScore >= 80 ? 'A' : overallScore >= 70 ? 'B' : overallScore >= 60 ? 'C' : overallScore >= 50 ? 'D' : 'F'

    // Generate recommendations
    const recommendations: string[] = []
    if (outOfStockProducts > 0) recommendations.push(`${outOfStockProducts} products are out of stock - reorder immediately`)
    if (lowStockProducts > outOfStockProducts) recommendations.push(`${lowStockProducts - outOfStockProducts} products are running low`)
    if (expenseRatio > 70) recommendations.push('Expenses are too high relative to revenue - look for cost savings')
    if (shrinkageRatio > 3) recommendations.push('Shrinkage rate is above 3% - investigate losses')
    if (avgDailyRevenue7d < avgDailyRevenue * 0.8) recommendations.push('Revenue is declining - review sales strategy')
    if (customerCount < 10) recommendations.push('Add more customers to build a sustainable business')
    if (recommendations.length === 0) recommendations.push('Your business is healthy! Keep up the good work.')

    return NextResponse.json({
      success: true,
      data: {
        overallScore,
        grade,
        breakdown: {
          revenue: { score: Math.round(revenueScore), weight: '30%', value: totalRevenue30d, avgDaily: avgDailyRevenue7d },
          inventory: { score: Math.round(inventoryScore), weight: '25%', totalProducts, lowStock: lowStockProducts, outOfStock: outOfStockProducts, value: inventoryValue },
          expenses: { score: Math.round(expenseScore), weight: '20%', total: totalExpenses30d, ratio: Math.round(expenseRatio * 10) / 10 },
          shrinkage: { score: Math.round(shrinkageScore), weight: '15%', loss: shrinkageLoss, ratio: Math.round(shrinkageRatio * 10) / 10 },
          customers: { score: Math.round(customerScore), weight: '10%', count: customerCount },
        },
        recommendations,
        trend: avgDailyRevenue7d > avgDailyRevenue ? 'up' : avgDailyRevenue7d < avgDailyRevenue * 0.9 ? 'down' : 'stable',
      },
    })
  } catch (error) {
    console.error('Health score error:', error)
    return NextResponse.json({ success: false, error: 'Failed to calculate health score' }, { status: 500 })
  }
}
