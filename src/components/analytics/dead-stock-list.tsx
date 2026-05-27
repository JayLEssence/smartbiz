'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertOctagon } from 'lucide-react'
import { getAuthHeaders } from '@/lib/auth-fetch'

interface DeadStockItem {
  productId: string
  productName: string
  productSku: string
  currentStockLevel: number
  daysSinceLastSale: number
}

interface DeadStockListProps {
  branchId?: string | null
  companyId?: string | null
}

export function DeadStockList({ branchId, companyId }: DeadStockListProps) {
  const [data, setData] = useState<DeadStockItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ days: '45' })
      if (companyId) params.set('companyId', companyId)
      if (branchId) params.set('branchId', branchId)
      const res = await fetch(`/api/analytics/dead-stock?${params.toString()}`, { headers: getAuthHeaders() })
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

  const getUrgencyBadge = (days: number) => {
    if (days >= 60) {
      return <Badge variant="destructive">Critical</Badge>
    }
    if (days >= 45) {
      return (
        <Badge className="bg-amber-100 text-amber-700 border-amber-200">
          Warning
        </Badge>
      )
    }
    return <Badge variant="outline">Monitor</Badge>
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertOctagon className="h-4 w-4 text-red-500" />
          Dead Stock (No Sales 45+ Days)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <AlertOctagon className="h-10 w-10 mb-2 opacity-30" />
            <p className="text-sm">No dead stock found!</p>
            <p className="text-xs">All products are selling well.</p>
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-2">
            {data.map((item) => (
              <div
                key={item.productId}
                className="flex items-center justify-between p-2.5 rounded-lg border"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {item.productName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    SKU: {item.productSku} · Stock: {item.currentStockLevel}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span className="text-xs text-muted-foreground">
                    {item.daysSinceLastSale}d
                  </span>
                  {getUrgencyBadge(item.daysSinceLastSale)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
