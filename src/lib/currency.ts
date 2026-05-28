import { type Language } from '@/lib/i18n/translations'

// Supported currencies with their details
export const supportedCurrencies: Record<string, {
  code: string
  symbol: string
  name: string
  country: string
  rate: number // Exchange rate: 1 USD = X local currency
}> = {
  TZS: { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling', country: 'Tanzania', rate: 2570 },
  KES: { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling', country: 'Kenya', rate: 129 },
  UGX: { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling', country: 'Uganda', rate: 3680 },
  RWF: { code: 'RWF', symbol: 'FRw', name: 'Rwandan Franc', country: 'Rwanda', rate: 1280 },
  BWF: { code: 'BWF', symbol: 'P', name: 'Botswana Pula', country: 'Botswana', rate: 13.5 },
  ZMW: { code: 'ZMW', symbol: 'ZK', name: 'Zambian Kwacha', country: 'Zambia', rate: 25 },
  GHS: { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi', country: 'Ghana', rate: 15 },
  NGN: { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', country: 'Nigeria', rate: 1550 },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', country: 'United States', rate: 1 },
}

export interface CurrencyInfo {
  code: string
  symbol: string
  rate: number
  country: string
}

/**
 * Format an amount in local currency
 */
export function formatLocalCurrency(amount: number, currency: CurrencyInfo): string {
  return `${currency.symbol} ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

/**
 * Format an amount in USD
 */
export function formatUSD(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Convert local currency amount to USD
 */
export function localToUSD(amount: number, rate: number): number {
  if (!rate || rate === 0) return amount
  return amount / rate
}

/**
 * Convert USD to local currency amount
 */
export function usdToLocal(amount: number, rate: number): number {
  return amount * rate
}

/**
 * Format dual currency display - shows both local and USD
 * Example: "TSh 25,700 ($10.00)"
 */
export function formatDualCurrency(localAmount: number, currency: CurrencyInfo): string {
  const local = formatLocalCurrency(localAmount, currency)
  const usd = formatUSD(localToUSD(localAmount, currency.rate))
  return `${local} (${usd})`
}

/**
 * Format a short dual currency for compact displays
 * Example: "TSh 25.7K ≈ $10"
 */
export function formatDualCurrencyShort(localAmount: number, currency: CurrencyInfo): string {
  const local = formatLocalCurrency(localAmount, currency)
  const usdAmount = localToUSD(localAmount, currency.rate)
  const usd = usdAmount >= 1000
    ? `$${(usdAmount / 1000).toFixed(1)}K`
    : `$${usdAmount.toFixed(0)}`
  return `${local} ≈ ${usd}`
}
