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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Search,
  Package,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  CircleOff,
  Trash2,
  Loader2,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/stores/app-store'

type TrendingType = 'up' | 'down' | 'stable' | 'new' | 'no-sales'

interface Product {
  id: string
  name: string
  sku: string
  category: string
  currentStockLevel: number
  reorderThreshold: number
  defaultSalePrice: number
  trending: TrendingType
}

interface InventoryBatch {
  id: string
  quantityAdded: number
  purchasePricePerUnit: number
  supplier: string | null
  dateReceived: string
}

interface ProductListProps {
  branchId?: string | null
  companyId?: string | null
  onRefresh?: () => void
}

function TrendingIndicator({ trending }: { trending: TrendingType }) {
  switch (trending) {
    case 'up':
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Sales trending up</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    case 'down':
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center justify-center">
                <TrendingDown className="h-4 w-4 text-red-500" />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Sales trending down</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    case 'stable':
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center justify-center">
                <Minus className="h-4 w-4 text-gray-400" />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Stable sales</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    case 'new':
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-sky-500" />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>New product</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    case 'no-sales':
    default:
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center justify-center">
                <CircleOff className="h-4 w-4 text-gray-400" />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>No sales recorded</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
  }
}

function TrendingBadge({ trending }: { trending: TrendingType }) {
  switch (trending) {
    case 'up':
      return (
        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 gap-1">
          <TrendingUp className="h-3 w-3" /> Trending Up
        </Badge>
      )
    case 'down':
      return (
        <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 gap-1">
          <TrendingDown className="h-3 w-3" /> Declining
        </Badge>
      )
    case 'stable':
      return (
        <Badge className="bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100 gap-1">
          <Minus className="h-3 w-3" /> Stable
        </Badge>
      )
    case 'new':
      return (
        <Badge className="bg-sky-100 text-sky-700 border-sky-200 hover:bg-sky-100 gap-1">
          <Sparkles className="h-3 w-3" /> New
        </Badge>
      )
    case 'no-sales':
    default:
      return (
        <Badge className="bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-100 gap-1">
          <CircleOff className="h-3 w-3" /> No Sales
        </Badge>
      )
  }
}

export function ProductList({ branchId, companyId, onRefresh }: ProductListProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>('all')
  const [categories, setCategories] = useState<string[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [batches, setBatches] = useState<InventoryBatch[]>([])
  const [batchesLoading, setBatchesLoading] = useState(false)

  // Delete dialog state
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { currentUser } = useAppStore()
  const canDelete = currentUser?.role === 'CompanyAdmin' || currentUser?.role === 'Manager'

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (category && category !== 'all') params.set('category', category)
      if (companyId) params.set('companyId', companyId)
      if (branchId) params.set('branchId', branchId)

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
  }, [search, category, branchId, companyId])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  const handleViewBatches = async (product: Product) => {
    setSelectedProduct(product)
    setBatchesLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('productId', product.id)
      if (branchId) params.set('branchId', branchId)
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
  }

  const handleDelete = async () => {
    if (!deleteProduct) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/products/${deleteProduct.id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Product deactivated', {
          description: `${deleteProduct.name} has been deactivated`,
        })
        setDeleteProduct(null)
        fetchProducts()
        onRefresh?.()
      } else {
        toast.error('Failed to deactivate product', {
          description: json.error ?? 'Unknown error',
        })
      }
    } catch {
      toast.error('Network error')
    } finally {
      setDeleting(false)
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
                <TableHead className="text-center">Trend</TableHead>
                {canDelete && <TableHead className="w-10"></TableHead>}
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
                  <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                    <TrendingIndicator trending={product.trending} />
                  </TableCell>
                  {canDelete && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                        onClick={() => setDeleteProduct(product)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Product detail dialog */}
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
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Trend:</span>
                  <TrendingBadge trending={selectedProduct.trending} />
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

      {/* Delete confirmation dialog - only rendered for Manager+ */}
      {canDelete && (
        <AlertDialog
          open={!!deleteProduct}
          onOpenChange={(open) => !open && setDeleteProduct(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Deactivate Product
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3 pt-1">
                  <p>
                    Are you sure you want to deactivate this product? This action can be reversed by an administrator.
                  </p>
                  {deleteProduct && (
                    <div className="rounded-md border bg-muted/50 p-3 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Product</span>
                        <span className="font-medium">{deleteProduct.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">SKU</span>
                        <span className="font-medium font-mono">{deleteProduct.sku}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Current Stock</span>
                        <span className="font-medium">{deleteProduct.currentStockLevel} units</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Trending</span>
                        <TrendingBadge trending={deleteProduct.trending} />
                      </div>
                    </div>
                  )}
                  {deleteProduct?.trending === 'down' && (
                    <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                      <TrendingDown className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>This product has declining sales. Consider adjusting pricing or promotions before deactivating.</span>
                    </div>
                  )}
                  <p className="text-muted-foreground text-xs">
                    This will deactivate the product. It will no longer appear in the product list or POS system.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deactivating...
                  </>
                ) : (
                  'Deactivate Product'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
