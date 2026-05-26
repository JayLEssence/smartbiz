'use client'

import { useState, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, Package } from 'lucide-react'

interface Product {
  id: string
  name: string
  sku: string
  category: string
  currentStockLevel: number
  reorderThreshold: number
  defaultSalePrice: number
}

interface InventoryBatch {
  id: string
  quantityAdded: number
  purchasePricePerUnit: number
  supplier: string | null
  dateReceived: string
}

export function ProductList() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>('all')
  const [categories, setCategories] = useState<string[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [batches, setBatches] = useState<InventoryBatch[]>([])
  const [batchesLoading, setBatchesLoading] = useState(false)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (category && category !== 'all') params.set('category', category)

      const res = await fetch(`/api/products?${params.toString()}`)
      const json = await res.json()
      if (json.success) {
        setProducts(json.data)
        // Extract categories
        const cats = [...new Set(json.data.map((p: Product) => p.category))] as string[]
        setCategories(cats)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [search, category])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  const handleViewBatches = async (product: Product) => {
    setSelectedProduct(product)
    setBatchesLoading(true)
    try {
      const res = await fetch(`/api/inventory?productId=${product.id}`)
      const json = await res.json()
      if (json.success) {
        setBatches(json.data)
      }
    } catch {
      // ignore
    } finally {
      setBatchesLoading(false)
    }
  }

  const getStockBadge = (product: Product) => {
    if (product.currentStockLevel === 0) {
      return <Badge variant="destructive">Out of Stock</Badge>
    }
    if (product.currentStockLevel <= product.reorderThreshold) {
      return (
        <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
          Low Stock
        </Badge>
      )
    }
    return (
      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
        In Stock
      </Badge>
    )
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Package className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-sm">No products found</p>
        </div>
      ) : (
        <div className="rounded-md border max-h-[500px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">SKU</TableHead>
                <TableHead className="hidden md:table-cell">Category</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Price</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow
                  key={product.id}
                  className="cursor-pointer"
                  onClick={() => handleViewBatches(product)}
                >
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    {product.sku}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {product.category}
                  </TableCell>
                  <TableCell className="text-right">
                    {product.currentStockLevel}
                    <span className="text-xs text-muted-foreground">
                      /{product.reorderThreshold}
                    </span>
                  </TableCell>
                  <TableCell className="text-right hidden sm:table-cell">
                    ${product.defaultSalePrice.toFixed(2)}
                  </TableCell>
                  <TableCell>{getStockBadge(product)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={!!selectedProduct}
        onOpenChange={(open) => !open && setSelectedProduct(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedProduct?.name} — Stock History
            </DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-3">
              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Current Stock: </span>
                  <span className="font-semibold">
                    {selectedProduct.currentStockLevel}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Price: </span>
                  <span className="font-semibold">
                    ${selectedProduct.defaultSalePrice.toFixed(2)}
                  </span>
                </div>
              </div>
              {batchesLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : batches.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No stock history available
                </p>
              ) : (
                <div className="max-h-64 overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Qty Added</TableHead>
                        <TableHead className="text-right">Cost/Unit</TableHead>
                        <TableHead className="hidden sm:table-cell">Supplier</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batches.map((batch) => (
                        <TableRow key={batch.id}>
                          <TableCell className="text-sm">
                            {new Date(batch.dateReceived).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            +{batch.quantityAdded}
                          </TableCell>
                          <TableCell className="text-right">
                            ${batch.purchasePricePerUnit.toFixed(2)}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground">
                            {batch.supplier ?? '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
