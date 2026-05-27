'use client'

import { create } from 'zustand'

export type PaymentMethod = 'Cash' | 'M-Pesa' | 'Tigo Pesa' | 'Airtel Money' | 'Card' | 'Credit'

export interface CartItem {
  productId: string
  name: string
  sku: string
  quantity: number
  salePricePerUnit: number
  maxStock: number
}

interface PosState {
  items: CartItem[]
  discount: number
  paymentMethod: PaymentMethod
  customerName: string
  phoneNumber: string
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  setDiscount: (discount: number) => void
  setPaymentMethod: (method: PaymentMethod) => void
  setCustomerName: (name: string) => void
  setPhoneNumber: (phone: string) => void
  clearCart: () => void
  getSubtotal: () => number
  getTotal: () => number
}

export const usePosStore = create<PosState>((set, get) => ({
  items: [],
  discount: 0,
  paymentMethod: 'Cash',
  customerName: '',
  phoneNumber: '',

  addItem: (item) => {
    set((state) => {
      const existing = state.items.find((i) => i.productId === item.productId)
      if (existing) {
        const newQty = existing.quantity + (item.quantity ?? 1)
        return {
          items: state.items.map((i) =>
            i.productId === item.productId
              ? { ...i, quantity: Math.min(newQty, i.maxStock) }
              : i
          ),
        }
      }
      return {
        items: [
          ...state.items,
          { ...item, quantity: Math.min(item.quantity ?? 1, item.maxStock) },
        ],
      }
    })
  },

  removeItem: (productId) => {
    set((state) => ({
      items: state.items.filter((i) => i.productId !== productId),
    }))
  },

  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(productId)
      return
    }
    set((state) => ({
      items: state.items.map((i) =>
        i.productId === productId
          ? { ...i, quantity: Math.min(quantity, i.maxStock) }
          : i
      ),
    }))
  },

  setDiscount: (discount) => {
    set({ discount: Math.max(0, discount) })
  },

  setPaymentMethod: (method) => {
    set({ paymentMethod: method })
  },

  setCustomerName: (name) => {
    set({ customerName: name })
  },

  setPhoneNumber: (phone) => {
    set({ phoneNumber: phone })
  },

  clearCart: () => {
    set({ items: [], discount: 0, paymentMethod: 'Cash', customerName: '', phoneNumber: '' })
  },

  getSubtotal: () => {
    return get().items.reduce(
      (sum, item) => sum + item.quantity * item.salePricePerUnit,
      0
    )
  },

  getTotal: () => {
    const subtotal = get().getSubtotal()
    return Math.max(0, subtotal - get().discount)
  },
}))
