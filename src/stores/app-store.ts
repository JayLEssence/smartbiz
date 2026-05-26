'use client'

import { create } from 'zustand'

export type ViewType = 'pos' | 'inventory' | 'shrinkage' | 'dashboard' | 'analytics' | 'advisor'

export interface CurrentUser {
  id: string
  email: string
  name: string
  role: string
}

interface AppState {
  currentView: ViewType
  currentUser: CurrentUser | null
  sidebarOpen: boolean
  setView: (view: ViewType) => void
  setUser: (user: CurrentUser | null) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
}

// Will be set from the page component after login/fetch
export const useAppStore = create<AppState>((set) => ({
  currentView: 'pos',
  currentUser: null,
  sidebarOpen: false,

  setView: (view) => set({ currentView: view, sidebarOpen: false }),
  setUser: (user) => set({ currentUser: user }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}))
