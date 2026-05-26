'use client'

import { useState } from 'react'
import { usePosStore } from '@/stores/pos-store'
import { useAppStore } from '@/stores/app-store'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

interface CheckoutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CheckoutDialog({ open, onOpenChange }: CheckoutDialogProps) {
  const [processing, setProcessing] = useState(false)
  const [success, setSuccess] = useState(false)
  const { items, discount, getTotal, clearCart } = usePosStore()
  const { currentUser } = useAppStore()
  const total = getTotal()

  const handleCheckout = async () => {
    if (!currentUser) {
      toast.error('No user logged in')
      return
    }

    setProcessing(true)
    try {
      const saleItems = items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        salePricePerUnit: item.salePricePerUnit,
      }))

      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          items: saleItems,
          discount: discount,
        }),
      })

      const json = await res.json()

      if (json.success) {
        setSuccess(true)
        toast.success('Sale completed successfully!', {
          description: `Total: $${total.toFixed(2)}`,
        })
        setTimeout(() => {
          clearCart()
          setSuccess(false)
          onOpenChange(false)
        }, 1500)
      } else {
        toast.error('Checkout failed', {
          description: json.error ?? 'Unknown error',
        })
      }
    } catch {
      toast.error('Network error', {
        description: 'Could not complete the sale',
      })
    } finally {
      setProcessing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm Sale</DialogTitle>
          <DialogDescription>Review order details before completing</DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center justify-center py-8">
            <CheckCircle2 className="h-16 w-16 text-emerald-500 mb-3" />
            <p className="font-semibold text-lg">Sale Complete!</p>
            <p className="text-muted-foreground text-sm">
              Total: ${total.toFixed(2)}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {items.map((item) => (
                <div
                  key={item.productId}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-medium truncate block">
                      {item.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {item.quantity} x ${item.salePricePerUnit.toFixed(2)}
                    </span>
                  </div>
                  <span className="font-medium shrink-0 ml-4">
                    ${(item.quantity * item.salePricePerUnit).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-1">
              {discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-red-500">-${discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span className="text-emerald-600">${total.toFixed(2)}</span>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              Cashier: {currentUser?.name ?? 'Unknown'} ({currentUser?.role})
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={processing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCheckout}
                disabled={processing}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Confirm Sale'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
