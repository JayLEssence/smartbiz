'use client'

import { useState, useCallback } from 'react'
import { useAppStore } from '@/stores/app-store'
import { useCurrency } from '@/hooks/use-currency'
import { useLanguage } from '@/lib/i18n/language-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Receipt,
  CreditCard,
  Package,
  Calculator,
  FileDown,
  BarChart3,
  ShoppingBag,
  PiggyBank,
  AlertTriangle,
  Archive,
} from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import { getAuthHeaders } from '@/lib/auth-fetch'

// ============ Types ============

type ReportType = 'sales' | 'expenses' | 'profit-loss' | 'inventory' | 'tax'

interface SalesReportData {
  totalRevenue: number
  averageSale: number
  totalTransactions: number
  dailyBreakdown: { date: string; revenue: number; count: number }[]
  paymentMethods: { method: string; count: number; revenue: number }[]
}

interface ExpensesReportData {
  totalExpenses: number
  topCategory: string
  categoryBreakdown: { category: string; amount: number; count: number }[]
  dailyBreakdown: { date: string; amount: number; count: number }[]
}

interface ProfitLossData {
  revenue: number
  cogs: number
  grossProfit: number
  totalExpenses: number
  netProfit: number
}

interface InventoryReportData {
  totalProducts: number
  totalStockValue: number
  lowStockCount: number
  lowStockItems: { id: string; name: string; currentStockLevel: number; reorderThreshold: number; value: number }[]
  stockList: { id: string; name: string; sku: string; category: string; currentStockLevel: number; value: number }[]
}

interface TaxReportData {
  taxableAmount: number
  taxRate: number
  taxAmount: number
  totalTransactions: number
  paymentBreakdown: { method: string; taxableAmount: number; taxAmount: number }[]
}

type ReportData = SalesReportData | ExpensesReportData | ProfitLossData | InventoryReportData | TaxReportData | null

// ============ Component ============

