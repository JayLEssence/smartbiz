'use client'

import { useState, useCallback } from 'react'
import { ProductList } from './product-list'
import { StockInForm } from './stock-in-form'
import { AddProductForm } from './add-product-form'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Package, PackagePlus, PlusCircle, History } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import { useAppStore } from '@/stores/app-store'
import { useLanguage } from '@/lib/i18n/language-context'
import { getAuthHeaders } from '@/lib/auth-fetch'

interface InventoryBatch {
  id: string
  productId: string
  quantityAdded: number
  purchasePricePerUnit: number
  supplier: string | null
  dateReceived: string
  product: { name: string; sku: string }
}

export function InventoryView() {
  const isMobile = useIsMobile()
  const { t } = useLanguage()
  const { currentBranchId, currentUser } = useAppStore()
  const companyId = currentUser?.companyId
  const isEmployee = currentUser?.role === 'Employee'
  // Add Product tab: only CompanyAdmin and Manager
  const canAddProduct = currentUser?.role === 'CompanyAdmin' || currentUser?.role === 'Manager'
  // Stock In tab: only CompanyAdmin and Manager (employees just sell, they don't stock)
  const canStockIn = currentUser?.role === 'CompanyAdmin' || currentUser?.role === 'Manager'

  const [refreshKey, setRefreshKey] = useState(0)
  const [batches, setBatches] = useState<InventoryBatch[]>([])
  const [batchesLoading, setBatchesLoading] = useState(false)

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  const fetchBatches = useCallback(async () => {
    setBatchesLoading(true)
    try {
      const params = new URLSearchParams()
      if (companyId) params.set('companyId', companyId)
      if (currentBranchId) params.set('branchId', currentBranchId)
      const res = await fetch(`/api/inventory?${params.toString()}`, { headers: getAuthHeaders() })
      const json = await res.json()
      if (json.success) {
        setBatches(json.data)
      }
    } catch {
      // ignore
    } finally {
      setBatchesLoading(false)
    }
  }, [currentBranchId, companyId])

  return (
    <div className={isMobile ? 'p-4 pb-24' : 'p-4'}>
      <Tabs defaultValue="products" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="products" className="gap-1.5">
            <Package className="h-3.5 w-3.5" />
            {t('inventory.products')}
          </TabsTrigger>
          {canStockIn && (
            <TabsTrigger value="stockin" className="gap-1.5">
              <PackagePlus className="h-3.5 w-3.5" />
              {t('inventory.stockIn')}
            </TabsTrigger>
          )}
          {canAddProduct && (
            <TabsTrigger value="addproduct" className="gap-1.5">
              <PlusCircle className="h-3.5 w-3.5" />
              {t('inventory.addProduct')}
            </TabsTrigger>
          )}
          <TabsTrigger value="history" className="gap-1.5" onClick={fetchBatches}>
            <History className="h-3.5 w-3.5" />
            {t('inventory.history')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <ProductList key={refreshKey} branchId={currentBranchId} companyId={companyId} onRefresh={handleRefresh} />
        </TabsContent>

        {canStockIn && (
          <TabsContent value="stockin">
            <div className="max-w-md">
              <StockInForm onStockIn={handleRefresh} branchId={currentBranchId} companyId={companyId} />
            </div>
          </TabsContent>
        )}

        {canAddProduct && (
          <TabsContent value="addproduct">
            <div className="max-w-lg">
              <AddProductForm onProductAdded={handleRefresh} />
            </div>
          </TabsContent>
        )}

        <TabsContent value="history">
          {batchesLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-12 bg-muted animate-pulse rounded-md"
                />
              ))}
            </div>
          ) : batches.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{t('inventory.clickToLoadHistory')}</p>
            </div>
          ) : (
            <div className="rounded-md border max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium">{t('inventory.product')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('inventory.qty')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('inventory.costPerUnit')}</th>
                    <th className="px-3 py-2 text-left font-medium hidden sm:table-cell">
                      {t('inventory.supplier')}
                    </th>
                    <th className="px-3 py-2 text-left font-medium">{t('inventory.date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => (
                    <tr key={batch.id} className="border-b">
                      <td className="px-3 py-2">
                        <span className="font-medium">
                          {batch.product?.name ?? t('inventory.unknown')}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-emerald-600 font-medium">
                        +{batch.quantityAdded}
                      </td>
                      <td className="px-3 py-2 text-right">
                        ${batch.purchasePricePerUnit.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">
                        {batch.supplier ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">
                        {new Date(batch.dateReceived).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
