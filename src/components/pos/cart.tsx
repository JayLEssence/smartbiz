'use client'

import { usePosStore, type PaymentMethod } from '@/stores/pos-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Minus, Plus, Trash2, CreditCard, User, Phone } from 'lucide-react'
import { useCurrency } from '@/hooks/use-currency'

const MOBILE_MONEY_METHODS: PaymentMethod[] = ['M-Pesa', 'Tigo Pesa', 'Airtel Money']

const PAYMENT_METHOD_COLORS: Record<PaymentMethod, string> = {
  Cash: 'bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200',
  'M-Pesa': 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200',
  'Tigo Pesa': 'bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200',
  'Airtel Money': 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200',
  Card: 'bg-purple-100 text-purple-700 border-purple-300 hover:bg-purple-200',
  Credit: 'bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200',
}

const PAYMENT_METHOD_ACTIVE_COLORS: Record<PaymentMethod, string> = {
  Cash: 'bg-emerald-600 text-white border-emerald-600',
  'M-Pesa': 'bg-green-600 text-white border-green-600',
  'Tigo Pesa': 'bg-blue-600 text-white border-blue-600',
  'Airtel Money': 'bg-red-600 text-white border-red-600',
  Card: 'bg-purple-600 text-white border-purple-600',
  Credit: 'bg-amber-600 text-white border-amber-600',
}

interface CartProps {
  onCheckout: () => void
}

export function Cart({ onCheckout }: CartProps) {
  const {
    items, discount, setDiscount, updateQuantity, removeItem, clearCart,
    getSubtotal, getTotal, paymentMethod, setPaymentMethod,
    customerName, setCustomerName, phoneNumber, setPhoneNumber,
  } = usePosStore()
  const { formatDual, formatLocal, formatUSD, toUSD } = useCurrency()

  const subtotal = getSubtotal()
  const total = getTotal()
  const isMobileMoney = MOBILE_MONEY_METHODS.includes(paymentMethod)

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
            <p className="text-xs mt-1">Search or scan products to add</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y">
            {items.map((item) => (
              <div key={item.productId} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDual(item.salePricePerUnit)} each
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
                  <span className="font-semibold text-sm text-right">
                    {formatLocal(item.quantity * item.salePricePerUnit)}
                    <br />
                    <span className="text-xs font-normal text-muted-foreground">
                      {formatUSD(toUSD(item.quantity * item.salePricePerUnit))}
                    </span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="border-t p-4 space-y-3">
          {/* Customer Name */}
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer name (optional)"
              className="h-8 text-sm"
            />
          </div>

          {/* Payment Method Selector */}
          <div>
            <span className="text-xs text-muted-foreground mb-1.5 block">Payment Method</span>
            <div className="flex flex-wrap gap-1.5">
              {(['Cash', 'M-Pesa', 'Tigo Pesa', 'Airtel Money', 'Card', 'Credit'] as PaymentMethod[]).map((method) => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                    paymentMethod === method
                      ? PAYMENT_METHOD_ACTIVE_COLORS[method]
                      : PAYMENT_METHOD_COLORS[method]
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          {/* Phone Number for Mobile Money */}
          {isMobileMoney && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder={`${paymentMethod} phone number`}
                className="h-8 text-sm"
              />
            </div>
          )}

          {/* Customer Name required for Credit */}
          {paymentMethod === 'Credit' && !customerName && (
            <p className="text-xs text-amber-600">
              Customer name is required for credit sales
            </p>
          )}

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-right">
              {formatLocal(subtotal)}
              <br />
              <span className="text-xs text-muted-foreground">{formatUSD(toUSD(subtotal))}</span>
            </span>
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
            <div className="text-right">
              <span className="text-xl font-bold text-emerald-600 block">
                {formatLocal(total)}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatUSD(toUSD(total))}
              </span>
            </div>
          </div>

          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-11"
            onClick={onCheckout}
            disabled={paymentMethod === 'Credit' && !customerName.trim()}
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Checkout via {paymentMethod}
          </Button>
        </div>
      )}
    </div>
  )
}
