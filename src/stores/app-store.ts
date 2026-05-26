'use client'

import { create } from 'zustand'

export type ViewType = 'pos' | 'inventory' | 'shrinkage' | 'dashboard' | 'analytics' | 'advisor' | 'branches'

export interface BranchInfo {
  id: string
  name: string
  code: string
  isHeadOffice: boolean
  isActive: boolean
}

export interface CurrentUser {
  id: string
  email: string
  name: string
  role: string
  branchId: string
  branch?: BranchInfo
}

interface AppState {
  currentView: ViewType
  currentUser: CurrentUser | null
  currentBranchId: string | null
  sidebarOpen: boolean
  branches: BranchInfo[]
  setView: (view: ViewType) => void
  setUser: (user: CurrentUser | null) => void
  setCurrentBranchId: (branchId: string | null) => void
  setBranches: (branches: BranchInfo[]) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'pos',
  currentUser: null,
  currentBranchId: null,
  sidebarOpen: false,
  branches: [],

  setView: (view) => set({ currentView: view, sidebarOpen: false }),
  setUser: (user) => set({ currentUser: user }),
  setCurrentBranchId: (branchId) => set({ currentBranchId: branchId }),
  setBranches: (branches) => set({ branches }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}))
