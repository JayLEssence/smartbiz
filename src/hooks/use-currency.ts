'use client'

import { useMemo } from 'react'
import { useAppStore } from '@/stores/app-store'
import {
  type CurrencyInfo,
  formatLocalCurrency,
  formatUSD,
  formatDualCurrency,
  formatDualCurrencyShort,
  formatUSDDual,
  localToUSD,
  usdToLocal,
} from '@/lib/currency'

export function useCurrency() {
  const { currentCompany } = useAppStore()

  const currency: CurrencyInfo = useMemo(() => ({
    code: currentCompany?.currency || 'TZS',
    symbol: currentCompany?.currencySymbol || 'TSh',
    rate: (currentCompany as any)?.exchangeRate || 2570,
    country: (currentCompany as any)?.country || 'Tanzania',
  }), [currentCompany])

  return {
    currency,
    formatLocal: (amount: number) => formatLocalCurrency(amount, currency),
    formatUSD: (amount: number) => formatUSD(localToUSD(amount, currency.rate)),
    formatDual: (amount: number) => formatDualCurrency(amount, currency),
    formatDualShort: (amount: number) => formatDualCurrencyShort(amount, currency),
    toUSD: (amount: number) => localToUSD(amount, currency.rate),
    toLocal: (amount: number) => usdToLocal(amount, currency.rate),
    formatDualUSD: (amount: number) => formatUSDDual(amount, currency),
  }
}
