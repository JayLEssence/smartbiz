# Task 2-b: Currency Dual Format Fix

## Work Log

### Files Modified

1. **`/src/components/analytics/analytics-view.tsx`**
   - Added `import { useCurrency } from '@/hooks/use-currency'`
   - Added `const { currency, formatDualUSD, formatUSD } = useCurrency()` at top of component
   - Replaced `${lossData.totalFinancialLoss.toFixed(2)}` → `formatDualUSD(lossData.totalFinancialLoss ?? 0)`
   - Replaced YAxis tick `$${v}` → `formatUSD(v)`
   - Replaced Tooltip `$${value.toFixed(2)}` → `formatDualUSD(value ?? 0)`

2. **`/src/components/analytics/sales-trend-chart.tsx`**
   - Added `import { useCurrency } from '@/hooks/use-currency'`
   - Added `const { currency, formatDualUSD, formatUSD } = useCurrency()` at top of component
   - Replaced YAxis tick `$${v}` → `formatUSD(v)`
   - Replaced Tooltip `$${value.toFixed(2)}` → `formatDualUSD(value ?? 0)`

3. **`/src/components/analytics/best-sellers-chart.tsx`**
   - Added `import { useCurrency } from '@/hooks/use-currency'`
   - Added `const { currency, formatDualUSD, formatUSD } = useCurrency()` at top of component
   - Replaced XAxis tick `$${v}` → `formatUSD(v)`
   - Replaced Tooltip `$${value.toFixed(2)}` → `formatDualUSD(value ?? 0)`

4. **`/src/components/admin/admin-panel.tsx`**
   - Added `import { useCurrency } from '@/hooks/use-currency'`
   - Added `const { formatDualUSD } = useCurrency()` at top of component
   - Replaced 3 occurrences of `${product.defaultSalePrice.toFixed(2)}` / `${selectedProduct.defaultSalePrice.toFixed(2)}` → `formatDualUSD(product.defaultSalePrice ?? 0)` / `formatDualUSD(selectedProduct.defaultSalePrice ?? 0)`

### Approach
- Chart axis labels use `formatUSD()` for short format (e.g., `$10.00`) to fit in limited space
- Chart tooltips use `formatDualUSD()` for full dual display (e.g., `$10.00 / TSh 25,700`)
- All `.toFixed()` calls made null-safe with `?? 0` pattern
- Hook called at component level, not inside callbacks (React hooks rules)

### Verification
- `bun run lint` passes with no errors
- Dev server compiles cleanly
