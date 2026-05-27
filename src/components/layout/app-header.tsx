'use client'

import { useIsMobile } from '@/hooks/use-mobile'
import { useAppStore } from '@/stores/app-store'
import { useLanguage } from '@/lib/i18n/language-context'
import { languageNames, type Language } from '@/lib/i18n/translations'
import { Store, Menu, Building2, LogOut, ChevronDown, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function AppHeader() {
  const isMobile = useIsMobile()
  const { t, language, setLanguage } = useLanguage()
  const { currentView, currentUser, currentBranchId, currentCompany, branches, setCurrentBranchId, toggleSidebar, logout } = useAppStore()

  const isAdmin = currentUser?.role === 'CompanyAdmin'
  const isManager = currentUser?.role === 'Manager'
  const isEmployee = currentUser?.role === 'Employee'
  const canSwitchBranch = isAdmin || isManager

  const viewTitles: Record<string, string> = {
    pos: t('header.pointOfSale'),
    inventory: t('header.inventoryManagement'),
    shrinkage: t('header.lossTracking'),
    dashboard: t('header.dashboard'),
    analytics: t('header.analytics'),
    advisor: t('header.smartAdvisor'),
    branches: t('header.branchManagement'),
    admin: t('header.adminPanel'),
  }

  const languageSwitcher = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs">
          <Globe className="h-3.5 w-3.5 text-emerald-600" />
          <span className="hidden sm:inline">{languageNames[language]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => setLanguage('en')}
          className={language === 'en' ? 'bg-emerald-50 dark:bg-emerald-950/30' : ''}
        >
          🇬🇧 English
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setLanguage('sw')}
          className={language === 'sw' ? 'bg-emerald-50 dark:bg-emerald-950/30' : ''}
        >
          🇹🇿 Kiswahili
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const branchSelector = (
    <Select
      value={currentBranchId ?? 'all'}
      onValueChange={(val) => setCurrentBranchId(val === 'all' ? null : val)}
      disabled={isEmployee}
    >
      <SelectTrigger className="w-auto min-w-[140px] max-w-[220px] h-8 text-xs gap-1">
        <Building2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
        <SelectValue placeholder={t('header.allBranches')} />
      </SelectTrigger>
      <SelectContent>
        {isAdmin && (
          <SelectItem value="all" className="text-xs">
            {t('header.allBranches')}
          </SelectItem>
        )}
        {branches.map((branch) => (
          <SelectItem key={branch.id} value={branch.id} className="text-xs">
            {branch.name}
            {branch.isHeadOffice && ` (${t('admin.hq')})`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  if (isMobile) {
    return (
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600 text-white">
              <Store className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base leading-tight">SmartBiz</span>
              {currentCompany && (
                <span className="text-[10px] text-muted-foreground leading-tight">{currentCompany.name}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {languageSwitcher}
            {!isEmployee && branchSelector}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-semibold">
                      {currentUser?.name?.charAt(0) ?? 'A'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{currentUser?.name}</span>
                    <span className="text-xs text-muted-foreground">{currentUser?.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />
                  {t('header.signOut')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
    )
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={toggleSidebar}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">
            {viewTitles[currentView] ?? 'SmartBiz'}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Language Switcher */}
          {languageSwitcher}

          {/* Company name badge */}
          {currentCompany && (
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <Building2 className="h-3 w-3" />
              {currentCompany.name}
            </span>
          )}
          {/* Branch selector */}
          {canSwitchBranch && branchSelector}
          {currentUser && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-auto p-1 hover:bg-accent">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-semibold">
                        {currentUser.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden sm:flex flex-col items-start">
                      <span className="text-sm font-medium">{currentUser.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {currentUser.role === 'CompanyAdmin' ? t('header.admin') : currentUser.role} • {currentUser.branch?.name ?? t('header.noBranch')}
                      </span>
                    </div>
                    <ChevronDown className="h-3 w-3 text-muted-foreground hidden sm:block" />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium">{currentUser.name}</span>
                    <span className="text-xs text-muted-foreground">{currentUser.email}</span>
                    <span className="text-xs text-emerald-600 font-medium">
                      {currentUser.company?.name ?? t('header.unknownCompany')}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />
                  {t('header.signOut')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  )
}
