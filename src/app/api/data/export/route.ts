import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { authenticateRequest, isCompanyAdmin } from '@/lib/auth'
import { logAudit, getRequestInfo } from '@/lib/audit-log'

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    if (!isCompanyAdmin(auth.user.role)) {
      return NextResponse.json({ success: false, error: 'Only administrators can export data' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'
    const type = searchParams.get('type') || 'all' // all, sales, products, customers, expenses

    const companyId = auth.user.companyId
    const { ipAddress, userAgent } = getRequestInfo(request)

    logAudit({
      action: 'SUSPICIOUS_ACTIVITY' as never,
      userId: auth.user.id,
      userEmail: auth.user.email,
      companyId,
      ipAddress,
      userAgent,
      details: `Data export requested: type=${type}, format=${format}`,
      severity: 'warning',
    })

    let data: Record<string, unknown> = {}

    if (type === 'all' || type === 'sales') {
      const sales = await db.sale.findMany({
        where: { companyId },
        include: {
          saleItems: { include: { product: { select: { name: true, sku: true } } } },
          user: { select: { name: true } },
          branch: { select: { name: true } },
        },
        orderBy: { saleDate: 'desc' },
      })
      data.sales = sales.map(s => ({
        id: s.id,
        date: s.saleDate,
        total: s.totalAmount,
        discount: s.discount,
        paymentMethod: s.paymentMethod,
        customerName: s.customerName,
        receiptNumber: s.receiptNumber,
        branch: s.branch.name,
        cashier: s.user.name,
        items: s.saleItems.map(i => ({
          product: i.product.name,
          sku: i.product.sku,
          qty: i.quantitySold,
          price: i.salePricePerUnit,
          cost: i.costPricePerUnit,
          profit: (i.salePricePerUnit - i.costPricePerUnit) * i.quantitySold,
        })),
      }))
    }

    if (type === 'all' || type === 'products') {
      const products = await db.product.findMany({
        where: { companyId },
        include: { branch: { select: { name: true } } },
        orderBy: { name: 'asc' },
      })
      data.products = products.map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        category: p.category,
        stock: p.currentStockLevel,
        reorderThreshold: p.reorderThreshold,
        price: p.defaultSalePrice,
        branch: p.branch.name,
        active: p.isActive,
      }))
    }

    if (type === 'all' || type === 'customers') {
      const customers = await db.customer.findMany({
        where: { companyId },
        include: { branch: { select: { name: true } } },
        orderBy: { name: 'asc' },
      })
      data.customers = customers.map(c => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        loyaltyPoints: c.loyaltyPoints,
        creditBalance: c.creditBalance,
        creditLimit: c.creditLimit,
        branch: c.branch.name,
        active: c.isActive,
      }))
    }

    if (type === 'all' || type === 'expenses') {
      const expenses = await db.expense.findMany({
        where: { companyId },
        include: { branch: { select: { name: true } } },
        orderBy: { date: 'desc' },
      })
      data.expenses = expenses.map(e => ({
        id: e.id,
        category: e.category,
        description: e.description,
        amount: e.amount,
        date: e.date,
        branch: e.branch.name,
      }))
    }

    if (format === 'csv') {
      // Return the data as a downloadable CSV (flatten to first type)
      const records = Object.values(data)[0] as Record<string, unknown>[] || []
      if (records.length === 0) {
        return NextResponse.json({ success: false, error: 'No data to export' }, { status: 404 })
      }

      const headers = Object.keys(records[0])
      const csv = [
        headers.join(','),
        ...records.map(r =>
          headers.map(h => {
            const val = r[h]
            if (val === null || val === undefined) return ''
            if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`
            if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) return `"${val.replace(/"/g, '""')}"`
            return String(val)
          }).join(',')
        ),
      ].join('\n')

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="smartbiz-${type}-export-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    // JSON format
    return NextResponse.json({
      success: true,
      data,
      exportedAt: new Date().toISOString(),
      companyId,
      type,
    })
  } catch (error) {
    console.error('Data export error:', error)
    return NextResponse.json({ success: false, error: 'Failed to export data' }, { status: 500 })
  }
}
