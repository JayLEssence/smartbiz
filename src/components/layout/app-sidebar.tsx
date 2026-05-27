'use client'

import { useIsMobile } from '@/hooks/use-mobile'
import { useAppStore, type ViewType } from '@/stores/app-store'
import { useLanguage } from '@/lib/i18n/language-context'
import {
  ShoppingCart,
  Package,
  AlertTriangle,
  LayoutDashboard,
  BarChart3,
  Lightbulb,
  Building2,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

interface NavItem {
  view: ViewType
  labelKey: string
  icon: React.ElementType
  adminOnly?: boolean
  managerOnly?: boolean
}

const allNavItems: NavItem[] = [
  { view: 'pos', labelKey: 'sidebar.pos', icon: ShoppingCart },
  { view: 'dashboard', labelKey: 'sidebar.dashboard', icon: LayoutDashboard },
  { view: 'inventory', labelKey: 'sidebar.inventory', icon: Package, managerOnly: true },
  { view: 'shrinkage', labelKey: 'sidebar.lossTrack', icon: AlertTriangle, managerOnly: true },
  { view: 'analytics', labelKey: 'sidebar.analytics', icon: BarChart3, managerOnly: true },
  { view: 'advisor', labelKey: 'sidebar.advisor', icon: Lightbulb, adminOnly: true },
  { view: 'branches', labelKey: 'sidebar.branches', icon: Building2, adminOnly: true },
  { view: 'admin', labelKey: 'sidebar.admin', icon: Settings, adminOnly: true },
]

export function AppSidebar() {
  const isMobile = useIsMobile()
  const { currentView, setView, currentUser } = useAppStore()
  const { t } = useLanguage()

  const role = currentUser?.role

  const navItems = allNavItems.filter((item) => {
    if (item.adminOnly && role !== 'CompanyAdmin') return false
    if (item.managerOnly && role === 'Employee') return false
    return true
  })

  if (isMobile) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex items-center justify-around px-1 py-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = currentView === item.view
            return (
              <Button
                key={item.view}
                variant="ghost"
                size="sm"
                onClick={() => setView(item.view)}
                className={cn(
                  'flex flex-col items-center gap-0.5 h-auto py-2 px-2 min-w-[48px]',
                  isActive
                    ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{t(item.labelKey)}</span>
              </Button>
            )
          })}
        </div>
      </nav>
    )
  }

  return (
    <aside className="hidden md:flex w-56 flex-col border-r bg-card">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
          <ShoppingCart className="h-4 w-4" />
        </div>
        <span className="font-bold text-lg">SmartBiz</span>
      </div>
      <Separator />
      <nav className="flex flex-col gap-1 p-3">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = currentView === item.view
          return (
            <Button
              key={item.view}
              variant={isActive ? 'secondary' : 'ghost'}
              onClick={() => setView(item.view)}
              className={cn(
                'justify-start gap-3 h-10',
                isActive &&
                  'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-950/40'
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="text-sm">{t(item.labelKey)}</span>
            </Button>
          )
        })}
      </nav>
    </aside>
  )
}
