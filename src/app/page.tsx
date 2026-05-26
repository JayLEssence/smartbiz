'use client'

import { useEffect, useState } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { useAppStore, type CompanyInfo, type BranchInfo } from '@/stores/app-store'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { AppHeader } from '@/components/layout/app-header'
import { AuthPage } from '@/components/auth/auth-page'
import { PosView } from '@/components/pos/pos-view'
import { InventoryView } from '@/components/inventory/inventory-view'
import { ShrinkageView } from '@/components/inventory/shrinkage-view'
import { DashboardView } from '@/components/dashboard/dashboard-view'
import { AnalyticsView } from '@/components/analytics/analytics-view'
import { AdvisorView } from '@/components/advisor/advisor-view'
import { BranchesView } from '@/components/branches/branches-view'
import { AdminPanel } from '@/components/admin/admin-panel'

export default function Home() {
  const isMobile = useIsMobile()
  const {
    currentView,
    isAuthenticated,
    currentUser,
    setView,
    setUser,
    setCurrentBranchId,
    setCompany,
    setAuthenticated,
    setBranches,
  } = useAppStore()
  const [initializing, setInitializing] = useState(true)

  // Initialize: try to restore session from localStorage
  useEffect(() => {
    const restoreSession = () => {
      try {
        const stored = localStorage.getItem('smartbiz_session')
        if (stored) {
          const data = JSON.parse(stored)
          if (data?.user) {
            const user = data.user
            const companyInfo: CompanyInfo = {
              id: user.company.id,
              name: user.company.name,
              industry: user.company.industry ?? null,
              email: user.company.email ?? null,
              phone: user.company.phone ?? null,
              plan: user.company.plan,
              isActive: user.company.isActive,
            }

            setUser({
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
              branchId: user.branchId,
              companyId: user.companyId,
              branch: {
                id: user.branch.id,
                name: user.branch.name,
                code: user.branch.code,
                isHeadOffice: user.branch.isHeadOffice,
                isActive: true,
              },
              company: companyInfo,
            })

            // For Employee: always lock to their own branch
            if (user.role === 'Employee') {
              setCurrentBranchId(user.branchId)
            } else {
              setCurrentBranchId(user.branchId)
            }

            setCompany(companyInfo)
            setAuthenticated(true)

            // Fetch branches for this company
            fetch(`/api/branches?companyId=${user.companyId}`)
              .then((res) => res.json())
              .then((json) => {
                if (json.success && json.data) {
                  const branches: BranchInfo[] = json.data.map((b: { id: string; name: string; code: string; isHeadOffice: boolean; isActive: boolean }) => ({
                    id: b.id,
                    name: b.name,
                    code: b.code,
                    isHeadOffice: b.isHeadOffice,
                    isActive: b.isActive,
                  }))
                  setBranches(branches)
                }
              })
              .catch(() => {})
          }
        }
      } catch {
        localStorage.removeItem('smartbiz_session')
      } finally {
        setInitializing(false)
      }
    }

    restoreSession()
  }, [setUser, setCurrentBranchId, setCompany, setAuthenticated, setBranches])

  // Set default view based on device and role
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      // Employee always starts at POS
      if (currentUser.role === 'Employee') {
        setView('pos')
      } else if (isMobile) {
        setView('dashboard')
      } else {
        setView('pos')
      }
    }
  }, [isAuthenticated, isMobile, setView, currentUser])

  const isEmployee = currentUser?.role === 'Employee'
  const isManager = currentUser?.role === 'Manager'
  const isAdmin = currentUser?.role === 'CompanyAdmin'

  const renderView = () => {
    // Access control: redirect unauthorized users
    switch (currentView) {
      case 'pos':
        return <PosView />
      case 'inventory':
        // Only Manager+ can access inventory management
        if (isEmployee) return <AccessDenied message="Only managers and admins can access inventory management" />
        return <InventoryView />
      case 'shrinkage':
        // Only Manager+ can access shrinkage tracking
        if (isEmployee) return <AccessDenied message="Only managers and admins can access loss tracking" />
        return <ShrinkageView />
      case 'dashboard':
        return <DashboardView />
      case 'analytics':
        // Only Manager+ can access analytics
        if (isEmployee) return <AccessDenied message="Only managers and admins can access analytics" />
        return <AnalyticsView />
      case 'advisor':
        // Only CompanyAdmin can access advisor
        if (!isAdmin) return <AccessDenied message="Only admins can access the Smart Advisor" />
        return <AdvisorView />
      case 'branches':
        // Only CompanyAdmin can access branches
        if (!isAdmin) return <AccessDenied message="Only admins can manage branches" />
        return <BranchesView />
      case 'admin':
        // Only CompanyAdmin can access admin panel
        if (!isAdmin) return <AccessDenied message="Only admins can access the admin panel" />
        return <AdminPanel />
      default:
        return <DashboardView />
    }
  }

  // Show auth page if not authenticated
  if (!isAuthenticated) {
    return <AuthPage />
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex flex-1">
        {/* Sidebar (desktop) / Bottom nav (mobile) */}
        <AppSidebar />

        {/* Main content */}
        <div className="flex flex-1 flex-col min-w-0">
          <AppHeader />
          <main className="flex-1 overflow-auto">
            {renderView()}
          </main>
        </div>
      </div>
    </div>
  )
}

function AccessDenied({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
      <p className="text-sm font-medium">Access Denied</p>
      <p className="text-xs mt-1">{message}</p>
    </div>
  )
}
