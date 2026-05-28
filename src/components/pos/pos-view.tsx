'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ProductSearch } from './product-search'
import { Cart } from './cart'
import { CheckoutDialog } from './checkout-dialog'
import { useIsMobile } from '@/hooks/use-mobile'
import { useCurrency } from '@/hooks/use-currency'
import { usePosStore } from '@/stores/pos-store'
import { useAppStore } from '@/stores/app-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, ScanBarcode, ScanLine, Camera } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/language-context'
import { toast } from 'sonner'
import { BarcodeScannerDialog } from './barcode-scanner-dialog'
import { apiGet } from '@/lib/auth-fetch'

interface QuickProduct {
  id: string
  name: string
  sku: string
  defaultSalePrice: number
  currentStockLevel: number
}

export function PosView() {
  const isMobile = useIsMobile()
  const { t } = useLanguage()
  const { formatDualUSD } = useCurrency()
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [quickProducts, setQuickProducts] = useState<QuickProduct[]>([])
  const [barcodeInput, setBarcodeInput] = useState('')
  const [barcodeSearching, setBarcodeSearching] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const barcodeRef = useRef<HTMLInputElement>(null)
  const addItem = usePosStore((s) => s.addItem)
  const { currentBranchId, currentUser } = useAppStore()
  const companyId = currentUser?.companyId

  useEffect(() => {
    const fetchQuickProducts = async () => {
      try {
        const params = new URLSearchParams({ period: 'daily', sortBy: 'quantity' })
        if (companyId) params.set('companyId', companyId)
        if (currentBranchId) params.set('branchId', currentBranchId)
        const res = await apiGet(`/api/analytics/best-sellers?${params.toString()}`)
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
          if (companyId) params.set('companyId', companyId)
          if (currentBranchId) params.set('branchId', currentBranchId)
          const res = await apiGet(`/api/products?${params.toString()}`)
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
  }, [currentBranchId, companyId])

  const handleQuickAdd = (product: QuickProduct) => {
    addItem({
      productId: product.id,
      name: product.name,
      sku: product.sku,
      salePricePerUnit: product.defaultSalePrice,
      maxStock: product.currentStockLevel,
    })
  }

  const handleBarcodeSearch = useCallback(async (barcode: string) => {
    if (!barcode.trim()) return
    setBarcodeSearching(true)
    try {
      const params = new URLSearchParams({ search: barcode.trim() })
      if (companyId) params.set('companyId', companyId)
      if (currentBranchId) params.set('branchId', currentBranchId)
      const res = await apiGet(`/api/products?${params.toString()}`)
      const json = await res.json()
      if (json.success && json.data.length > 0) {
        // Try to find exact barcode match first
        const exactMatch = json.data.find(
          (p: { barcode: string | null; id: string; name: string; sku: string; defaultSalePrice: number; currentStockLevel: number }) =>
            p.barcode === barcode.trim()
        )
        const product = exactMatch || json.data[0]
        addItem({
          productId: product.id,
          name: product.name,
          sku: product.sku,
          salePricePerUnit: product.defaultSalePrice,
          maxStock: product.currentStockLevel,
        })
        toast.success(`Added: ${product.name}`)
        setBarcodeInput('')
      } else {
        toast.error('Product not found', {
          description: `No product matching "${barcode.trim()}"`,
        })
      }
    } catch {
      toast.error('Search failed')
    } finally {
      setBarcodeSearching(false)
    }
  }, [addItem, companyId, currentBranchId])

  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleBarcodeSearch(barcodeInput)
    }
  }

  const BarcodeScannerInput = () => (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
        <Input
          ref={barcodeRef}
          placeholder="Scan barcode & press Enter..."
          value={barcodeInput}
          onChange={(e) => setBarcodeInput(e.target.value)}
          onKeyDown={handleBarcodeKeyDown}
          className="pl-9 pr-10 border-emerald-200 focus:border-emerald-400 focus:ring-emerald-400"
        />
        {barcodeSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          </div>
        )}
        {!barcodeSearching && barcodeInput && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600 hover:text-emerald-700"
            onClick={() => handleBarcodeSearch(barcodeInput)}
          >
            <ScanLine className="h-4 w-4" />
          </button>
        )}
      </div>
      <Button
        variant="outline"
        size="icon"
        className="shrink-0 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-600"
        onClick={() => setScannerOpen(true)}
        title="Camera Scanner"
      >
        <Camera className="h-4 w-4" />
      </Button>
    </div>
  )

  if (isMobile) {
    return (
      <div className="flex flex-col gap-4 p-4 pb-24">
        <BarcodeScannerInput />
        <ProductSearch branchId={currentBranchId} companyId={companyId} />
        <div>
          <h3 className="text-sm font-medium mb-2">{t('pos.quickAdd')}</h3>
          <div className="grid grid-cols-2 gap-2">
            {quickProducts.map((product) => (
              <Button
                key={product.id}
                variant="outline"
                size="sm"
                className="justify-start h-auto py-2 px-3 text-left"
                onClick={() => handleQuickAdd(product)}
                disabled={(product.currentStockLevel ?? 0) === 0}
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
        <BarcodeScannerDialog open={scannerOpen} onOpenChange={setScannerOpen} onBarcodeDetected={handleBarcodeSearch} />
      </div>
    )
  }

  return (
    <div className="flex h-full gap-4 p-4">
      {/* Left: Barcode + Product Search + Quick Add */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        <BarcodeScannerInput />
        <ProductSearch branchId={currentBranchId} companyId={companyId} />
        <Card className="flex-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{t('pos.quickAdd')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {quickProducts.map((product) => (
                <Button
                  key={product.id}
                  variant="outline"
                  className="h-auto py-3 px-3 justify-start"
                  onClick={() => handleQuickAdd(product)}
                  disabled={(product.currentStockLevel ?? 0) === 0}
                >
                  <Plus className="h-4 w-4 mr-2 shrink-0 text-emerald-600" />
                  <div className="flex flex-col items-start min-w-0">
                    <span className="truncate text-xs font-medium">
                      {product.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDualUSD(product.defaultSalePrice ?? 0)}
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
      <BarcodeScannerDialog open={scannerOpen} onOpenChange={setScannerOpen} onBarcodeDetected={handleBarcodeSearch} />
    </div>
  )
}
