'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { RefreshCw, Lightbulb, AlertCircle, ArrowRight } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import { useAppStore } from '@/stores/app-store'

interface Recommendation {
  type: string
  priority: string
  productName: string
  recommendation: string
  suggestedAction: string
}

export function AdvisorView() {
  const isMobile = useIsMobile()
  const { currentBranchId } = useAppStore()
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRecommendations = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (currentBranchId) params.set('branchId', currentBranchId)
      const res = await fetch(`/api/advisor/recommendations?${params.toString()}`)
      const json = await res.json()
      if (json.success) {
        setRecommendations(json.data)
      } else {
        setError(json.error ?? 'Failed to load recommendations')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [currentBranchId])

  useEffect(() => {
    fetchRecommendations()
  }, [fetchRecommendations])

  const getTypeBadge = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'reorder':
        return (
          <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
            Reorder
          </Badge>
        )
      case 'pricing':
        return (
          <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">
            Pricing
          </Badge>
        )
      case 'discount':
        return (
          <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs">
            Discount
          </Badge>
        )
      default:
        return <Badge variant="outline" className="text-xs">{type}</Badge>
    }
  }

  const getPriorityIndicator = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return <div className="h-2.5 w-2.5 rounded-full bg-red-500 shrink-0" />
      case 'medium':
        return <div className="h-2.5 w-2.5 rounded-full bg-amber-500 shrink-0" />
      case 'low':
        return <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0" />
      default:
        return <div className="h-2.5 w-2.5 rounded-full bg-gray-400 shrink-0" />
    }
  }

  return (
    <div className={isMobile ? 'p-4 pb-24' : 'p-4'}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          <h2 className="font-semibold">Smart Recommendations</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchRecommendations}
          disabled={loading}
          className="gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8">
              <AlertCircle className="h-12 w-12 text-red-400 mb-3" />
              <p className="text-sm text-muted-foreground mb-3">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchRecommendations}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : recommendations.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Lightbulb className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">No recommendations at this time</p>
              <p className="text-xs mt-1">Check back later for insights</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 max-h-[calc(100vh-180px)] overflow-y-auto">
          {recommendations.map((rec, index) => (
            <Card key={index} className="overflow-hidden">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  {getPriorityIndicator(rec.priority)}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {getTypeBadge(rec.type)}
                      <span className="text-sm font-semibold">
                        {rec.productName}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {rec.recommendation}
                    </p>
                    {rec.suggestedAction && (
                      <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                        <ArrowRight className="h-3 w-3" />
                        {rec.suggestedAction}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
