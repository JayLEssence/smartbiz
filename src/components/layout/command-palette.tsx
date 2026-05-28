'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAppStore, type ViewType } from '@/stores/app-store'
import { useLanguage } from '@/lib/i18n/language-context'
import { getAuthHeaderOnly } from '@/lib/auth-fetch'
import { useTheme } from 'next-themes'
import {
  ShoppingCart,
  Package,
  AlertTriangle,
  LayoutDashboard,
  BarChart3,
  Lightbulb,
  Building2,
  Settings,
  Users,
  Receipt,
  FileBarChart,
  Truck,
  Shield,
  Plus,
  Moon,
  Sun,
  ArrowRight,
  Loader2,
} from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'

// ── Types ──────────────────────────────────────────────────────────────────

interface CommandItemData {
  id: string
  label: string
  sublabel?: string
  icon: React.ElementType
  category: 'navigation' | 'products' | 'customers' | 'actions'
  action: () => void
  keywords?: string[]
}

interface ProductResult {
  id: string
  name: string
  sku: string
  barcode?: string
  category?: string
  stock?: number
  salePrice?: number
}

interface CustomerResult {
  id: string
  name: string
  phone?: string
  email?: string
}

// ── Navigation map ─────────────────────────────────────────────────────────

const navigationItems: {
  view: ViewType
  labelKey: string
  icon: React.ElementType
  adminOnly?: boolean
  managerOnly?: boolean
  keywords?: string[]
}[] = [
  { view: 'pos', labelKey: 'sidebar.pos', icon: ShoppingCart, keywords: ['sale', 'sell', 'checkout', 'uuzaji'] },
  { view: 'dashboard', labelKey: 'sidebar.dashboard', icon: LayoutDashboard, keywords: ['home', 'overview', 'dashibodi'] },
  { view: 'inventory', labelKey: 'sidebar.inventory', icon: Package, managerOnly: true, keywords: ['stock', 'products', 'hifadhi', 'bidhaa'] },
  { view: 'customers', labelKey: 'sidebar.customers', icon: Users, managerOnly: true, keywords: ['client', 'wateja'] },
  { view: 'suppliers', labelKey: 'sidebar.suppliers', icon: Truck, adminOnly: true, keywords: ['vendor', 'wauzaji'] },
  { view: 'expenses', labelKey: 'sidebar.expenses', icon: Receipt, managerOnly: true, keywords: ['cost', 'matumizi'] },
  { view: 'reports', labelKey: 'sidebar.reports', icon: FileBarChart, managerOnly: true, keywords: ['analytics', 'data', 'ripoti'] },
  { view: 'analytics', labelKey: 'sidebar.analytics', icon: BarChart3, managerOnly: true, keywords: ['charts', 'stats', 'uchambuzi'] },
  { view: 'shrinkage', labelKey: 'sidebar.lossTrack', icon: AlertTriangle, managerOnly: true, keywords: ['loss', 'damage', 'hasara'] },
  { view: 'advisor', labelKey: 'sidebar.advisor', icon: Lightbulb, adminOnly: true, keywords: ['ai', 'recommend', 'mshauri'] },
  { view: 'security', labelKey: 'sidebar.security', icon: Shield, managerOnly: true, keywords: ['password', '2fa', 'usalama'] },
  { view: 'branches', labelKey: 'sidebar.branches', icon: Building2, adminOnly: true, keywords: ['locations', 'matawi'] },
  { view: 'admin', labelKey: 'sidebar.admin', icon: Settings, adminOnly: true, keywords: ['settings', 'config', 'usimamizi'] },
]

// ── Recent commands storage ────────────────────────────────────────────────

const RECENT_KEY = 'smartbiz_recent_commands'
const MAX_RECENT = 5

function getRecentCommands(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
  } catch {
    return []
  }
}

function addRecentCommand(id: string) {
  try {
    const recent = getRecentCommands().filter((r) => r !== id)
    recent.unshift(id)
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)))
  } catch {
    // ignore
  }
}

