import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest, isManagerOrAbove } from '@/lib/auth'
import { logAudit, getRequestInfo } from '@/lib/audit-log'

export async function GET(request: NextRequest) {
  try {
    // Authenticate the request
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    // Only managers and admins can access reports
    if (!isManagerOrAbove(auth.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions. Only managers and admins can access reports.' },
        { status: 403 }
      )
    }

    const { searchParams } = request.nextUrl
    const type = searchParams.get('type') || 'sales'
    // SECURITY: Always use the authenticated user's companyId — never trust client-provided companyId
    const companyId = auth.user.companyId
    // For employees (shouldn't reach here due to role check), override branchId with their own
    let branchId = searchParams.get('branchId') || undefined
    if (auth.user.role !== 'CompanyAdmin' && auth.user.branchId) {
      branchId = auth.user.branchId
    }
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    // Build date filter
    const dateFilter: Record<string, Date> = {}
    if (dateFrom) dateFilter.gte = new Date(dateFrom)
    if (dateTo) {
      const to = new Date(dateTo)
      to.setHours(23, 59, 59, 999)
      dateFilter.lte = to
    }

    // Audit log for sensitive data access
    const reqInfo = getRequestInfo(request)
    logAudit({
      action: 'SUSPICIOUS_ACTIVITY' as never,
      userId: auth.user.id,
      userEmail: auth.user.email,
      companyId: auth.user.companyId,
      branchId: auth.user.branchId,
      details: `Report accessed: type=${type}, branchId=${branchId || 'all'}`,
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    })

    switch (type) {
      case 'sales':
        return NextResponse.json({ success: true, data: await getSalesReport(companyId, branchId || null, dateFilter) })
      case 'expenses':
        return NextResponse.json({ success: true, data: await getExpensesReport(companyId, branchId || null, dateFilter) })
      case 'profit-loss':
        return NextResponse.json({ success: true, data: await getProfitLossReport(companyId, branchId || null, dateFilter) })
      case 'inventory':
        return NextResponse.json({ success: true, data: await getInventoryReport(companyId, branchId || null) })
      case 'tax':
        return NextResponse.json({ success: true, data: await getTaxReport(companyId, branchId || null, dateFilter) })
      default:
        return NextResponse.json({ success: false, error: 'Invalid report type' }, { status: 400 })
    }
  } catch (error) {
    console.error('Reports API error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

async function getSalesReport(
  companyId: string,
  branchId: string | null,
  dateFilter: Record<string, Date>
) {
  const where: Record<string, unknown> = { companyId }
  if (branchId) where.branchId = branchId
  if (Object.keys(dateFilter).length > 0) where.saleDate = dateFilter

  const sales = await db.sale.findMany({
    where,
    include: { saleItems: true },
    orderBy: { saleDate: 'desc' },
  })

  const totalRevenue = sales.reduce((sum, s) => sum + s.totalAmount, 0)
  const totalTransactions = sales.length
  const averageSale = totalTransactions > 0 ? totalRevenue / totalTransactions : 0

  // Daily breakdown
  const dailyMap = new Map<string, { date: string; revenue: number; count: number }>()
  for (const sale of sales) {
    const dateKey = sale.saleDate.toISOString().slice(0, 10)
    const existing = dailyMap.get(dateKey)
    if (existing) {
      existing.revenue += sale.totalAmount
      existing.count += 1
    } else {
      dailyMap.set(dateKey, { date: dateKey, revenue: sale.totalAmount, count: 1 })
    }
  }
  const dailyBreakdown = Array.from(dailyMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(d => ({ ...d, revenue: Math.round(d.revenue * 100) / 100 }))

  // Payment method breakdown
  const paymentMap = new Map<string, { method: string; count: number; revenue: number }>()
  for (const sale of sales) {
    const method = sale.paymentMethod || 'Cash'
    const existing = paymentMap.get(method)
    if (existing) {
      existing.count += 1
      existing.revenue += sale.totalAmount
    } else {
      paymentMap.set(method, { method, count: 1, revenue: sale.totalAmount })
    }
  }
  const paymentMethods = Array.from(paymentMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .map(p => ({ ...p, revenue: Math.round(p.revenue * 100) / 100 }))

  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    averageSale: Math.round(averageSale * 100) / 100,
    totalTransactions,
    dailyBreakdown,
    paymentMethods,
  }
}

async function getExpensesReport(
  companyId: string,
  branchId: string | null,
  dateFilter: Record<string, Date>
) {
  const where: Record<string, unknown> = { companyId }
  if (branchId) where.branchId = branchId
  if (Object.keys(dateFilter).length > 0) where.date = dateFilter

  const expenses = await db.expense.findMany({
    where,
    orderBy: { date: 'desc' },
  })

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)

  // Category breakdown
  const categoryMap = new Map<string, { category: string; amount: number; count: number }>()
  for (const expense of expenses) {
    const cat = expense.category || 'Other'
    const existing = categoryMap.get(cat)
    if (existing) {
      existing.amount += expense.amount
      existing.count += 1
    } else {
      categoryMap.set(cat, { category: cat, amount: expense.amount, count: 1 })
    }
  }
  const categoryBreakdown = Array.from(categoryMap.values())
    .sort((a, b) => b.amount - a.amount)
    .map(c => ({ ...c, amount: Math.round(c.amount * 100) / 100 }))

  const topCategory = categoryBreakdown.length > 0 ? categoryBreakdown[0].category : 'N/A'

  // Daily breakdown
  const dailyMap = new Map<string, { date: string; amount: number; count: number }>()
  for (const expense of expenses) {
    const dateKey = expense.date.toISOString().slice(0, 10)
    const existing = dailyMap.get(dateKey)
    if (existing) {
      existing.amount += expense.amount
      existing.count += 1
    } else {
      dailyMap.set(dateKey, { date: dateKey, amount: expense.amount, count: 1 })
    }
  }
  const dailyBreakdown = Array.from(dailyMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(d => ({ ...d, amount: Math.round(d.amount * 100) / 100 }))

  return {
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    topCategory,
    categoryBreakdown,
    dailyBreakdown,
  }
}

async function getProfitLossReport(
  companyId: string,
  branchId: string | null,
  dateFilter: Record<string, Date>
) {
  const saleWhere: Record<string, unknown> = { companyId }
  if (branchId) saleWhere.branchId = branchId
  if (Object.keys(dateFilter).length > 0) saleWhere.saleDate = dateFilter

  const expenseWhere: Record<string, unknown> = { companyId }
  if (branchId) expenseWhere.branchId = branchId
  if (Object.keys(dateFilter).length > 0) expenseWhere.date = dateFilter

  // Revenue from sales
  const sales = await db.sale.findMany({
    where: saleWhere,
    include: { saleItems: true },
  })

  const revenue = sales.reduce((sum, s) => sum + s.totalAmount, 0)

  // Cost of goods sold from sale items
  let cogs = 0
  for (const sale of sales) {
    for (const item of sale.saleItems) {
      cogs += item.costPricePerUnit * item.quantitySold
    }
  }

  // Expenses
  const expenses = await db.expense.findMany({ where: expenseWhere })
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)

  const grossProfit = revenue - cogs
  const netProfit = grossProfit - totalExpenses

  return {
    revenue: Math.round(revenue * 100) / 100,
    cogs: Math.round(cogs * 100) / 100,
    grossProfit: Math.round(grossProfit * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
  }
}

async function getInventoryReport(
  companyId: string,
  branchId: string | null
) {
  const where: Record<string, unknown> = { companyId, isActive: true }
  if (branchId) where.branchId = branchId

  const products = await db.product.findMany({
    where,
    include: { inventoryBatches: true },
  })

  const totalProducts = products.length
  let totalStockValue = 0
  const lowStockItems: { id: string; name: string; currentStockLevel: number; reorderThreshold: number; value: number }[] = []
  const stockList: { id: string; name: string; sku: string; category: string; currentStockLevel: number; value: number }[] = []

  for (const product of products) {
    // Calculate cost per unit from latest batch
    let costPerUnit = 0
    if (product.inventoryBatches.length > 0) {
      const sortedBatches = [...product.inventoryBatches].sort(
        (a, b) => new Date(b.dateReceived).getTime() - new Date(a.dateReceived).getTime()
      )
      costPerUnit = sortedBatches[0].purchasePricePerUnit
    }

    const stockValue = product.currentStockLevel * (costPerUnit || product.defaultSalePrice * 0.6)
    totalStockValue += stockValue

    stockList.push({
      id: product.id,
      name: product.name,
      sku: product.sku,
      category: product.category,
      currentStockLevel: product.currentStockLevel,
      value: Math.round(stockValue * 100) / 100,
    })

    if (product.currentStockLevel <= product.reorderThreshold) {
      lowStockItems.push({
        id: product.id,
        name: product.name,
        currentStockLevel: product.currentStockLevel,
        reorderThreshold: product.reorderThreshold,
        value: Math.round(stockValue * 100) / 100,
      })
    }
  }

  return {
    totalProducts,
    totalStockValue: Math.round(totalStockValue * 100) / 100,
    lowStockCount: lowStockItems.length,
    lowStockItems,
    stockList: stockList.sort((a, b) => a.currentStockLevel - b.currentStockLevel),
  }
}

async function getTaxReport(
  companyId: string,
  branchId: string | null,
  dateFilter: Record<string, Date>
) {
  const where: Record<string, unknown> = { companyId }
  if (branchId) where.branchId = branchId
  if (Object.keys(dateFilter).length > 0) where.saleDate = dateFilter

  const sales = await db.sale.findMany({ where })

  const TAX_RATE = 0.18 // 18% VAT for Tanzania

  // All sales are taxable in this simple model (Cash/M-Pesa/etc are all taxable)
  const taxableSales = sales.reduce((sum, s) => sum + s.totalAmount, 0)
  const taxAmount = taxableSales * TAX_RATE

  // Payment method tax breakdown
  const paymentTaxMap = new Map<string, { method: string; taxableAmount: number; taxAmount: number }>()
  for (const sale of sales) {
    const method = sale.paymentMethod || 'Cash'
    const existing = paymentTaxMap.get(method)
    if (existing) {
      existing.taxableAmount += sale.totalAmount
      existing.taxAmount += sale.totalAmount * TAX_RATE
    } else {
      paymentTaxMap.set(method, {
        method,
        taxableAmount: sale.totalAmount,
        taxAmount: sale.totalAmount * TAX_RATE,
      })
    }
  }
  const paymentBreakdown = Array.from(paymentTaxMap.values())
    .sort((a, b) => b.taxableAmount - a.taxableAmount)
    .map(p => ({
      ...p,
      taxableAmount: Math.round(p.taxableAmount * 100) / 100,
      taxAmount: Math.round(p.taxAmount * 100) / 100,
    }))

  return {
    taxableAmount: Math.round(taxableSales * 100) / 100,
    taxRate: TAX_RATE * 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    totalTransactions: sales.length,
    paymentBreakdown,
  }
}
