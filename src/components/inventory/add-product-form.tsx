'use client'

import { useState, useEffect } from 'react'
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
import { Loader2, PlusCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/stores/app-store'
import { apiGet, apiPost } from '@/lib/auth-fetch'

interface Branch {
  id: string
  name: string
  code: string
}

interface AddProductFormProps {
  onProductAdded?: () => void
}

const CATEGORIES = [
  'Beverages',
  'Snacks',
  'Dairy',
  'Bakery',
  'Household',
  'Personal Care',
  'Frozen',
  'Produce',
  'Other',
]

export function AddProductForm({ onProductAdded }: AddProductFormProps) {
  const { currentUser, branches } = useAppStore()
  const isAdmin = currentUser?.role === 'CompanyAdmin'

  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [barcode, setBarcode] = useState('')
  const [category, setCategory] = useState('')
  const [initialStock, setInitialStock] = useState('')
  const [reorderThreshold, setReorderThreshold] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [branchId, setBranchId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [branchList, setBranchList] = useState<Branch[]>([])

  useEffect(() => {
    if (branches.length > 0) {
      setBranchList(branches)
    } else {
      apiGet('/api/branches')
        .then((res) => res.json())
        .then((json) => {
          if (json.success) {
            setBranchList(json.data)
          }
        })
        .catch(() => {
          // ignore
        })
    }
  }, [branches])

  // Auto-select branch for cashiers
  useEffect(() => {
    if (!isAdmin && currentUser?.branchId) {
      setBranchId(currentUser.branchId)
    }
  }, [isAdmin, currentUser?.branchId])

  const resetForm = () => {
    setName('')
    setSku('')
    setBarcode('')
    setCategory('')
    setInitialStock('')
    setReorderThreshold('')
    setSalePrice('')
    if (!isAdmin && currentUser?.branchId) {
      setBranchId(currentUser.branchId)
    } else {
      setBranchId('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name || !sku || !category || !initialStock || !reorderThreshold || !salePrice || !branchId) {
      toast.error('Please fill in all required fields')
      return
    }

    setSubmitting(true)
    try {
      const res = await apiPost('/api/products', {
        name,
        sku,
        barcode: barcode || undefined,
        category,
        currentStockLevel: parseInt(initialStock),
        reorderThreshold: parseInt(reorderThreshold),
        defaultSalePrice: parseFloat(salePrice),
        branchId,
        companyId: currentUser?.companyId,
      })

      const json = await res.json()
      if (json.success) {
        toast.success('Product registered successfully!', {
          description: `${name} (${sku}) has been added`,
        })
        resetForm()
        onProductAdded?.()
      } else {
        toast.error('Failed to register product', {
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
          <PlusCircle className="h-4 w-4 text-emerald-600" />
          Register New Product
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="product-name" className="text-xs">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="product-name"
              placeholder="Product name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="product-sku" className="text-xs">
                SKU <span className="text-red-500">*</span>
              </Label>
              <Input
                id="product-sku"
                placeholder="e.g. BEV-001"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-barcode" className="text-xs">
                Barcode
              </Label>
              <Input
                id="product-barcode"
                placeholder="Optional"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="product-category" className="text-xs">
              Category <span className="text-red-500">*</span>
            </Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="product-category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="initial-stock" className="text-xs">
                Initial Stock <span className="text-red-500">*</span>
              </Label>
              <Input
                id="initial-stock"
                type="number"
                min="0"
                value={initialStock}
                onChange={(e) => setInitialStock(e.target.value)}
                placeholder="0"
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reorder-threshold" className="text-xs">
                Reorder Threshold <span className="text-red-500">*</span>
              </Label>
              <Input
                id="reorder-threshold"
                type="number"
                min="0"
                value={reorderThreshold}
                onChange={(e) => setReorderThreshold(e.target.value)}
                placeholder="0"
                className="text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sale-price" className="text-xs">
                Sale Price ($) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="sale-price"
                type="number"
                min="0"
                step="0.01"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                placeholder="0.00"
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-branch" className="text-xs">
                Branch <span className="text-red-500">*</span>
              </Label>
              <Select
                value={branchId}
                onValueChange={setBranchId}
                disabled={!isAdmin}
              >
                <SelectTrigger id="product-branch">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branchList.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name} ({branch.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Registering...
              </>
            ) : (
              <>
                <PlusCircle className="h-4 w-4 mr-2" />
                Register Product
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
