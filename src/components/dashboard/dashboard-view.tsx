'use client'

import { useState, useEffect, useCallback } from 'react'
import { SummaryCard } from './summary-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DollarSign,
  TrendingUp,
  Receipt,
  Warehouse,
  AlertTriangle,
  Star,
  RefreshCw,
  Building2,
  Heart,
  ArrowUp,
  ArrowDown,
  Minus,
  Shield,
  Zap,
  ShoppingCart,
  Package,
  FileBarChart,
  Users,
  Clock,
  AlertCircle,
  CreditCard,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useIsMobile } from '@/hooks/use-mobile'
import { useAppStore, type ViewType } from '@/stores/app-store'
import { useLanguage } from '@/lib/i18n/language-context'
import { getAuthHeaders } from '@/lib/auth-fetch'

interface DashboardData {
  todayRevenue: number
  todayProfit: number
  todaySalesCount: number
  totalInventoryValue: number
  topSellerToday: {
    productName: string
    totalQuantity: number
    totalRevenue?: number
  } | null
  lowStockProducts: {
    id: string
    name: string
    currentStockLevel: number
    reorderThreshold: number
  }[]
  branchSummary?: {
    id: string
    name: string
    code: string
    todayRevenue: number
    todaySalesCount: number
  }[]
}

// Quick actions configuration with role-based access
const quickActions = [
  { id: 'new-sale', labelKey: 'dashboard.newSale', view: 'pos' as ViewType, icon: ShoppingCart, color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400', roles: ['Employee', 'Manager', 'CompanyAdmin'] },
  { id: 'add-stock', labelKey: 'dashboard.addStock', view: 'inventory' as ViewType, icon: Package, color: 'bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-400', roles: ['Employee', 'Manager', 'CompanyAdmin'] },
  { id: 'record-expense', labelKey: 'dashboard.recordExpense', view: 'expenses' as ViewType, icon: Receipt, color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400', roles: ['Manager', 'CompanyAdmin'] },
  { id: 'view-reports', labelKey: 'dashboard.viewReports', view: 'reports' as ViewType, icon: FileBarChart, color: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-400', roles: ['Manager', 'CompanyAdmin'] },
  { id: 'add-customer', labelKey: 'dashboard.addCustomer', view: 'customers' as ViewType, icon: Users, color: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400', roles: ['Manager', 'CompanyAdmin'] },
]

export function DashboardView() {
  const isMobile = useIsMobile()
  const { currentBranchId, currentUser, setView } = useAppStore()
  const { t } = useLanguage()
  const companyId = currentUser?.companyId
  const isEmployee = currentUser?.role === 'Employee'
  const userRole = currentUser?.role || 'Employee'

  // Filter quick actions based on user role
  const visibleActions = quickActions.filter(action => action.roles.includes(userRole))

  // Today's summary state
  const [todaysExpenseCount, setTodaysExpenseCount] = useState<number>(0)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [healthScore, setHealthScore] = useState<{ overallScore: number; grade: string; trend: string; recommendations: string[]; breakdown: Record<string, { score: number; weight: string }> } | null>(null)

  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (companyId) params.set('companyId', companyId)
      if (currentBranchId) params.set('branchId', currentBranchId)
      const res = await fetch(`/api/analytics/dashboard?${params.toString()}`, { headers: getAuthHeaders() })
      const json = await res.json()
      if (json.success) {
        setData(json.data)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [currentBranchId, companyId])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  // Fetch health score for managers/admins
  useEffect(() => {
    if (isEmployee) return
    const fetchHealth = async () => {
      try {
        const params = new URLSearchParams()
        if (companyId) params.set('companyId', companyId)
        if (currentBranchId) params.set('branchId', currentBranchId)
        const res = await fetch(`/api/business/health-score?${params.toString()}`, { headers: getAuthHeaders() })
        const json = await res.json()
        if (json.success) setHealthScore(json.data)
      } catch { /* ignore */ }
    }
    fetchHealth()
  }, [currentBranchId, companyId, isEmployee])

  // Fetch today's expense count for managers/admins
  useEffect(() => {
    if (isEmployee) return
    const fetchExpenseCount = async () => {
      try {
        const params = new URLSearchParams()
        if (currentBranchId) params.set('branchId', currentBranchId)
        const now = new Date()
        const todayStr = now.toISOString().split('T')[0]
        params.set('dateFrom', todayStr)
        params.set('dateTo', todayStr)
        params.set('limit', '1')
        const res = await fetch(`/api/expenses?${params.toString()}`, { headers: getAuthHeaders() })
        const json = await res.json()
        if (json.success && json.pagination) {
          setTodaysExpenseCount(json.pagination.total)
        }
      } catch { /* ignore */ }
    }
    fetchExpenseCount()
  }, [currentBranchId, isEmployee])

  if (loading) {
    return (
      <div className={isMobile ? 'p-4 pb-24' : 'p-4'}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>{t('dashboard.failedToLoad')}</p>
      </div>
    )
  }

  // Helper to get local currency info
  const currencySymbol = currentUser?.company?.currencySymbol || '$'
  const exchangeRate = currentUser?.company?.exchangeRate || 1

  return (
    <div className={isMobile ? 'p-4 pb-24' : 'p-4'}>
      {/* Quick Actions */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-4 w-4 text-emerald-600" />
          <h2 className="text-sm font-semibold text-muted-foreground">{t('dashboard.quickActions')}</h2>
        </div>
        <div className={`grid gap-3 ${isMobile ? 'grid-cols-3' : 'grid-cols-5'}`}>
          {visibleActions.map((action) => (
            <button
              key={action.id}
              onClick={() => setView(action.view)}
              className="group flex flex-col items-center gap-2 rounded-xl border bg-card p-4 shadow-sm transition-all duration-200 hover:scale-[1.03] hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${action.color} transition-transform duration-200 group-hover:scale-110`}>
                <action.icon className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium text-center leading-tight">{t(action.labelKey)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Today's Summary */}
      <Card className="mb-6 border-0 bg-gradient-to-r from-emerald-50/80 via-teal-50/60 to-cyan-50/80 dark:from-emerald-950/20 dark:via-teal-950/15 dark:to-cyan-950/20 shadow-sm">
        <CardContent className="pt-4 pb-4 px-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-muted-foreground">{t('dashboard.todaysSummary')}</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex items-center gap-3 rounded-lg bg-white/60 dark:bg-black/10 p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
                <ShoppingCart className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold">{data?.todaySalesCount ?? 0}</p>
                <p className="text-[11px] text-muted-foreground truncate">{t('dashboard.todaysSalesCount')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-white/60 dark:bg-black/10 p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-400">
                <DollarSign className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold">{currencySymbol}{((data?.todayRevenue ?? 0) * exchangeRate).toFixed(0)}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {exchangeRate !== 1 ? `$${(data?.todayRevenue ?? 0).toFixed(2)}` : t('dashboard.todaysRevenue')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-white/60 dark:bg-black/10 p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
                <AlertCircle className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold">{data?.lowStockProducts?.length ?? 0}</p>
                <p className="text-[11px] text-muted-foreground truncate">{t('dashboard.lowStockAlertsCount')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-white/60 dark:bg-black/10 p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400">
                <CreditCard className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold">{todaysExpenseCount}</p>
                <p className="text-[11px] text-muted-foreground truncate">{t('dashboard.pendingExpenses')}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <SummaryCard
          title={t('dashboard.todayRevenue')}
          value={`$${data.todayRevenue.toFixed(2)}`}
          icon={DollarSign}
          className="bg-emerald-50 text-emerald-600"
        />
        <SummaryCard
          title={t('dashboard.todayProfit')}
          value={`$${data.todayProfit.toFixed(2)}`}
          icon={TrendingUp}
          className="bg-emerald-50 text-emerald-600"
        />
        <SummaryCard
          title={t('dashboard.salesToday')}
          value={String(data.todaySalesCount)}
          icon={Receipt}
          className="bg-teal-50 text-teal-600"
        />
        <SummaryCard
          title={t('dashboard.inventoryValue')}
          value={`$${data.totalInventoryValue.toFixed(2)}`}
          icon={Warehouse}
          className="bg-stone-100 text-stone-600"
        />
      </div>

      {/* Business Health Score - for managers/admins */}
      {!isEmployee && healthScore && (
        <Card className="mb-6 border-0 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950/30 dark:via-teal-950/30 dark:to-cyan-950/30 shadow-sm">
          <CardContent className="pt-5 pb-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-3">
                <div className={`relative flex h-14 w-14 items-center justify-center rounded-full border-[3px] ${
                  healthScore.overallScore >= 70 ? 'border-emerald-500' :
                  healthScore.overallScore >= 50 ? 'border-yellow-500' :
                  'border-red-500'
                }`}>
                  <Heart className={`h-6 w-6 ${
                    healthScore.overallScore >= 70 ? 'text-emerald-600' :
                    healthScore.overallScore >= 50 ? 'text-yellow-600' :
                    'text-red-600'
                  }`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{healthScore.overallScore}</span>
                    <span className="text-sm text-muted-foreground">/100</span>
                    <Badge variant="outline" className={`text-xs font-bold ${
                      healthScore.grade.startsWith('A') ? 'border-emerald-500 text-emerald-600' :
                      healthScore.grade === 'B' ? 'border-emerald-400 text-emerald-500' :
                      healthScore.grade === 'C' ? 'border-yellow-500 text-yellow-600' :
                      'border-red-500 text-red-600'
                    }`}>
                      {healthScore.grade}
                    </Badge>
                    {healthScore.trend === 'up' && <ArrowUp className="h-4 w-4 text-emerald-500" />}
                    {healthScore.trend === 'down' && <ArrowDown className="h-4 w-4 text-red-500" />}
                    {healthScore.trend === 'stable' && <Minus className="h-4 w-4 text-yellow-500" />}
                  </div>
                  <p className="text-xs text-muted-foreground">Business Health Score</p>
                </div>
              </div>
              <div className="flex-1 grid grid-cols-5 gap-2 text-center">
                {Object.entries(healthScore.breakdown).map(([key, val]) => (
                  <div key={key} className="rounded-lg bg-white/60 dark:bg-black/20 p-2">
                    <p className="text-sm font-bold" style={{ color: val.score >= 70 ? '#059669' : val.score >= 50 ? '#d97706' : '#dc2626' }}>{val.score}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{key}</p>
                  </div>
                ))}
              </div>
              <div className="sm:max-w-[200px]">
                <p className="text-xs font-medium text-muted-foreground mb-1">Top Recommendation</p>
                <p className="text-xs">{healthScore.recommendations[0]}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-Branch Summary (shown when all branches selected and user is admin) */}
      {!currentBranchId && currentUser?.role === 'CompanyAdmin' && data.branchSummary && data.branchSummary.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="h-4 w-4 text-teal-600" />
              {t('dashboard.branchPerformance')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.branchSummary.map((branch) => (
                <div
                  key={branch.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{branch.name}</p>
                    <p className="text-xs text-muted-foreground">{branch.code}</p>
                  </div>
                  <div className="flex flex-col items-end shrink-0 ml-3">
                    <span className="text-sm font-semibold text-emerald-600">
                      ${branch.todayRevenue.toFixed(2)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {branch.todaySalesCount} {t('dashboard.sales')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Seller */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" />
              {t('dashboard.topSeller')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.topSellerToday ? (
              <div className="space-y-2">
                <p className="font-semibold text-lg">
                  {data.topSellerToday.productName}
                </p>
                <div className="flex gap-4 text-sm">
                  <span className="text-muted-foreground">
                    {t('dashboard.qty')} <span className="text-foreground font-medium">{data.topSellerToday.totalQuantity}</span>
                  </span>
                  <span className="text-muted-foreground">
                    {t('dashboard.revenue')}{' '}
                    <span className="text-emerald-600 font-medium">
                      ${data.topSellerToday.totalRevenue?.toFixed(2) ?? '0.00'}
                    </span>
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">{t('dashboard.noSalesToday')}</p>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                {t('dashboard.lowStockAlerts')}
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={fetchDashboard}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {data.lowStockProducts.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {t('dashboard.allWellStocked')}
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-2">
                {data.lowStockProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between py-1.5"
                  >
                    <span className="text-sm truncate">{product.name}</span>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-xs text-muted-foreground">
                        {product.currentStockLevel}/{product.reorderThreshold}
                      </span>
                      <Badge
                        variant={
                          product.currentStockLevel === 0
                            ? 'destructive'
                            : 'outline'
                        }
                        className={
                          product.currentStockLevel > 0
                            ? 'bg-amber-50 text-amber-700 border-amber-200 text-xs'
                            : 'text-xs'
                        }
                      >
                        {product.currentStockLevel === 0
                          ? t('dashboard.out')
                          : t('dashboard.low')}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
