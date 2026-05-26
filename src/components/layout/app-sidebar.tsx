'use client'

import { useIsMobile } from '@/hooks/use-mobile'
import { useAppStore, type ViewType } from '@/stores/app-store'
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
  label: string
  icon: React.ElementType
  adminOnly?: boolean
  managerOnly?: boolean
}

const allNavItems: NavItem[] = [
  { view: 'pos', label: 'POS', icon: ShoppingCart },
  { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { view: 'inventory', label: 'Inventory', icon: Package, managerOnly: true },
  { view: 'shrinkage', label: 'Loss Track', icon: AlertTriangle, managerOnly: true },
  { view: 'analytics', label: 'Analytics', icon: BarChart3, managerOnly: true },
  { view: 'advisor', label: 'Advisor', icon: Lightbulb, adminOnly: true },
  { view: 'branches', label: 'Branches', icon: Building2, adminOnly: true },
  { view: 'admin', label: 'Admin', icon: Settings, adminOnly: true },
]

export function AppSidebar() {
  const isMobile = useIsMobile()
  const { currentView, setView, currentUser } = useAppStore()

  const role = currentUser?.role

  const navItems = allNavItems.filter((item) => {
    // Admin-only items: only CompanyAdmin sees them
    if (item.adminOnly && role !== 'CompanyAdmin') return false
    // Manager-only items: CompanyAdmin and Manager see them, Employee does not
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
                <span className="text-[10px] font-medium">{item.label}</span>
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
              <span className="text-sm">{item.label}</span>
            </Button>
          )
        })}
      </nav>
    </aside>
  )
}