// ── Command Palette Component ──────────────────────────────────────────────

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const { t } = useLanguage()
  const { currentUser, setView } = useAppStore()
  const { theme, setTheme } = useTheme()

  const [search, setSearch] = useState('')
  const [products, setProducts] = useState<ProductResult[]>([])
  const [customers, setCustomers] = useState<CustomerResult[]>([])
  const [loadingSearch, setLoadingSearch] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const role = currentUser?.role
  const isAdmin = role === 'CompanyAdmin'
  const isManager = role === 'Manager'
  const isEmployee = role === 'Employee'

  // ── Keyboard shortcut ──────────────────────────────────────────────────

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  // ── Search API calls ───────────────────────────────────────────────────

  const doSearch = useCallback(
    async (query: string) => {
      if (!query.trim() || query.trim().length < 2) {
        setProducts([])
        setCustomers([])
        return
      }

      setLoadingSearch(true)
      try {
        const headers = getAuthHeaderOnly()
        const q = encodeURIComponent(query.trim())

        const [prodRes, custRes] = await Promise.allSettled([
          fetch(`/api/products?search=${q}&limit=5`, { headers }),
          fetch(`/api/customers?search=${q}&limit=5`, { headers }),
        ])

        if (prodRes.status === 'fulfilled' && prodRes.value.ok) {
          const prodJson = await prodRes.value.json()
          setProducts(prodJson?.data?.slice(0, 5) ?? [])
        } else {
          setProducts([])
        }

        if (custRes.status === 'fulfilled' && custRes.value.ok) {
          const custJson = await custRes.value.json()
          setCustomers(custJson?.data?.slice(0, 5) ?? [])
        } else {
          setCustomers([])
        }
      } catch {
        setProducts([])
        setCustomers([])
      } finally {
        setLoadingSearch(false)
      }
    },
    []
  )

  // Debounced search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    if (!search.trim() || search.trim().length < 2) {
      setProducts([])
      setCustomers([])
      setLoadingSearch(false)
      return
    }
    setLoadingSearch(true)
    searchTimerRef.current = setTimeout(() => doSearch(search), 300)
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [search, doSearch])

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSearch('')
      setProducts([])
      setCustomers([])
      setLoadingSearch(false)
    }
  }, [open])

  // ── Build command items ────────────────────────────────────────────────

  const executeAndClose = useCallback(
    (action: () => void, id: string) => {
      addRecentCommand(id)
      action()
      setOpen(false)
    },
    []
  )

  // Navigation items filtered by role
  const navCommands: CommandItemData[] = navigationItems
    .filter((item) => {
      if (item.adminOnly && !isAdmin) return false
      if (item.managerOnly && isEmployee) return false
      return true
    })
    .map((item) => ({
      id: `nav-${item.view}`,
      label: t(item.labelKey),
      icon: item.icon,
      category: 'navigation' as const,
      action: () => setView(item.view),
      keywords: item.keywords,
    }))

  // Quick action items
  const quickActions: CommandItemData[] = [
    {
      id: 'action-new-sale',
      label: t('command.newSale'),
      icon: Plus,
      category: 'actions' as const,
      action: () => setView('pos'),
      keywords: ['sell', 'checkout', 'uza'],
    },
    {
      id: 'action-add-product',
      label: t('command.addProduct'),
      icon: Package,
      category: 'actions' as const,
      action: () => setView('inventory'),
      keywords: ['register', 'new product', 'bidhaa'],
    },
    {
      id: 'action-add-customer',
      label: t('command.addCustomer'),
      icon: Users,
      category: 'actions' as const,
      action: () => setView('customers'),
      keywords: ['new customer', 'mteja'],
    },
    {
      id: 'action-view-reports',
      label: t('command.viewReports'),
      icon: FileBarChart,
      category: 'actions' as const,
      action: () => setView('reports'),
      keywords: ['analytics', 'data', 'ripoti'],
    },
    {
      id: 'action-change-password',
      label: t('command.changePassword'),
      icon: Shield,
      category: 'actions' as const,
      action: () => setView('security'),
      keywords: ['security', '2fa', 'usalama'],
    },
    {
      id: 'action-switch-branch',
      label: t('command.switchBranch'),
      icon: Building2,
      category: 'actions' as const,
      action: () => setView('branches'),
      keywords: ['location', 'tawi'],
    },
    {
      id: 'action-toggle-dark-mode',
      label: theme === 'dark' ? t('command.lightMode') : t('command.darkMode'),
      icon: theme === 'dark' ? Sun : Moon,
      category: 'actions' as const,
      action: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
      keywords: ['theme', 'dark', 'light', 'mode', 'mwanga', 'giza'],
    },
    {
      id: 'action-export-data',
      label: t('command.exportData'),
      icon: Settings,
      category: 'actions' as const,
      action: () => setView('admin'),
      keywords: ['download', 'csv', 'json', 'export', 'tooa'],
    },
  ].filter((action) => {
    // Filter actions by role
    if (action.id === 'action-add-product' && isEmployee) return false
    if (action.id === 'action-add-customer' && isEmployee) return false
    if (action.id === 'action-view-reports' && isEmployee) return false
    if (action.id === 'action-switch-branch' && isEmployee) return false
    if (action.id === 'action-export-data' && !isAdmin) return false
    return true
  })

  // Product items
  const productCommands: CommandItemData[] = products.map((p) => ({
    id: `product-${p.id}`,
    label: p.name,
    sublabel: `${p.sku}${p.barcode ? ` · ${p.barcode}` : ''}${p.stock !== undefined ? ` · Stock: ${p.stock}` : ''}`,
    icon: Package,
    category: 'products' as const,
    action: () => setView('inventory'),
    keywords: [p.sku, p.barcode ?? '', p.category ?? ''],
  }))

  // Customer items
  const customerCommands: CommandItemData[] = customers.map((c) => ({
    id: `customer-${c.id}`,
    label: c.name,
    sublabel: `${c.phone ?? ''}${c.email ? ` · ${c.email}` : ''}`,
    icon: Users,
    category: 'customers' as const,
    action: () => setView('customers'),
    keywords: [c.phone ?? '', c.email ?? ''],
  }))

  // Recent commands
  const recentIds = getRecentCommands()
  const allCommands = [...navCommands, ...quickActions, ...productCommands, ...customerCommands]
  const recentCommands = recentIds
    .map((id) => allCommands.find((c) => c.id === id))
    .filter(Boolean) as CommandItemData[]

  const hasResults =
    recentCommands.length > 0 ||
    navCommands.length > 0 ||
    productCommands.length > 0 ||
    customerCommands.length > 0 ||
    quickActions.length > 0

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title={t('command.title')}
      description={t('command.description')}
      showCloseButton={false}
      className="sm:max-w-lg"
    >
      <CommandInput
        placeholder={t('command.placeholder')}
        value={search}
        onValueChange={setSearch}
      />
      <CommandList className="max-h-[360px]">
        {loadingSearch && (
          <div className="flex items-center justify-center py-4 gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{t('command.searching')}</span>
          </div>
        )}
        <CommandEmpty>{t('command.noResults')}</CommandEmpty>

        {/* Recent commands */}
        {recentCommands.length > 0 && !search && (
          <CommandGroup heading={t('command.recent')}>
            {recentCommands.map((item) => (
              <CommandItem
                key={item.id}
                value={`${item.label} ${item.keywords?.join(' ') ?? ''}`}
                onSelect={() => executeAndClose(item.action, item.id)}
                className="cursor-pointer"
              >
                <item.icon className="h-4 w-4 text-emerald-600 shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="truncate text-sm">{item.label}</span>
                  {item.sublabel && (
                    <span className="text-xs text-muted-foreground truncate">{item.sublabel}</span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Navigation */}
        {navCommands.length > 0 && (
          <CommandGroup heading={t('command.navigation')}>
            {navCommands.map((item) => (
              <CommandItem
                key={item.id}
                value={`${item.label} ${item.keywords?.join(' ') ?? ''}`}
                onSelect={() => executeAndClose(item.action, item.id)}
                className="cursor-pointer"
              >
                <item.icon className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="text-sm">{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Products */}
        {productCommands.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t('command.products')}>
              {productCommands.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.label} ${item.keywords?.join(' ') ?? ''}`}
                  onSelect={() => executeAndClose(item.action, item.id)}
                  className="cursor-pointer"
                >
                  <item.icon className="h-4 w-4 text-emerald-600 shrink-0" />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="truncate text-sm">{item.label}</span>
                    {item.sublabel && (
                      <span className="text-xs text-muted-foreground truncate">{item.sublabel}</span>
                    )}
                  </div>
                  <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
                    <ArrowRight className="h-3 w-3" />
                    {t('sidebar.inventory')}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Customers */}
        {customerCommands.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t('command.customers')}>
              {customerCommands.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.label} ${item.keywords?.join(' ') ?? ''}`}
                  onSelect={() => executeAndClose(item.action, item.id)}
                  className="cursor-pointer"
                >
                  <item.icon className="h-4 w-4 text-emerald-600 shrink-0" />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="truncate text-sm">{item.label}</span>
                    {item.sublabel && (
                      <span className="text-xs text-muted-foreground truncate">{item.sublabel}</span>
                    )}
                  </div>
                  <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
                    <ArrowRight className="h-3 w-3" />
                    {t('sidebar.customers')}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Quick Actions */}
        {quickActions.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t('command.actions')}>
              {quickActions.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.label} ${item.keywords?.join(' ') ?? ''}`}
                  onSelect={() => executeAndClose(item.action, item.id)}
                  className="cursor-pointer"
                >
                  <item.icon className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="text-sm">{item.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>

      {/* Footer hint */}
      <div className="border-t px-3 py-2 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              <ArrowRight className="h-2.5 w-2.5" />
            </kbd>
            <span>{t('command.toNavigate')}</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              ↵
            </kbd>
            <span>{t('command.toSelect')}</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              esc
            </kbd>
            <span>{t('command.toClose')}</span>
          </span>
        </div>
      </div>
    </CommandDialog>
  )
}
