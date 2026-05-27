'use client'

import { useState, useMemo } from 'react'
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
  Users,
  Receipt,
  FileBarChart,
  Truck,
  ChevronDown,
  MoreHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

interface NavItem {
  view: ViewType
  labelKey: string
  icon: React.ElementType
  adminOnly?: boolean
  managerOnly?: boolean
}

interface NavGroup {
  key: string
  labelKey: string
  items: NavItem[]
  collapsible?: boolean
}

const allNavGroups: NavGroup[] = [
  {
    key: 'core',
    labelKey: 'sidebar.core',
    collapsible: false,
    items: [
      { view: 'pos', labelKey: 'sidebar.pos', icon: ShoppingCart },
      { view: 'dashboard', labelKey: 'sidebar.dashboard', icon: LayoutDashboard },
    ],
  },
  {
    key: 'management',
    labelKey: 'sidebar.management',
    collapsible: true,
    items: [
      { view: 'inventory', labelKey: 'sidebar.inventory', icon: Package, managerOnly: true },
      { view: 'customers', labelKey: 'sidebar.customers', icon: Users, managerOnly: true },
      { view: 'suppliers', labelKey: 'sidebar.suppliers', icon: Truck, adminOnly: true },
    ],
  },
  {
    key: 'finance',
    labelKey: 'sidebar.finance',
    collapsible: true,
    items: [
      { view: 'expenses', labelKey: 'sidebar.expenses', icon: Receipt, managerOnly: true },
      { view: 'reports', labelKey: 'sidebar.reports', icon: FileBarChart, managerOnly: true },
    ],
  },
  {
    key: 'insights',
    labelKey: 'sidebar.insights',
    collapsible: true,
    items: [
      { view: 'analytics', labelKey: 'sidebar.analytics', icon: BarChart3, managerOnly: true },
      { view: 'shrinkage', labelKey: 'sidebar.lossTrack', icon: AlertTriangle, managerOnly: true },
      { view: 'advisor', labelKey: 'sidebar.advisor', icon: Lightbulb, adminOnly: true },
    ],
  },
  {
    key: 'system',
    labelKey: 'sidebar.system',
    collapsible: true,
    items: [
      { view: 'branches', labelKey: 'sidebar.branches', icon: Building2, adminOnly: true },
      { view: 'admin', labelKey: 'sidebar.admin', icon: Settings, adminOnly: true },
    ],
  },
]

// The 3 most important items shown directly in mobile bottom bar
const mobilePrimaryViews: ViewType[] = ['pos', 'dashboard', 'inventory']

function useFilteredGroups() {
  const { currentUser } = useAppStore()
  const role = currentUser?.role

  return useMemo(() => {
    return allNavGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (item.adminOnly && role !== 'CompanyAdmin') return false
          if (item.managerOnly && role === 'Employee') return false
          return true
        }),
      }))
      .filter((group) => group.items.length > 0)
  }, [role])
}

function useAllFilteredItems() {
  const groups = useFilteredGroups()
  return useMemo(() => groups.flatMap((g) => g.items), [groups])
}

