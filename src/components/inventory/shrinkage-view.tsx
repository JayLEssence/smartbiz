'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Loader2, DollarSign, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useIsMobile } from '@/hooks/use-mobile'
import { useAppStore } from '@/stores/app-store'
import { useLanguage } from '@/lib/i18n/language-context'

interface Product {
  id: string
  name: string
  sku: string
}

interface ShrinkageRecord {
  id: string
  productId: string
  quantityLost: number
  reason: string
  dateRecorded: string
  product: { name: string; sku: string }
  financialLoss?: number
}

export function ShrinkageView() {
  const isMobile = useIsMobile()
  const { currentBranchId, currentUser } = useAppStore()
  const { t } = useLanguage()
  const companyId = currentUser?.companyId
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [quantityLost, setQuantityLost] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [records, setRecords] = useState<ShrinkageRecord[]>([])
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [totalLoss, setTotalLoss] = useState(0)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const fetchProducts = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (companyId) params.set('companyId', companyId)
      if (currentBranchId) params.set('branchId', currentBranchId)
      const res = await fetch(`/api/products?${params.toString()}`)
      const json = await res.json()
      if (json.success) setProducts(json.data)
    } catch {
      // ignore
    }
  }, [currentBranchId, companyId])

  const fetchRecords = useCallback(async () => {
    setRecordsLoading(true)
    try {
      const params = new URLSearchParams()
      if (companyId) params.set('companyId', companyId)
      if (currentBranchId) params.set('branchId', currentBranchId)
      if (dateFrom) params.set('from', new Date(dateFrom).toISOString())
      if (dateTo) params.set('to', new Date(dateTo).toISOString())

      const res = await fetch(`/api/shrinkage?${params.toString()}`)
      const json = await res.json()
      if (json.success) {
        setRecords(json.data)
        const loss = json.data.reduce(
          (sum: number, r: ShrinkageRecord) => sum + (r.financialLoss ?? 0),
          0
        )
        setTotalLoss(loss)
      }
    } catch {
      // ignore
    } finally {
      setRecordsLoading(false)
    }
  }, [dateFrom, dateTo, currentBranchId, companyId])

  useEffect(() => {
    fetchProducts()
    fetchRecords()
  }, [fetchProducts, fetchRecords])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProductId || !quantityLost || !reason) {
      toast.error(t('shrinkage.fillRequired'))
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/shrinkage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProductId,
          quantityLost: parseInt(quantityLost),
          reason,
          branchId: currentBranchId ?? undefined,
          companyId: companyId ?? undefined,
        }),
      })

      const json = await res.json()
      if (json.success) {
        toast.success(t('shrinkage.shrinkageRecorded'), {
          description: `${quantityLost} ${t('shrinkage.units')} — ${reason}`,
        })
        setSelectedProductId('')
        setQuantityLost('')
        setReason('')
        fetchRecords()
      } else {
        toast.error(t('shrinkage.failedToRecord'), {
          description: json.error ?? t('shrinkage.unknown'),
        })
      }
    } catch {
      toast.error(t('shrinkage.networkError'))
    } finally {
      setSubmitting(false)
    }
  }

  const getReasonBadge = (r: string) => {
    switch (r) {
      case 'Stolen':
        return <Badge variant="destructive">{t('shrinkage.stolen')}</Badge>
      case 'Expired':
        return (
          <Badge className="bg-amber-100 text-amber-700 border-amber-200">
            {t('shrinkage.expired')}
          </Badge>
        )
      case 'Damaged':
        return (
          <Badge className="bg-orange-100 text-orange-700 border-orange-200">
            {t('shrinkage.damaged')}
          </Badge>
        )
      default:
        return <Badge variant="outline">{r}</Badge>
    }
  }

  return (
    <div className={isMobile ? 'p-4 pb-24' : 'p-4'}>
      {/* Total Loss Summary */}
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
              <DollarSign className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('shrinkage.totalFinancialLoss')}</p>
              <p className="text-2xl font-bold text-red-600">
                ${totalLoss.toFixed(2)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div
        className={
          isMobile
            ? 'flex flex-col gap-4'
            : 'grid grid-cols-[320px_1fr] gap-4'
        }
      >
        {/* Record Shrinkage Form */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              {t('shrinkage.recordShrinkage')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">{t('shrinkage.product')} *</Label>
                <Select
                  value={selectedProductId}
                  onValueChange={setSelectedProductId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('shrinkage.selectProduct')} />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} ({product.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">{t('shrinkage.quantityLost')} *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={quantityLost}
                    onChange={(e) => setQuantityLost(e.target.value)}
                    placeholder="0"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">{t('shrinkage.reason')} *</Label>
                  <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('shrinkage.reason')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Stolen">{t('shrinkage.stolen')}</SelectItem>
                      <SelectItem value="Expired">{t('shrinkage.expired')}</SelectItem>
                      <SelectItem value="Damaged">{t('shrinkage.damaged')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('shrinkage.recording')}
                  </>
                ) : (
                  t('shrinkage.recordShrinkage')
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Shrinkage Records */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">{t('shrinkage.recentRecords')}</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={fetchRecords}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Date Filters */}
            <div className="flex gap-2 mb-4">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="text-xs h-8"
                placeholder="From"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="text-xs h-8"
                placeholder="To"
              />
            </div>

            {recordsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-10 bg-muted animate-pulse rounded-md"
                  />
                ))}
              </div>
            ) : records.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">{t('shrinkage.noRecords')}</p>
              </div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto space-y-2">
                {records.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {record.product?.name ?? t('shrinkage.unknown')}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {getReasonBadge(record.reason)}
                        <span className="text-xs text-muted-foreground">
                          -{record.quantityLost} {t('shrinkage.units')}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0 ml-3">
                      <span className="text-sm font-medium text-red-600">
                        -${(record.financialLoss ?? 0).toFixed(2)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(record.dateRecorded).toLocaleDateString()}
                      </span>
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
