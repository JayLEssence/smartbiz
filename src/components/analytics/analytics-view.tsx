'use client'

import { useState, useEffect, useCallback } from 'react'
import { BestSellersChart } from './best-sellers-chart'
import { SalesTrendChart } from './sales-trend-chart'
import { DeadStockList } from './dead-stock-list'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DollarSign, PieChart } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useIsMobile } from '@/hooks/use-mobile'
import { useAppStore } from '@/stores/app-store'
import { useLanguage } from '@/lib/i18n/language-context'

interface LossData {
  totalFinancialLoss: number
  totalItems: number
  lossByReason: { reason: string; totalLoss: number; count: number }[]
  lossByProduct: { productId: string; productName: string; totalLoss: number; count: number }[]
}

export function AnalyticsView() {
  const isMobile = useIsMobile()
  const { currentBranchId, currentUser } = useAppStore()
  const { t } = useLanguage()
  const companyId = currentUser?.companyId
  const [lossData, setLossData] = useState<LossData | null>(null)
  const [lossLoading, setLossLoading] = useState(true)

  const fetchLossReport = useCallback(async () => {
    setLossLoading(true)
    try {
      const params = new URLSearchParams()
      if (companyId) params.set('companyId', companyId)
      if (currentBranchId) params.set('branchId', currentBranchId)
      const res = await fetch(`/api/analytics/loss-report?${params.toString()}`)
      const json = await res.json()
      if (json.success) {
        setLossData(json.data)
      }
    } catch {
      // ignore
    } finally {
      setLossLoading(false)
    }
  }, [currentBranchId, companyId])

  useEffect(() => {
    fetchLossReport()
  }, [fetchLossReport])

  const lossByReasonData = lossData?.lossByReason?.map((item: { reason: string; totalLoss: number }) => ({
    reason: item.reason,
    loss: Math.round(item.totalLoss * 100) / 100,
  })) ?? []

  return (
    <div className={isMobile ? 'p-4 pb-24' : 'p-4'}>
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <BestSellersChart branchId={currentBranchId} companyId={companyId} />
        <SalesTrendChart branchId={currentBranchId} companyId={companyId} />
      </div>

      {/* Dead Stock + Loss Report */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DeadStockList branchId={currentBranchId} companyId={companyId} />

        {/* Loss Report */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-red-500" />
              {t('analytics.lossReport')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lossLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : !lossData || lossData.totalFinancialLoss === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <PieChart className="h-10 w-10 mb-2 opacity-30" />
                <p className="text-sm">{t('analytics.noLosses')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">{t('analytics.totalFinancialLoss')}</p>
                  <p className="text-2xl font-bold text-red-600">
                    ${lossData.totalFinancialLoss.toFixed(2)}
                  </p>
                </div>
                {lossByReasonData.length > 0 && (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={lossByReasonData}>
                      <XAxis
                        dataKey="reason"
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v: number) => `$${v}`}
                      />
                      <Tooltip
                        formatter={(value: number) => [
                          `$${value.toFixed(2)}`,
                          t('analytics.loss'),
                        ]}
                      />
                      <Bar
                        dataKey="loss"
                        fill="#ef4444"
                        radius={[4, 4, 0, 0]}
                        fillOpacity={0.8}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
