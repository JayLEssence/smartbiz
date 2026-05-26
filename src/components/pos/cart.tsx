'use client'

import { usePosStore } from '@/stores/pos-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Minus, Plus, Trash2, CreditCard } from 'lucide-react'
import { toast } from 'sonner'

interface CartProps {
  onCheckout: () => void
}

export function Cart({ onCheckout }: CartProps) {
  const { items, discount, setDiscount, updateQuantity, removeItem, clearCart, getSubtotal, getTotal } =
    usePosStore()

  const subtotal = getSubtotal()
  const total = getTotal()

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="font-semibold text-sm">
          Cart ({items.length} {items.length === 1 ? 'item' : 'items'})
        </h2>
        {items.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearCart} className="text-xs text-muted-foreground">
            Clear All
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
            <CreditCard className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm">No items in cart</p>
            <p className="text-xs mt-1">Search for products to add</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y">
            {items.map((item) => (
              <div key={item.productId} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      ${item.salePricePerUnit.toFixed(2)} each
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-red-500 shrink-0"
                    onClick={() => removeItem(item.productId)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center text-sm font-medium">
                      {item.quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      disabled={item.quantity >= item.maxStock}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <span className="font-semibold text-sm">
                    ${(item.quantity * item.salePricePerUnit).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="border-t p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground shrink-0">Discount</span>
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={discount || ''}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                className="pl-6 h-8 text-sm"
                placeholder="0.00"
              />
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <span className="font-semibold">Total</span>
            <span className="text-xl font-bold text-emerald-600">
              ${total.toFixed(2)}
            </span>
          </div>

          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-11"
            onClick={onCheckout}
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Checkout
          </Button>
        </div>
      )}
    </div>
  )
}
