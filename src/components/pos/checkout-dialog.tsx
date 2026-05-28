'use client'

import { useState, useRef } from 'react'
import { usePosStore } from '@/stores/pos-store'
import { useAppStore } from '@/stores/app-store'
import { useCurrency } from '@/hooks/use-currency'
import { formatUSD as formatUSDAmount } from '@/lib/currency'
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
import { Input } from '@/components/ui/input'
import { Loader2, CheckCircle2, Printer, Download, Receipt, MessageCircle, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import { getAuthHeaders, checkUnauthorized } from '@/lib/auth-fetch'

interface CheckoutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface SaleResult {
  id: string
  receiptNumber: string
  totalAmount: number
  discount: number
  saleDate: string
  paymentMethod: string
  customerName: string | null
  user: { id: string; name: string; email: string; role: string }
  branch: { id: string; name: string; code: string }
  company: { id: string; name: string; currency: string; currencySymbol: string; exchangeRate: number }
  saleItems: {
    id: string
    quantitySold: number
    salePricePerUnit: number
    product: { id: string; name: string; sku: string }
  }[]
}

export function CheckoutDialog({ open, onOpenChange }: CheckoutDialogProps) {
  const [processing, setProcessing] = useState(false)
  const [success, setSuccess] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [saleResult, setSaleResult] = useState<SaleResult | null>(null)
  const [sharePhone, setSharePhone] = useState('')
  const { items, discount, getTotal, clearCart, paymentMethod, customerName, phoneNumber } = usePosStore()
  const { currentUser, currentBranchId } = useAppStore()
  const { formatLocal, formatDualUSD, toLocal, currency } = useCurrency()
  const total = getTotal()
  const receiptRef = useRef<HTMLDivElement>(null)

  const handleCheckout = async () => {
    if (!currentUser) {
      toast.error('No user logged in')
      return
    }

    if (paymentMethod === 'Credit' && !customerName.trim()) {
      toast.error('Customer name is required for credit sales')
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
        headers: getAuthHeaders(),
        body: JSON.stringify({
          userId: currentUser.id,
          items: saleItems,
          discount: discount,
          branchId: currentBranchId ?? currentUser.branchId,
          companyId: currentUser.companyId,
          paymentMethod,
          customerName: customerName.trim() || undefined,
          phoneNumber: phoneNumber.trim() || undefined,
        }),
      })

      const json = await res.json()

      if (json.success) {
        setSaleResult(json.data)
        setSuccess(true)
        toast.success('Sale completed successfully!', {
          description: `Receipt: ${json.data.receiptNumber}`,
        })
        // Show receipt after a short delay
        setTimeout(() => {
          setShowReceipt(true)
        }, 800)
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

  const handlePrintReceipt = () => {
    window.print()
  }

  const handleDownloadReceipt = () => {
    if (!saleResult) return

    const lines: string[] = []
    lines.push('═══════════════════════════════════')
    lines.push(`  ${saleResult.company.name}`)
    lines.push(`  Branch: ${saleResult.branch.name}`)
    lines.push('═══════════════════════════════════')
    lines.push('')
    lines.push(`Receipt: ${saleResult.receiptNumber}`)
    lines.push(`Date: ${new Date(saleResult.saleDate).toLocaleString()}`)
    lines.push(`Cashier: ${saleResult.user.name}`)
    if (saleResult.customerName) {
      lines.push(`Customer: ${saleResult.customerName}`)
    }
    lines.push(`Payment: ${saleResult.paymentMethod}`)
    lines.push('')
    lines.push('───────────────────────────────────')
    lines.push('Item                Qty  Price  Sub')
    lines.push('───────────────────────────────────')

    for (const item of saleResult.saleItems) {
      const name = item.product.name.length > 18 ? item.product.name.slice(0, 18) : item.product.name
      const sub = (item.quantitySold ?? 0) * (item.salePricePerUnit ?? 0)
      lines.push(`${name.padEnd(19)}${String(item.quantitySold).padStart(3)}  ${formatLocal(toLocal(item.salePricePerUnit ?? 0)).padStart(8)}  ${formatLocal(toLocal(sub)).padStart(8)}`)
      lines.push(`                    ${' '.repeat(11)}${formatUSDAmount(sub).padStart(8)}`)
    }

    lines.push('───────────────────────────────────')

    if ((saleResult.discount ?? 0) > 0) {
      lines.push(`Discount: ${formatDualUSD(saleResult.discount ?? 0)}`)
    }

    const finalTotal = saleResult.totalAmount
    lines.push('')
    lines.push(`TOTAL: ${formatDualUSD(finalTotal ?? 0)}`)
    lines.push('')
    lines.push('═══════════════════════════════════')
    lines.push('  Thank you for your business!')
    lines.push('═══════════════════════════════════')

    const text = lines.join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `receipt-${saleResult.receiptNumber}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleCloseReceipt = () => {
    clearCart()
    setShowReceipt(false)
    setSuccess(false)
    setSaleResult(null)
    setSharePhone('')
    onOpenChange(false)
  }

  const formatReceiptForWhatsApp = () => {
    if (!saleResult) return ''

    const lines: string[] = []
    lines.push(`🧾 *${saleResult.company.name}*`)
    lines.push(`📍 Branch: ${saleResult.branch.name}`)
    lines.push('───────────────────')
    lines.push(`📝 Receipt: ${saleResult.receiptNumber}`)
    lines.push(`📅 Date: ${new Date(saleResult.saleDate).toLocaleDateString()}`)
    lines.push(`🕐 Time: ${new Date(saleResult.saleDate).toLocaleTimeString()}`)
    lines.push(`👤 Cashier: ${saleResult.user.name}`)
    if (saleResult.customerName) {
      lines.push(`🛍️ Customer: ${saleResult.customerName}`)
    }
    lines.push(`💳 Payment: ${saleResult.paymentMethod}`)
    lines.push('───────────────────')
    lines.push('*Items:*')

    for (const item of saleResult.saleItems) {
      const sub = (item.quantitySold ?? 0) * (item.salePricePerUnit ?? 0)
      lines.push(`• ${item.product.name} × ${item.quantitySold} = ${formatDualUSD(sub)}`)
    }

    lines.push('───────────────────')

    if ((saleResult.discount ?? 0) > 0) {
      lines.push(`🏷️ Discount: -${formatDualUSD(saleResult.discount ?? 0)}`)
    }

    lines.push(`\n💰 *TOTAL: ${formatDualUSD(saleResult.totalAmount ?? 0)}*`)
    lines.push('\n🙏 Thank you for your business!')

    return lines.join('\n')
  }

  const handleShareWhatsApp = () => {
    const message = formatReceiptForWhatsApp()
    const encodedMessage = encodeURIComponent(message)

    // Use the sharePhone input if provided, otherwise use the POS store phone number
    const phone = sharePhone.trim() || phoneNumber.trim()

    if (phone) {
      // Clean phone number: remove spaces, dashes, parentheses; ensure it starts with country code
      let cleanPhone = phone.replace(/[\s\-()]/g, '')
      // If it starts with 0, replace with 255 (Tanzania default)
      if (cleanPhone.startsWith('0')) {
        cleanPhone = '255' + cleanPhone.substring(1)
      }
      // If it starts with +, remove the +
      if (cleanPhone.startsWith('+')) {
        cleanPhone = cleanPhone.substring(1)
      }
      window.open(`https://wa.me/${cleanPhone}?text=${encodedMessage}`, '_blank')
    } else {
      // No phone number - let user pick a contact in WhatsApp
      window.open(`https://wa.me/?text=${encodedMessage}`, '_blank')
    }

    toast.success('Opening WhatsApp...')
  }

  const handleShareSMS = () => {
    const message = formatReceiptForWhatsApp()
    const phone = sharePhone.trim() || phoneNumber.trim()

    if (phone) {
      window.open(`sms:${phone}?body=${encodeURIComponent(message)}`, '_blank')
    } else {
      window.open(`sms:?body=${encodeURIComponent(message)}`, '_blank')
    }

    toast.success('Opening SMS...')
  }

  // Receipt Modal
  if (showReceipt && saleResult) {
    return (
      <Dialog open={open} onOpenChange={handleCloseReceipt}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto print:shadow-none print:border-0">
          <DialogHeader className="print:hidden">
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-emerald-600" />
              Receipt
            </DialogTitle>
            <DialogDescription>Sale completed successfully</DialogDescription>
          </DialogHeader>

          {/* Receipt Content - this is what gets printed */}
          <div ref={receiptRef} className="bg-white p-6 rounded-lg border text-center print:border-0 print:p-0">
            {/* Header */}
            <div className="mb-4">
              <h3 className="text-lg font-bold">{saleResult.company.name}</h3>
              <p className="text-sm text-muted-foreground">Branch: {saleResult.branch.name}</p>
            </div>

            <Separator className="my-3" />

            {/* Receipt Info */}
            <div className="text-left text-sm space-y-1 mb-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Receipt #</span>
                <span className="font-mono font-semibold">{saleResult.receiptNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date</span>
                <span>{new Date(saleResult.saleDate).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Time</span>
                <span>{new Date(saleResult.saleDate).toLocaleTimeString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cashier</span>
                <span>{saleResult.user.name}</span>
              </div>
              {saleResult.customerName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer</span>
                  <span>{saleResult.customerName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment</span>
                <span className="font-medium">{saleResult.paymentMethod}</span>
              </div>
            </div>

            <Separator className="my-3" />

            {/* Items */}
            <div className="text-left text-sm">
              {saleResult.saleItems.map((item) => {
                const sub = (item.quantitySold ?? 0) * (item.salePricePerUnit ?? 0)
                return (
                  <div key={item.id} className="py-1.5 border-b border-dashed border-gray-200 last:border-0">
                    <div className="flex justify-between font-medium">
                      <span className="truncate mr-2">{item.product.name}</span>
                      <span className="shrink-0">{formatDualUSD(sub)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{item.quantitySold} × {formatDualUSD(item.salePricePerUnit ?? 0)}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            <Separator className="my-3" />

            {/* Totals */}
            <div className="text-left text-sm space-y-1">
              {(saleResult.discount ?? 0) > 0 && (
                <div className="flex justify-between text-red-500">
                  <span>Discount</span>
                  <span>-{formatDualUSD(saleResult.discount ?? 0)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base">
                <span>TOTAL</span>
                <span className="text-emerald-600">{formatDualUSD(saleResult.totalAmount ?? 0)}</span>
              </div>
            </div>

            <Separator className="my-3" />

            {/* Footer */}
            <p className="text-sm text-muted-foreground mt-2">
              Thank you for your business! 🙏
            </p>
          </div>

          {/* Share Phone Number Input */}
          <div className="print:hidden mt-3">
            <label className="text-xs text-muted-foreground mb-1 block">Phone number for sharing (optional)</label>
            <Input
              type="tel"
              placeholder={phoneNumber || "e.g. 0712345678"}
              value={sharePhone}
              onChange={(e) => setSharePhone(e.target.value)}
              className="h-8 text-sm"
            />
            {phoneNumber && !sharePhone && (
              <p className="text-[10px] text-muted-foreground mt-0.5">Using customer phone from POS: {phoneNumber}</p>
            )}
          </div>

          {/* Action Buttons */}
          <DialogFooter className="gap-2 sm:gap-0 print:hidden flex-wrap">
            <Button variant="outline" onClick={handleCloseReceipt}>
              Close
            </Button>
            <Button variant="outline" onClick={handleDownloadReceipt}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button
              onClick={handleShareWhatsApp}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              WhatsApp
            </Button>
            <Button
              variant="outline"
              onClick={handleShareSMS}
              className="text-blue-600 border-blue-300 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-700 dark:hover:bg-blue-950"
            >
              <Smartphone className="h-4 w-4 mr-2" />
              SMS
            </Button>
            <Button onClick={handlePrintReceipt} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
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
              Total: {formatDualUSD(total ?? 0)}
            </p>
            {saleResult && (
              <p className="text-xs text-muted-foreground mt-1">
                Receipt: {saleResult.receiptNumber}
              </p>
            )}
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
                      {item.quantity} × {formatDualUSD(item.salePricePerUnit ?? 0)}
                    </span>
                  </div>
                  <span className="font-medium shrink-0 ml-4">
                    {formatDualUSD((item.quantity * (item.salePricePerUnit ?? 0)) ?? 0)}
                  </span>
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-1">
              {discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-red-500">-{formatDualUSD(discount ?? 0)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <div className="text-right">
                  <span className="text-emerald-600 block">{formatDualUSD(total ?? 0)}</span>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-1.5 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Cashier</span>
                <span>{currentUser?.name ?? 'Unknown'} ({currentUser?.role})</span>
              </div>
              <div className="flex justify-between">
                <span>Payment</span>
                <span className="font-medium text-foreground">{paymentMethod}</span>
              </div>
              {customerName && (
                <div className="flex justify-between">
                  <span>Customer</span>
                  <span>{customerName}</span>
                </div>
              )}
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
