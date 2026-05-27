'use client'

import { useState, useEffect, useCallback } from 'react'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, PackagePlus } from 'lucide-react'
import { toast } from 'sonner'
import { getAuthHeaders, checkUnauthorized } from '@/lib/auth-fetch'

interface Product {
  id: string
  name: string
  sku: string
}

interface StockInFormProps {
  onStockIn?: () => void
  branchId?: string | null
  companyId?: string | null
}

export function StockInForm({ onStockIn, branchId, companyId }: StockInFormProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [supplier, setSupplier] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const fetchProducts = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (companyId) params.set('companyId', companyId)
      if (branchId) params.set('branchId', branchId)
      const res = await fetch(`/api/products?${params.toString()}`, { headers: getAuthHeaders() })
      if (checkUnauthorized(res)) return
      const json = await res.json()
      if (json.success) {
        setProducts(json.data)
      }
    } catch {
      // ignore
    }
  }, [branchId, companyId])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  const filteredProducts = searchTerm
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.sku.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : products

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProductId || !quantity || !purchasePrice) {
      toast.error('Please fill in all required fields')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          productId: selectedProductId,
          quantityAdded: parseInt(quantity),
          purchasePricePerUnit: parseFloat(purchasePrice),
          supplier: supplier || undefined,
          branchId: branchId || undefined,
          companyId: companyId || undefined,
        }),
      })

      const json = await res.json()
      if (json.success) {
        toast.success('Stock added successfully!', {
          description: `Added ${quantity} units`,
        })
        setSelectedProductId('')
        setQuantity('')
        setPurchasePrice('')
        setSupplier('')
        setSearchTerm('')
        onStockIn?.()
      } else {
        toast.error('Failed to add stock', {
          description: json.error ?? 'Unknown error',
        })
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <PackagePlus className="h-4 w-4 text-emerald-600" />
          Stock In
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="product-select" className="text-xs">
              Product *
            </Label>
            <div className="space-y-2">
              <Input
                placeholder="Search product..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="text-sm"
              />
              <Select
                value={selectedProductId}
                onValueChange={setSelectedProductId}
              >
                <SelectTrigger id="product-select">
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {filteredProducts.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} ({product.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="quantity" className="text-xs">
                Quantity *
              </Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchasePrice" className="text-xs">
                Cost/Unit ($) *
              </Label>
              <Input
                id="purchasePrice"
                type="number"
                min="0"
                step="0.01"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="0.00"
                className="text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="supplier" className="text-xs">
              Supplier (optional)
            </Label>
            <Input
              id="supplier"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="Supplier name"
              className="text-sm"
            />
          </div>

          <Button
            type="submit"
            disabled={submitting || !selectedProductId}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding Stock...
              </>
            ) : (
              'Add Stock'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
