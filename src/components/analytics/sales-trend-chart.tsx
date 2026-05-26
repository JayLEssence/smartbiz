'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface TrendData {
  date: string
  revenue: number
  quantity: number
}

interface SalesTrendChartProps {
  branchId?: string | null
  companyId?: string | null
}

export function SalesTrendChart({ branchId, companyId }: SalesTrendChartProps) {
  const [data, setData] = useState<TrendData[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ days: '30' })
      if (companyId) params.set('companyId', companyId)
      if (branchId) params.set('branchId', branchId)
      const res = await fetch(`/api/analytics/trends?${params.toString()}`)
      const json = await res.json()
      if (json.success) {
        setData(json.data)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [branchId, companyId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const chartData = data.map((item) => ({
    date: new Date(item.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    revenue: Math.round(item.revenue * 100) / 100,
  }))

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Sales Trend (30 Days)</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
            No data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 5, bottom: 5 }}
            >
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => `$${v}`}
              />
              <Tooltip
                formatter={(value: number) => [
                  `$${value.toFixed(2)}`,
                  'Revenue',
                ]}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 3, fill: '#10b981' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