export function ReportsView() {
  const isMobile = useIsMobile()
  const { t } = useLanguage()
  const { currentUser, branches, currentBranchId } = useAppStore()
  const { formatDual } = useCurrency()

  const [reportType, setReportType] = useState<ReportType>('sales')
  const [selectedBranch, setSelectedBranch] = useState<string>(currentBranchId ?? 'all')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState<ReportData>(null)

  const companyId = currentUser?.companyId
  const role = currentUser?.role

  // Default date range: current month
  const getDefaultDates = () => {
    const now = new Date()
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    return {
      from: from.toISOString().slice(0, 10),
      to: now.toISOString().slice(0, 10),
    }
  }

  const generateReport = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    setReportData(null)

    try {
      const defaults = getDefaultDates()
      const params = new URLSearchParams({
        type: reportType,
        companyId,
        dateFrom: dateFrom || defaults.from,
        dateTo: dateTo || defaults.to,
      })
      if (selectedBranch && selectedBranch !== 'all') {
        params.set('branchId', selectedBranch)
      }

      const res = await fetch(`/api/reports?${params.toString()}`, { headers: getAuthHeaders() })
      const json = await res.json()
      if (json.success) {
        setReportData(json.data)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [companyId, reportType, selectedBranch, dateFrom, dateTo])

  const downloadCSV = useCallback(() => {
    if (!reportData) return

    let csvContent = ''
    const filename = `report-${reportType}-${new Date().toISOString().slice(0, 10)}.csv`

    switch (reportType) {
      case 'sales': {
        const data = reportData as SalesReportData
        csvContent = 'Date,Revenue,Transactions\n'
        data.dailyBreakdown.forEach(row => {
          csvContent += `${row.date},${row.revenue},${row.count}\n`
        })
        csvContent += `\nPayment Method,Count,Revenue\n`
        data.paymentMethods.forEach(row => {
          csvContent += `${row.method},${row.count},${row.revenue}\n`
        })
        csvContent += `\nSummary\nTotal Revenue,${data.totalRevenue}\nAverage Sale,${data.averageSale}\nTotal Transactions,${data.totalTransactions}\n`
        break
      }
      case 'expenses': {
        const data = reportData as ExpensesReportData
        csvContent = 'Category,Amount,Count\n'
        data.categoryBreakdown.forEach(row => {
          csvContent += `${row.category},${row.amount},${row.count}\n`
        })
        csvContent += `\nDaily Breakdown\nDate,Amount,Count\n`
        data.dailyBreakdown.forEach(row => {
          csvContent += `${row.date},${row.amount},${row.count}\n`
        })
        csvContent += `\nSummary\nTotal Expenses,${data.totalExpenses}\nTop Category,${data.topCategory}\n`
        break
      }
      case 'profit-loss': {
        const data = reportData as ProfitLossData
        csvContent = 'Item,Amount\n'
        csvContent += `Revenue,${data.revenue}\n`
        csvContent += `Cost of Goods,${data.cogs}\n`
        csvContent += `Gross Profit,${data.grossProfit}\n`
        csvContent += `Expenses,${data.totalExpenses}\n`
        csvContent += `Net Profit,${data.netProfit}\n`
        break
      }
      case 'inventory': {
        const data = reportData as InventoryReportData
        csvContent = 'Product,SKU,Category,Stock,Value\n'
        data.stockList.forEach(row => {
          csvContent += `"${row.name}",${row.sku},${row.category},${row.currentStockLevel},${row.value}\n`
        })
        csvContent += `\nSummary\nTotal Products,${data.totalProducts}\nTotal Stock Value,${data.totalStockValue}\nLow Stock Items,${data.lowStockCount}\n`
        break
      }
      case 'tax': {
        const data = reportData as TaxReportData
        csvContent = 'Payment Method,Taxable Amount,Tax Amount\n'
        data.paymentBreakdown.forEach(row => {
          csvContent += `${row.method},${row.taxableAmount},${row.taxAmount}\n`
        })
        csvContent += `\nSummary\nTaxable Amount,${data.taxableAmount}\nTax Rate,${data.taxRate}%\nTax Amount,${data.taxAmount}\nTotal Transactions,${data.totalTransactions}\n`
        break
      }
    }

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }, [reportData, reportType])

  // Access control: Manager and CompanyAdmin only
  const isManager = role === 'Manager'
  const isAdmin = role === 'CompanyAdmin'
  if (!isManager && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
        <p className="text-sm font-medium">{t('common.accessDenied')}</p>
        <p className="text-xs mt-1">{t('reports.accessDenied')}</p>
      </div>
    )
  }

  const reportTypes: { key: ReportType; label: string; icon: React.ElementType }[] = [
    { key: 'sales', label: t('reports.sales'), icon: ShoppingBag },
    { key: 'expenses', label: t('reports.expenses'), icon: CreditCard },
    { key: 'profit-loss', label: t('reports.profitLoss'), icon: Calculator },
    { key: 'inventory', label: t('reports.inventory'), icon: Package },
    { key: 'tax', label: t('reports.tax'), icon: Receipt },
  ]

  return (
    <div className={isMobile ? 'p-4 pb-24' : 'p-6'}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <BarChart3 className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-bold">{t('reports.title')}</h1>
        </div>
        {reportData && (
          <Button
            variant="outline"
            size="sm"
            onClick={downloadCSV}
            className="gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
          >
            <FileDown className="h-4 w-4" />
            {t('reports.downloadCSV')}
          </Button>
        )}
      </div>

      {/* Report Type Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-6">
        {reportTypes.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => { setReportType(key); setReportData(null) }}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
              reportType === key
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm dark:bg-emerald-950/30 dark:border-emerald-700 dark:text-emerald-400'
                : 'bg-card border-border text-muted-foreground hover:border-emerald-200 hover:text-emerald-600'
            }`}
          >
            <Icon className="h-4 w-4" />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t('reports.dateFrom')}</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t('reports.dateTo')}</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t('reports.selectBranch')}</label>
              <Select
                value={selectedBranch}
                onValueChange={setSelectedBranch}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('reports.allBranches')}</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={generateReport}
              disabled={loading}
              className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t('reports.loading')}
                </>
              ) : (
                <>
                  <BarChart3 className="h-4 w-4" />
                  {t('reports.generateReport')}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report Display */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      )}

      {!loading && !reportData && (
        <Card>
          <CardContent className="py-16 flex flex-col items-center justify-center text-muted-foreground">
            <BarChart3 className="h-12 w-12 mb-3 opacity-20" />
            <p className="text-sm">{t('reports.noData')}</p>
          </CardContent>
        </Card>
      )}

      {!loading && reportData && reportType === 'sales' && (
        <SalesReportDisplay data={reportData as SalesReportData} formatDual={formatDual} t={t} />
      )}
      {!loading && reportData && reportType === 'expenses' && (
        <ExpensesReportDisplay data={reportData as ExpensesReportData} formatDual={formatDual} t={t} />
      )}
      {!loading && reportData && reportType === 'profit-loss' && (
        <ProfitLossDisplay data={reportData as ProfitLossData} formatDual={formatDual} t={t} />
      )}
      {!loading && reportData && reportType === 'inventory' && (
        <InventoryReportDisplay data={reportData as InventoryReportData} formatDual={formatDual} t={t} />
      )}
      {!loading && reportData && reportType === 'tax' && (
        <TaxReportDisplay data={reportData as TaxReportData} formatDual={formatDual} t={t} />
      )}
    </div>
  )
}

