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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useIsMobile } from '@/hooks/use-mobile'
import { useAppStore } from '@/stores/app-store'
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

export function DashboardView() {
  const isMobile = useIsMobile()
  const { currentBranchId, currentUser } = useAppStore()
  const { t } = useLanguage()
  const companyId = currentUser?.companyId
  const isEmployee = currentUser?.role === 'Employee'
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

  return (
    <div className={isMobile ? 'p-4 pb-24' : 'p-4'}>
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
