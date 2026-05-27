'use client'

import { create } from 'zustand'

export type ViewType = 'pos' | 'inventory' | 'shrinkage' | 'dashboard' | 'analytics' | 'advisor' | 'branches' | 'admin' | 'expenses' | 'suppliers' | 'customers' | 'reports'

export interface BranchInfo {
  id: string
  name: string
  code: string
  isHeadOffice: boolean
  isActive: boolean
}

export interface CompanyInfo {
  id: string
  name: string
  industry: string | null
  email: string | null
  phone: string | null
  plan: string
  isActive: boolean
  currency: string
  currencySymbol: string
  country: string
  exchangeRate: number
}

export interface CurrentUser {
  id: string
  email: string
  name: string
  role: string
  branchId: string
  companyId: string
  branch?: BranchInfo
  company?: CompanyInfo
}

interface AppState {
  currentView: ViewType
  currentUser: CurrentUser | null
  currentBranchId: string | null
  currentCompany: CompanyInfo | null
  isAuthenticated: boolean
  sidebarOpen: boolean
  branches: BranchInfo[]
  setView: (view: ViewType) => void
  setUser: (user: CurrentUser | null) => void
  setCurrentBranchId: (branchId: string | null) => void
  setCompany: (company: CompanyInfo | null) => void
  setAuthenticated: (val: boolean) => void
  setBranches: (branches: BranchInfo[]) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  logout: () => void
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'pos',
  currentUser: null,
  currentBranchId: null,
  currentCompany: null,
  isAuthenticated: false,
  sidebarOpen: false,
  branches: [],

  setView: (view) => set({ currentView: view, sidebarOpen: false }),
  setUser: (user) => set((state) => {
    const branchId = user?.role === 'Employee' && user?.branchId
      ? user.branchId
      : state.currentBranchId ?? user?.branchId ?? null
    return { currentUser: user, currentBranchId: branchId }
  }),
  setCurrentBranchId: (branchId) => set((state) => {
    if (state.currentUser?.role === 'Employee') {
      return { currentBranchId: state.currentUser.branchId }
    }
    return { currentBranchId: branchId }
  }),
  setCompany: (company) => set({ currentCompany: company }),
  setAuthenticated: (val) => set({ isAuthenticated: val }),
  setBranches: (branches) => set({ branches }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('smartbiz_session')
    }
    set({
      currentUser: null,
      currentBranchId: null,
      currentCompany: null,
      isAuthenticated: false,
      branches: [],
      currentView: 'pos',
      sidebarOpen: false,
    })
  },
}))
