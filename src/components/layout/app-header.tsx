'use client'

import { useIsMobile } from '@/hooks/use-mobile'
import { useAppStore } from '@/stores/app-store'
import { Store, Menu, Building2, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const viewTitles: Record<string, string> = {
  pos: 'Point of Sale',
  inventory: 'Inventory Management',
  shrinkage: 'Loss Tracking',
  dashboard: 'Dashboard',
  analytics: 'Analytics',
  advisor: 'Smart Advisor',
  branches: 'Branch Management',
}

export function AppHeader() {
  const isMobile = useIsMobile()
  const { currentView, currentUser, currentBranchId, branches, setCurrentBranchId, toggleSidebar } = useAppStore()

  const branchSelector = (
    <Select
      value={currentBranchId ?? 'all'}
      onValueChange={(val) => setCurrentBranchId(val === 'all' ? null : val)}
    >
      <SelectTrigger className="w-auto min-w-[140px] max-w-[220px] h-8 text-xs gap-1">
        <Building2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
        <SelectValue placeholder="All Branches" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all" className="text-xs">
          All Branches
        </SelectItem>
        {branches.map((branch) => (
          <SelectItem key={branch.id} value={branch.id} className="text-xs">
            {branch.name}
            {branch.isHeadOffice && ' (HQ)'}
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
            <span className="font-bold text-base">SmartBiz</span>
          </div>
          <div className="flex items-center gap-2">
            {branchSelector}
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-semibold">
                {currentUser?.name?.charAt(0) ?? 'A'}
              </AvatarFallback>
            </Avatar>
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
          {branchSelector}
          {currentUser && (
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-semibold">
                  {currentUser.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:flex flex-col">
                <span className="text-sm font-medium">{currentUser.name}</span>
                <span className="text-xs text-muted-foreground">
                  {currentUser.role} • {currentUser.branch?.name ?? 'No Branch'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
