'use client'

import { useState, useEffect } from 'react'
import { ProductSearch } from './product-search'
import { Cart } from './cart'
import { CheckoutDialog } from './checkout-dialog'
import { useIsMobile } from '@/hooks/use-mobile'
import { usePosStore } from '@/stores/pos-store'
import { useAppStore } from '@/stores/app-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

interface QuickProduct {
  id: string
  name: string
  sku: string
  defaultSalePrice: number
  currentStockLevel: number
}

export function PosView() {
  const isMobile = useIsMobile()
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [quickProducts, setQuickProducts] = useState<QuickProduct[]>([])
  const addItem = usePosStore((s) => s.addItem)
  const { currentBranchId } = useAppStore()

  useEffect(() => {
    const fetchQuickProducts = async () => {
      try {
        const params = new URLSearchParams({ period: 'daily', sortBy: 'quantity' })
        if (currentBranchId) params.set('branchId', currentBranchId)
        const res = await fetch(`/api/analytics/best-sellers?${params.toString()}`)
        const json = await res.json()
        if (json.success && json.data?.length > 0) {
          setQuickProducts(
            json.data.slice(0, 8).map((item: { productId: string; productName: string; productSku: string; salePrice: number; currentStock?: number }) => ({
              id: item.productId,
              name: item.productName,
              sku: item.productSku,
              defaultSalePrice: item.salePrice,
              currentStockLevel: item.currentStock ?? 0,
            }))
          )
        }
      } catch {
        // fallback: load all products
        try {
          const params = new URLSearchParams()
          if (currentBranchId) params.set('branchId', currentBranchId)
          const res = await fetch(`/api/products?${params.toString()}`)
          const json = await res.json()
          if (json.success) {
            setQuickProducts(
              json.data.slice(0, 8).map((p: QuickProduct) => ({
                id: p.id,
                name: p.name,
                sku: p.sku,
                defaultSalePrice: p.defaultSalePrice,
                currentStockLevel: p.currentStockLevel,
              }))
            )
          }
        } catch {
          // ignore
        }
      }
    }
    fetchQuickProducts()
  }, [currentBranchId])

  const handleQuickAdd = (product: QuickProduct) => {
    addItem({
      productId: product.id,
      name: product.name,
      sku: product.sku,
      salePricePerUnit: product.defaultSalePrice,
      maxStock: product.currentStockLevel,
    })
  }

  if (isMobile) {
    return (
      <div className="flex flex-col gap-4 p-4 pb-24">
        <ProductSearch branchId={currentBranchId} />
        <div>
          <h3 className="text-sm font-medium mb-2">Quick Add</h3>
          <div className="grid grid-cols-2 gap-2">
            {quickProducts.map((product) => (
              <Button
                key={product.id}
                variant="outline"
                size="sm"
                className="justify-start h-auto py-2 px-3 text-left"
                onClick={() => handleQuickAdd(product)}
                disabled={product.currentStockLevel === 0}
              >
                <Plus className="h-3 w-3 mr-1 shrink-0" />
                <span className="truncate text-xs">{product.name}</span>
              </Button>
            ))}
          </div>
        </div>
        <Card className="flex-1 min-h-[300px]">
          <Cart onCheckout={() => setCheckoutOpen(true)} />
        </Card>
        <CheckoutDialog open={checkoutOpen} onOpenChange={setCheckoutOpen} />
      </div>
    )
  }

  return (
    <div className="flex h-full gap-4 p-4">
      {/* Left: Product Search + Quick Add */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        <ProductSearch branchId={currentBranchId} />
        <Card className="flex-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Quick Add</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {quickProducts.map((product) => (
                <Button
                  key={product.id}
                  variant="outline"
                  className="h-auto py-3 px-3 justify-start"
                  onClick={() => handleQuickAdd(product)}
                  disabled={product.currentStockLevel === 0}
                >
                  <Plus className="h-4 w-4 mr-2 shrink-0 text-emerald-600" />
                  <div className="flex flex-col items-start min-w-0">
                    <span className="truncate text-xs font-medium">
                      {product.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ${product.defaultSalePrice.toFixed(2)}
                    </span>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right: Cart */}
      <Card className="w-[380px] shrink-0 flex flex-col">
        <Cart onCheckout={() => setCheckoutOpen(true)} />
      </Card>

      <CheckoutDialog open={checkoutOpen} onOpenChange={setCheckoutOpen} />
    </div>
  )
}
