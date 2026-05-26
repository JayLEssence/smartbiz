'use client'

import { useState, useCallback } from 'react'
import { ProductList } from './product-list'
import { StockInForm } from './stock-in-form'
import { AddProductForm } from './add-product-form'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Package, PackagePlus, PlusCircle, History } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import { useAppStore } from '@/stores/app-store'

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
  const { currentBranchId } = useAppStore()
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
      if (currentBranchId) params.set('branchId', currentBranchId)
      const res = await fetch(`/api/inventory?${params.toString()}`)
      const json = await res.json()
      if (json.success) {
        setBatches(json.data)
      }
    } catch {
      // ignore
    } finally {
      setBatchesLoading(false)
    }
  }, [currentBranchId])

  return (
    <div className={isMobile ? 'p-4 pb-24' : 'p-4'}>
      <Tabs defaultValue="products" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="products" className="gap-1.5">
            <Package className="h-3.5 w-3.5" />
            Products
          </TabsTrigger>
          <TabsTrigger value="stockin" className="gap-1.5">
            <PackagePlus className="h-3.5 w-3.5" />
            Stock In
          </TabsTrigger>
          <TabsTrigger value="addproduct" className="gap-1.5">
            <PlusCircle className="h-3.5 w-3.5" />
            Add Product
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5" onClick={fetchBatches}>
            <History className="h-3.5 w-3.5" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <ProductList key={refreshKey} branchId={currentBranchId} onRefresh={handleRefresh} />
        </TabsContent>

        <TabsContent value="stockin">
          <div className="max-w-md">
            <StockInForm onStockIn={handleRefresh} branchId={currentBranchId} />
          </div>
        </TabsContent>

        <TabsContent value="addproduct">
          <div className="max-w-lg">
            <AddProductForm onProductAdded={handleRefresh} />
          </div>
        </TabsContent>

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
              <p className="text-sm">Click this tab to load stock history</p>
            </div>
          ) : (
            <div className="rounded-md border max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium">Product</th>
                    <th className="px-3 py-2 text-right font-medium">Qty</th>
                    <th className="px-3 py-2 text-right font-medium">Cost/Unit</th>
                    <th className="px-3 py-2 text-left font-medium hidden sm:table-cell">
                      Supplier
                    </th>
                    <th className="px-3 py-2 text-left font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => (
                    <tr key={batch.id} className="border-b">
                      <td className="px-3 py-2">
                        <span className="font-medium">
                          {batch.product?.name ?? 'Unknown'}
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