// ============ Sales Report ============

function SalesReportDisplay({
  data,
  formatDual,
  t,
}: {
  data: SalesReportData
  formatDual: (amount: number) => string
  t: (key: string) => string
}) {
  const maxRevenue = Math.max(...data.dailyBreakdown.map(d => d.revenue), 1)
  const maxPaymentRevenue = Math.max(...data.paymentMethods.map(p => p.revenue), 1)

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-emerald-200 dark:border-emerald-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-medium text-muted-foreground">{t('reports.totalRevenue')}</span>
            </div>
            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{formatDual(data.totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card className="border-teal-200 dark:border-teal-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-teal-600" />
              <span className="text-xs font-medium text-muted-foreground">{t('reports.averageSale')}</span>
            </div>
            <p className="text-lg font-bold text-teal-700 dark:text-teal-400">{formatDual(data.averageSale)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Receipt className="h-4 w-4 text-stone-500" />
              <span className="text-xs font-medium text-muted-foreground">{t('reports.transactions')}</span>
            </div>
            <p className="text-lg font-bold">{data.totalTransactions}</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Breakdown */}
      {data.dailyBreakdown.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-emerald-600" />
              {t('reports.dailyBreakdown')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">{t('reports.date')}</th>
                    <th className="pb-2 font-medium text-right">{t('reports.salesCount')}</th>
                    <th className="pb-2 font-medium text-right">{t('reports.revenue')}</th>
                    <th className="pb-2 font-medium text-right w-32"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.dailyBreakdown.map((row) => (
                    <tr key={row.date} className="border-b last:border-0">
                      <td className="py-2 text-muted-foreground">{row.date}</td>
                      <td className="py-2 text-right">{row.count}</td>
                      <td className="py-2 text-right font-medium">{formatDual(row.revenue)}</td>
                      <td className="py-2 pl-2">
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="bg-emerald-500 h-2 rounded-full transition-all"
                            style={{ width: `${Math.max((row.revenue / maxRevenue) * 100, 2)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Methods */}
      {data.paymentMethods.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-teal-600" />
              {t('reports.paymentMethods')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.paymentMethods.map((pm) => (
                <div key={pm.method} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400">
                        {pm.method}
                      </Badge>
                      <span className="text-muted-foreground">{pm.count} {t('reports.transactions').toLowerCase()}</span>
                    </div>
                    <span className="font-medium">{formatDual(pm.revenue)}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2.5">
                    <div
                      className="bg-emerald-500 h-2.5 rounded-full transition-all"
                      style={{ width: `${Math.max((pm.revenue / maxPaymentRevenue) * 100, 2)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ============ Expenses Report ============

function ExpensesReportDisplay({
  data,
  formatDual,
  t,
}: {
  data: ExpensesReportData
  formatDual: (amount: number) => string
  t: (key: string) => string
}) {
  const maxCategoryAmount = Math.max(...data.categoryBreakdown.map(c => c.amount), 1)

  const categoryColors: Record<string, string> = {
    Rent: 'bg-amber-500',
    Utilities: 'bg-blue-500',
    Salaries: 'bg-emerald-500',
    Transport: 'bg-purple-500',
    Supplies: 'bg-teal-500',
    Maintenance: 'bg-orange-500',
    Other: 'bg-stone-500',
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <span className="text-xs font-medium text-muted-foreground">{t('reports.totalExpenses')}</span>
            </div>
            <p className="text-lg font-bold text-red-600 dark:text-red-400">{formatDual(data.totalExpenses)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <PiggyBank className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-medium text-muted-foreground">{t('reports.topCategory')}</span>
            </div>
            <p className="text-lg font-bold">{data.topCategory}</p>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      {data.categoryBreakdown.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-red-500" />
              {t('reports.categoryBreakdown')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.categoryBreakdown.map((cat) => (
                <div key={cat.category} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className={`h-3 w-3 rounded-full ${categoryColors[cat.category] || 'bg-stone-500'}`} />
                      <span className="font-medium">{cat.category}</span>
                      <span className="text-xs text-muted-foreground">({cat.count})</span>
                    </div>
                    <span className="font-medium">{formatDual(cat.amount)}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2.5">
                    <div
                      className={`${categoryColors[cat.category] || 'bg-stone-500'} h-2.5 rounded-full transition-all`}
                      style={{ width: `${Math.max((cat.amount / maxCategoryAmount) * 100, 2)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ============ Profit & Loss ============

function ProfitLossDisplay({
  data,
  formatDual,
  t,
}: {
  data: ProfitLossData
  formatDual: (amount: number) => string
  t: (key: string) => string
}) {
  const isProfit = data.netProfit >= 0

  return (
    <div className="space-y-4">
      {/* Waterfall Display */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Revenue */}
        <Card className="border-emerald-200 dark:border-emerald-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-medium text-muted-foreground">{t('reports.revenue2')}</span>
            </div>
            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{formatDual(data.revenue)}</p>
          </CardContent>
        </Card>

        {/* COGS */}
        <Card className="border-orange-200 dark:border-orange-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingBag className="h-4 w-4 text-orange-500" />
              <span className="text-xs font-medium text-muted-foreground">{t('reports.cogs')}</span>
            </div>
            <p className="text-lg font-bold text-orange-600 dark:text-orange-400">- {formatDual(data.cogs)}</p>
          </CardContent>
        </Card>

        {/* Gross Profit */}
        <Card className={data.grossProfit >= 0 ? 'border-emerald-200 dark:border-emerald-800' : 'border-red-200 dark:border-red-800'}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-medium text-muted-foreground">{t('reports.grossProfit')}</span>
            </div>
            <p className={`text-lg font-bold ${data.grossProfit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {formatDual(data.grossProfit)}
            </p>
          </CardContent>
        </Card>

        {/* Expenses */}
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="h-4 w-4 text-red-500" />
              <span className="text-xs font-medium text-muted-foreground">{t('reports.expenses2')}</span>
            </div>
            <p className="text-lg font-bold text-red-600 dark:text-red-400">- {formatDual(data.totalExpenses)}</p>
          </CardContent>
        </Card>

        {/* Net Profit */}
        <Card className={`sm:col-span-2 ${isProfit ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-700 dark:bg-emerald-950/20' : 'border-red-300 bg-red-50/50 dark:border-red-700 dark:bg-red-950/20'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isProfit ? (
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-600" />
                )}
                <span className="text-sm font-medium text-muted-foreground">
                  {isProfit ? t('reports.netProfit') : t('reports.netLoss')}
                </span>
              </div>
              <p className={`text-2xl font-bold ${isProfit ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {isProfit ? '' : '- '}{formatDual(Math.abs(data.netProfit))}
              </p>
            </div>
            {/* Visual waterfall bar */}
            <div className="mt-3 flex items-center gap-1 h-6">
              {data.revenue > 0 && (
                <>
                  <div
                    className="bg-emerald-500 h-6 rounded-l flex items-center justify-center text-[10px] text-white font-medium min-w-[2px]"
                    style={{ width: `${(data.revenue / data.revenue) * 100}%` }}
                  >
                    {t('reports.revenue2')}
                  </div>
                  <div
                    className="bg-orange-400 h-6 flex items-center justify-center text-[10px] text-white font-medium min-w-[2px]"
                    style={{ width: `${Math.max((data.cogs / data.revenue) * 100, 2)}%` }}
                  >
                    {t('reports.cogs')}
                  </div>
                  <div
                    className="bg-red-400 h-6 rounded-r flex items-center justify-center text-[10px] text-white font-medium min-w-[2px]"
                    style={{ width: `${Math.max((data.totalExpenses / data.revenue) * 100, 2)}%` }}
                  >
                    {t('reports.expenses2')}
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ============ Inventory Report ============

function InventoryReportDisplay({
  data,
  formatDual,
  t,
}: {
  data: InventoryReportData
  formatDual: (amount: number) => string
  t: (key: string) => string
}) {
  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Package className="h-4 w-4 text-teal-600" />
              <span className="text-xs font-medium text-muted-foreground">{t('reports.totalProducts')}</span>
            </div>
            <p className="text-lg font-bold">{data.totalProducts}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 dark:border-emerald-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-medium text-muted-foreground">{t('reports.totalStockValue')}</span>
            </div>
            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{formatDual(data.totalStockValue)}</p>
          </CardContent>
        </Card>
        <Card className={data.lowStockCount > 0 ? 'border-amber-200 dark:border-amber-800' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-medium text-muted-foreground">{t('reports.lowStockItems')}</span>
            </div>
            <p className={`text-lg font-bold ${data.lowStockCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {data.lowStockCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Items */}
      {data.lowStockItems.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              {t('reports.lowStockItems')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">{t('reports.product')}</th>
                    <th className="pb-2 font-medium text-right">{t('reports.stock')}</th>
                    <th className="pb-2 font-medium text-right">{t('reports.value')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lowStockItems.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <span>{item.name}</span>
                          {item.currentStockLevel === 0 && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                              Out
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-2 text-right">
                        <span className={item.currentStockLevel === 0 ? 'text-red-600 font-medium' : 'text-amber-600'}>
                          {item.currentStockLevel}
                        </span>
                        <span className="text-muted-foreground"> / {item.reorderThreshold}</span>
                      </td>
                      <td className="py-2 text-right text-muted-foreground">{formatDual(item.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full Stock List */}
      {data.stockList.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Archive className="h-4 w-4 text-teal-600" />
              {t('reports.inventory')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">{t('reports.product')}</th>
                    <th className="pb-2 font-medium">{t('reports.category')}</th>
                    <th className="pb-2 font-medium text-right">{t('reports.stock')}</th>
                    <th className="pb-2 font-medium text-right">{t('reports.value')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.stockList.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-2">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.sku}</p>
                        </div>
                      </td>
                      <td className="py-2">
                        <Badge variant="outline" className="text-xs">{item.category}</Badge>
                      </td>
                      <td className="py-2 text-right">
                        <span className={item.currentStockLevel <= 5 ? 'text-red-600 font-medium' : ''}>
                          {item.currentStockLevel}
                        </span>
                      </td>
                      <td className="py-2 text-right">{formatDual(item.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ============ Tax Report ============

function TaxReportDisplay({
  data,
  formatDual,
  t,
}: {
  data: TaxReportData
  formatDual: (amount: number) => string
  t: (key: string) => string
}) {
  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-emerald-200 dark:border-emerald-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Receipt className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-medium text-muted-foreground">{t('reports.taxableAmount')}</span>
            </div>
            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{formatDual(data.taxableAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Calculator className="h-4 w-4 text-stone-500" />
              <span className="text-xs font-medium text-muted-foreground">{t('reports.taxRate')}</span>
            </div>
            <p className="text-lg font-bold">{data.taxRate}% VAT</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 dark:border-amber-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-medium text-muted-foreground">{t('reports.taxAmount')}</span>
            </div>
            <p className="text-lg font-bold text-amber-700 dark:text-amber-400">{formatDual(data.taxAmount)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Payment Method Tax Breakdown */}
      {data.paymentBreakdown.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-teal-600" />
              {t('reports.paymentMethods')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">{t('reports.category')}</th>
                    <th className="pb-2 font-medium text-right">{t('reports.taxableAmount')}</th>
                    <th className="pb-2 font-medium text-right">{t('reports.taxAmount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.paymentBreakdown.map((row) => (
                    <tr key={row.method} className="border-b last:border-0">
                      <td className="py-2">
                        <Badge variant="outline" className="text-xs border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400">
                          {row.method}
                        </Badge>
                      </td>
                      <td className="py-2 text-right">{formatDual(row.taxableAmount)}</td>
                      <td className="py-2 text-right font-medium text-amber-700 dark:text-amber-400">{formatDual(row.taxAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary note */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calculator className="h-4 w-4" />
            <span>
              {data.totalTransactions} {t('reports.transactions').toLowerCase()} • {t('reports.taxRate')}: {data.taxRate}% VAT (Tanzania)
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
