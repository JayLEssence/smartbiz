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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useIsMobile } from '@/hooks/use-mobile'

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
}

export function DashboardView() {
  const isMobile = useIsMobile()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/analytics/dashboard')
      const json = await res.json()
      if (json.success) {
        setData(json.data)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

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
        <p>Failed to load dashboard data</p>
      </div>
    )
  }

  return (
    <div className={isMobile ? 'p-4 pb-24' : 'p-4'}>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <SummaryCard
          title="Today's Revenue"
          value={`$${data.todayRevenue.toFixed(2)}`}
          icon={DollarSign}
          className="bg-emerald-50 text-emerald-600"
        />
        <SummaryCard
          title="Today's Profit"
          value={`$${data.todayProfit.toFixed(2)}`}
          icon={TrendingUp}
          className="bg-emerald-50 text-emerald-600"
        />
        <SummaryCard
          title="Sales Today"
          value={String(data.todaySalesCount)}
          icon={Receipt}
          className="bg-teal-50 text-teal-600"
        />
        <SummaryCard
          title="Inventory Value"
          value={`$${data.totalInventoryValue.toFixed(2)}`}
          icon={Warehouse}
          className="bg-stone-100 text-stone-600"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Seller */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" />
              Top Seller Today
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
                    Qty: <span className="text-foreground font-medium">{data.topSellerToday.totalQuantity}</span>
                  </span>
                  <span className="text-muted-foreground">
                    Revenue:{' '}
                    <span className="text-emerald-600 font-medium">
                      ${data.topSellerToday.totalRevenue?.toFixed(2) ?? '0.00'}
                    </span>
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No sales today yet</p>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Low Stock Alerts
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
                All products are well-stocked!
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
                          ? 'Out'
                          : 'Low'}
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
