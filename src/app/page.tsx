'use client'

import { useEffect } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { useAppStore } from '@/stores/app-store'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { AppHeader } from '@/components/layout/app-header'
import { PosView } from '@/components/pos/pos-view'
import { InventoryView } from '@/components/inventory/inventory-view'
import { ShrinkageView } from '@/components/inventory/shrinkage-view'
import { DashboardView } from '@/components/dashboard/dashboard-view'
import { AnalyticsView } from '@/components/analytics/analytics-view'
import { AdvisorView } from '@/components/advisor/advisor-view'

export default function Home() {
  const isMobile = useIsMobile()
  const { currentView, setView, setUser } = useAppStore()

  // Set default view based on device and initialize user
  useEffect(() => {
    if (isMobile) {
      setView('dashboard')
    } else {
      setView('pos')
    }

    // Auto-login as admin for demo
    const initUser = async () => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'admin@smartbiz.com', password: 'demo' }),
        })
        const json = await res.json()
        if (json.success && json.data?.user) {
          setUser(json.data.user)
        }
      } catch {
        // Fallback to a default user
        setUser({
          id: 'demo',
          email: 'admin@smartbiz.com',
          name: 'Admin',
          role: 'Admin',
        })
      }
    }
    initUser()
  }, [isMobile, setView, setUser])

  const renderView = () => {
    switch (currentView) {
      case 'pos':
        return <PosView />
      case 'inventory':
        return <InventoryView />
      case 'shrinkage':
        return <ShrinkageView />
      case 'dashboard':
        return <DashboardView />
      case 'analytics':
        return <AnalyticsView />
      case 'advisor':
        return <AdvisorView />
      default:
        return <DashboardView />
    }
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
