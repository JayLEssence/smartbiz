'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePosStore } from '@/stores/pos-store'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCurrency } from '@/hooks/use-currency'
import { apiGet } from '@/lib/auth-fetch'

interface Product {
  id: string
  name: string
  sku: string
  barcode: string | null
  category: string
  currentStockLevel: number
  defaultSalePrice: number
}

interface ProductSearchProps {
  branchId?: string | null
  companyId?: string | null
}

export function ProductSearch({ branchId, companyId }: ProductSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const addItem = usePosStore((s) => s.addItem)
  const { formatDualUSD } = useCurrency()

  const searchProducts = useCallback(async (search: string) => {
    if (!search.trim()) {
      setResults([])
      setShowDropdown(false)
      return
    }
    setLoading(true)
    try {
      const params = new URLSearchParams({ search })
      if (companyId) params.set('companyId', companyId)
      if (branchId) params.set('branchId', branchId)
      const res = await apiGet(`/api/products?${params.toString()}`)
      const json = await res.json()
      if (json.success) {
        setResults(json.data)
        setShowDropdown(json.data.length > 0)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [branchId, companyId])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      searchProducts(query)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, searchProducts])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (product: Product) => {
    addItem({
      productId: product.id,
      name: product.name,
      sku: product.sku,
      salePricePerUnit: product.defaultSalePrice,
      maxStock: product.currentStockLevel,
    })
    setQuery('')
    setResults([])
    setShowDropdown(false)
  }

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const trimmed = query.trim()
      if (!trimmed) return

      // Try barcode exact match first
      try {
        const params = new URLSearchParams({ search: trimmed })
        if (companyId) params.set('companyId', companyId)
        if (branchId) params.set('branchId', branchId)
        const res = await apiGet(`/api/products?${params.toString()}`)
        const json = await res.json()
        if (json.success && json.data.length === 1) {
          handleSelect(json.data[0])
        } else if (json.success && json.data.length > 1) {
          // Show dropdown if multiple matches
          setResults(json.data)
          setShowDropdown(true)
        }
      } catch {
        // ignore
      }
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Scan barcode or search product..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="pl-9 pr-4"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          </div>
        )}
      </div>
      {showDropdown && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-64 overflow-y-auto">
          {results.map((product) => (
            <button
              key={product.id}
              className={cn(
                'flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent transition-colors',
                (product.currentStockLevel ?? 0) === 0 && 'opacity-50'
              )}
              onClick={() => handleSelect(product)}
              disabled={(product.currentStockLevel ?? 0) === 0}
            >
              <div className="flex flex-col items-start">
                <span className="font-medium">{product.name}</span>
                <span className="text-xs text-muted-foreground">
                  SKU: {product.sku}
                  {product.barcode ? ` | ${product.barcode}` : ''}
                </span>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span className="font-semibold text-emerald-600">
                  {formatDualUSD(product.defaultSalePrice ?? 0)}
                </span>
                <span
                  className={cn(
                    'text-xs',
                    (product.currentStockLevel ?? 0) > 0
                      ? 'text-muted-foreground'
                      : 'text-red-500'
                  )}
                >
                  Stock: {product.currentStockLevel ?? 0}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
