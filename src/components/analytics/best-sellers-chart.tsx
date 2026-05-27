'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { getAuthHeaders } from '@/lib/auth-fetch'

interface BestSellerData {
  productId: string
  productName: string
  productSku: string
  totalQuantity: number
  totalRevenue: number
}

interface BestSellersChartProps {
  branchId?: string | null
  companyId?: string | null
}

export function BestSellersChart({ branchId, companyId }: BestSellersChartProps) {
  const [data, setData] = useState<BestSellerData[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('daily')
  const [sortBy, setSortBy] = useState('revenue')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ period, sortBy })
      if (companyId) params.set('companyId', companyId)
      if (branchId) params.set('branchId', branchId)
      const res = await fetch(
        `/api/analytics/best-sellers?${params.toString()}`,
        { headers: getAuthHeaders() }
      )
      const json = await res.json()
      if (json.success) {
        setData(json.data.slice(0, 10))
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [period, sortBy, branchId, companyId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const chartData = data.map((item) => ({
    name:
      item.productName.length > 15
        ? item.productName.substring(0, 15) + '…'
        : item.productName,
    value:
      sortBy === 'revenue'
        ? Math.round(item.totalRevenue * 100) / 100
        : item.totalQuantity,
  }))

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <CardTitle className="text-sm">Best Sellers</CardTitle>
          <div className="flex gap-2">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="revenue">By Revenue</SelectItem>
                <SelectItem value="quantity">By Quantity</SelectItem>
              </SelectContent>
            </Select>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="h-8 w-[110px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
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
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 5, bottom: 5 }}
            >
              <XAxis
                type="number"
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) =>
                  sortBy === 'revenue' ? `$${v}` : String(v)
                }
              />
              <YAxis
                dataKey="name"
                type="category"
                tick={{ fontSize: 11 }}
                width={90}
              />
              <Tooltip
                formatter={(value: number) => [
                  sortBy === 'revenue'
                    ? `$${value.toFixed(2)}`
                    : `${value} units`,
                  sortBy === 'revenue' ? 'Revenue' : 'Quantity',
                ]}
              />
              <Bar
                dataKey="value"
                fill="#10b981"
                radius={[0, 4, 4, 0]}
                fillOpacity={0.85}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
