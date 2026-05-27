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
import { SuppliersView } from '@/components/suppliers/suppliers-view'
import { CustomersView } from '@/components/customers/customers-view'
import { ExpensesView } from '@/components/expenses/expenses-view'
import { ReportsView } from '@/components/reports/reports-view'
import { AdminPanel } from '@/components/admin/admin-panel'
import { SecurityView } from '@/components/security/security-view'
import { OfflineBanner } from '@/components/layout/offline-banner'
import { SessionTimeout } from '@/components/layout/session-timeout'
import { initCsrfToken } from '@/lib/auth-fetch'
import { CommandPalette } from '@/components/layout/command-palette'
import { LanguageProvider, useLanguage } from '@/lib/i18n/language-context'

export default function Home() {
  return (
    <LanguageProvider>
      <HomeContent />
    </LanguageProvider>
  )
}

function HomeContent() {
  const isMobile = useIsMobile()
  const { t } = useLanguage()
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
    setAuthToken,
    logout,
  } = useAppStore()
  const [initializing, setInitializing] = useState(true)

  // Listen for auth expiry events and token refresh events
  useEffect(() => {
    const handleAuthExpired = () => {
      logout()
    }
    const handleTokenRefreshed = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.token) {
        setAuthToken(detail.token)
      }
    }
    window.addEventListener('auth:expired', handleAuthExpired)
    window.addEventListener('auth:token-refreshed', handleTokenRefreshed)
    return () => {
      window.removeEventListener('auth:expired', handleAuthExpired)
      window.removeEventListener('auth:token-refreshed', handleTokenRefreshed)
    }
  }, [logout, setAuthToken])

  // Initialize: try to restore session from localStorage
  useEffect(() => {
    const restoreSession = () => {
      try {
        const stored = localStorage.getItem('smartbiz_session')
        if (stored) {
          const data = JSON.parse(stored)
          if (data?.user && data?.token) {
            const user = data.user
            const companyInfo: CompanyInfo = {
              id: user.company.id,
              name: user.company.name,
              industry: user.company.industry ?? null,
              email: user.company.email ?? null,
              phone: user.company.phone ?? null,
              plan: user.company.plan,
              isActive: user.company.isActive,
              currency: user.company.currency ?? 'TZS',
              currencySymbol: user.company.currencySymbol ?? 'TSh',
              country: user.company.country ?? 'Tanzania',
              exchangeRate: user.company.exchangeRate ?? 2570,
            }

            setUser({
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
              branchId: user.branchId,
              companyId: user.companyId,
              twoFactorEnabled: user.twoFactorEnabled,
              mustChangePassword: user.mustChangePassword,
              branch: {
                id: user.branch.id,
                name: user.branch.name,
                code: user.branch.code,
                isHeadOffice: user.branch.isHeadOffice,
                isActive: true,
              },
              company: companyInfo,
            })

            setCurrentBranchId(user.branchId)
            setCompany(companyInfo)
            setAuthenticated(true)
            setAuthToken(data.token)

            // Initialize CSRF token
            initCsrfToken().catch(() => {})

            // Fetch branches with auth token
            fetch(`/api/branches?companyId=${user.companyId}`, {
              headers: { 'Authorization': `Bearer ${data.token}` },
            })
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
  }, [setUser, setCurrentBranchId, setCompany, setAuthenticated, setBranches, setAuthToken])

  // Set default view based on device and role
  useEffect(() => {
    if (isAuthenticated && currentUser) {
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
  const isAdmin = currentUser?.role === 'CompanyAdmin'

  const renderView = () => {
    switch (currentView) {
      case 'pos':
        return <PosView />
      case 'inventory':
        if (isEmployee) return <AccessDenied message={t('common.onlyManagersInventory')} />
        return <InventoryView />
      case 'shrinkage':
        if (isEmployee) return <AccessDenied message={t('common.onlyManagersLoss')} />
        return <ShrinkageView />
      case 'dashboard':
        return <DashboardView />
      case 'analytics':
        if (isEmployee) return <AccessDenied message={t('common.onlyManagersAnalytics')} />
        return <AnalyticsView />
      case 'advisor':
        if (!isAdmin) return <AccessDenied message={t('common.onlyAdminAdvisor')} />
        return <AdvisorView />
      case 'branches':
        if (!isAdmin) return <AccessDenied message={t('common.onlyAdminBranches')} />
        return <BranchesView />
      case 'customers':
        if (isEmployee) return <AccessDenied message={t('customers.managerOnlyAccess')} />
        return <CustomersView />
      case 'expenses':
        if (isEmployee) return <AccessDenied message="Only managers and admins can access expense tracking" />
        return <ExpensesView />
      case 'reports':
        if (isEmployee) return <AccessDenied message={t('reports.accessDenied')} />
        return <ReportsView />
      case 'suppliers':
        if (!isAdmin) return <AccessDenied message={t('common.onlyAdminSuppliers')} />
        return <SuppliersView />
      case 'admin':
        if (!isAdmin) return <AccessDenied message={t('common.onlyAdminAdmin')} />
        return <AdminPanel />
      case 'security':
        if (isEmployee) return <AccessDenied message="Only managers and admins can access security settings" />
        return <SecurityView />
      default:
        return <DashboardView />
    }
  }

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
            </svg>
          </div>
          <p className="text-sm text-muted-foreground">Loading SmartBiz...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <AuthPage />
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SessionTimeout />
      <OfflineBanner />
      <CommandPalette />
      <div className="flex flex-1">
        <AppSidebar />
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
  const { t } = useLanguage()
  return (
    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
      <p className="text-sm font-medium">{t('common.accessDenied')}</p>
      <p className="text-xs mt-1">{message}</p>
    </div>
  )
}