function NavItemButton({
  item,
  isActive,
  onClick,
  className,
}: {
  item: NavItem
  isActive: boolean
  onClick: () => void
  className?: string
}) {
  const { t } = useLanguage()
  const Icon = item.icon

  return (
    <Button
      variant={isActive ? 'secondary' : 'ghost'}
      onClick={onClick}
      className={cn(
        'justify-start gap-3 h-10',
        isActive &&
          'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-950/40',
        className
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="text-sm">{t(item.labelKey)}</span>
    </Button>
  )
}

function DesktopSidebar() {
  const { currentView, setView } = useAppStore()
  const { t } = useLanguage()
  const groups = useFilteredGroups()

  // Determine which groups should be open by default (the one containing the active view)
  const defaultOpenKeys = useMemo(() => {
    return groups
      .filter(
        (group) =>
          group.collapsible && group.items.some((item) => item.view === currentView)
      )
      .map((group) => group.key)
  }, [groups, currentView])

  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(defaultOpenKeys))

  // When currentView changes, ensure the group containing it is open
  const handleSetView = (view: ViewType) => {
    setView(view)
    // Open the group containing the new view
    const groupWithView = groups.find((g) => g.items.some((i) => i.view === view))
    if (groupWithView && groupWithView.collapsible) {
      setOpenGroups((prev) => {
        const next = new Set(prev)
        next.add(groupWithView.key)
        return next
      })
    }
  }

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
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
      <ScrollArea className="flex-1">
        <nav className="flex flex-col gap-1 p-3">
          {groups.map((group, groupIdx) => {
            const isOpen = !group.collapsible || openGroups.has(group.key)
            const isCore = !group.collapsible

            return (
              <div key={group.key}>
                {groupIdx > 0 && <Separator className="my-2" />}
                {/* Group header */}
                {!isCore && (
                  <Collapsible
                    open={isOpen}
                    onOpenChange={() => toggleGroup(group.key)}
                  >
                    <CollapsibleTrigger asChild>
                      <button className="flex w-full items-center justify-between px-2 py-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
                        <span>{t(group.labelKey)}</span>
                        <ChevronDown
                          className={cn(
                            'h-3.5 w-3.5 transition-transform duration-200',
                            isOpen ? 'rotate-0' : '-rotate-90'
                          )}
                        />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up overflow-hidden">
                      <div className="flex flex-col gap-0.5 mt-1">
                        {group.items.map((item) => (
                          <NavItemButton
                            key={item.view}
                            item={item}
                            isActive={currentView === item.view}
                            onClick={() => handleSetView(item.view)}
                          />
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}
                {/* Core group: always visible, no collapsible wrapper */}
                {isCore && (
                  <div>
                    <div className="px-2 py-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {t(group.labelKey)}
                    </div>
                    <div className="flex flex-col gap-0.5 mt-1">
                      {group.items.map((item) => (
                        <NavItemButton
                          key={item.view}
                          item={item}
                          isActive={currentView === item.view}
                          onClick={() => handleSetView(item.view)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </ScrollArea>
    </aside>
  )
}

function MobileBottomBar() {
  const { currentView, setView } = useAppStore()
  const { t } = useLanguage()
  const allItems = useAllFilteredItems()
  const groups = useFilteredGroups()
  const [sheetOpen, setSheetOpen] = useState(false)

  // Split items into primary (shown directly) and secondary (in "More" sheet)
  const primaryItems = allItems.filter((item) =>
    mobilePrimaryViews.includes(item.view)
  )
  const secondaryItems = allItems.filter(
    (item) => !mobilePrimaryViews.includes(item.view)
  )

  const handleSetView = (view: ViewType) => {
    setView(view)
    setSheetOpen(false)
  }

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex items-center justify-around px-1 py-1">
          {primaryItems.map((item) => {
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

          {/* More button */}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'flex flex-col items-center gap-0.5 h-auto py-2 px-2 min-w-[48px]',
                  secondaryItems.some((item) => item.view === currentView)
                    ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <MoreHorizontal className="h-5 w-5" />
                <span className="text-[10px] font-medium">{t('sidebar.more')}</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl max-h-[70vh]">
              <SheetHeader className="pb-2">
                <SheetTitle className="text-left">{t('sidebar.more')}</SheetTitle>
              </SheetHeader>
              <ScrollArea className="max-h-[55vh]">
                <div className="px-4 pb-6">
                  {groups
                    .filter((group) =>
                      group.items.some(
                        (item) => !mobilePrimaryViews.includes(item.view)
                      )
                    )
                    .map((group, groupIdx) => {
                      const groupSecondaryItems = group.items.filter(
                        (item) => !mobilePrimaryViews.includes(item.view)
                      )
                      if (groupSecondaryItems.length === 0) return null

                      return (
                        <div key={group.key}>
                          {groupIdx > 0 && <Separator className="my-3" />}
                          <div className="px-2 py-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            {t(group.labelKey)}
                          </div>
                          <div className="flex flex-col gap-0.5 mt-1">
                            {groupSecondaryItems.map((item) => {
                              const Icon = item.icon
                              const isActive = currentView === item.view
                              return (
                                <Button
                                  key={item.view}
                                  variant={isActive ? 'secondary' : 'ghost'}
                                  onClick={() => handleSetView(item.view)}
                                  className={cn(
                                    'justify-start gap-3 h-11',
                                    isActive &&
                                      'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-950/40'
                                  )}
                                >
                                  <Icon className="h-5 w-5" />
                                  <span className="text-sm">{t(item.labelKey)}</span>
                                </Button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </>
  )
}

export function AppSidebar() {
  const isMobile = useIsMobile()

  if (isMobile) {
    return <MobileBottomBar />
  }

  return <DesktopSidebar />
}
