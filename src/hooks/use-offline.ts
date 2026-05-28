'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getAuthHeaders } from '@/lib/auth-fetch'

interface OfflineAction {
  id: string
  url: string
  method: string
  body: string
  timestamp: number
  description: string
}

const STORAGE_KEY = 'smartbiz_offline_queue'
const MAX_QUEUE_SIZE = 100

export function useOfflineMode() {
  // Initialize from browser state (lazy initializers to avoid SSR issues)
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof navigator !== 'undefined') return navigator.onLine
    return true
  })
  const [pendingActions, setPendingActions] = useState<OfflineAction[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        return stored ? JSON.parse(stored) : []
      } catch { return [] }
    }
    return []
  })
  const [isSyncing, setIsSyncing] = useState(false)
  const [showOfflineBanner, setShowOfflineBanner] = useState(() => {
    if (typeof navigator !== 'undefined') return !navigator.onLine
    return false
  })

  // Load pending actions from localStorage
  const loadPendingActions = useCallback((): OfflineAction[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }, [])

  // Save pending actions to localStorage
  const savePendingActions = useCallback((actions: OfflineAction[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(actions.slice(0, MAX_QUEUE_SIZE)))
    } catch {
      // Storage full or unavailable
    }
  }, [])

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setShowOfflineBanner(true)
      setTimeout(() => setShowOfflineBanner(false), 3000)
    }

    const handleOffline = () => {
      setIsOnline(false)
      setShowOfflineBanner(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Queue an action for offline sync
  const queueAction = useCallback((action: Omit<OfflineAction, 'id' | 'timestamp'>) => {
    const newAction: OfflineAction = {
      ...action,
      id: `offline_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now(),
    }
    const updated = [...loadPendingActions(), newAction]
    savePendingActions(updated)
    setPendingActions(updated)
    return newAction.id
  }, [loadPendingActions, savePendingActions])

  // Enhanced fetch that queues when offline
  const offlineFetch = useCallback(async (url: string, options?: RequestInit): Promise<Response> => {
    if (navigator.onLine) {
      try {
        const response = await fetch(url, options)
        return response
      } catch (err) {
        // Network failed even though navigator.onLine is true
        // Queue the action if it's a write operation
        if (options?.method && options.method !== 'GET') {
          queueAction({
            url,
            method: options.method,
            body: options.body?.toString() ?? '',
            description: `Pending: ${options.method} ${url}`,
          })
          // Return a mock success response
          return new Response(
            JSON.stringify({ success: true, offline: true, message: 'Action queued for sync' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        }
        throw err
      }
    } else {
      // We're offline
      if (options?.method && options.method !== 'GET') {
        queueAction({
          url,
          method: options.method,
          body: options.body?.toString() ?? '',
          description: `Pending: ${options.method} ${url}`,
        })
        return new Response(
          JSON.stringify({ success: true, offline: true, message: 'Action queued - will sync when online' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
      // GET request while offline - return error
      return new Response(
        JSON.stringify({ success: false, error: 'You are offline' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }, [queueAction])

  // Sync pending actions
  const syncPendingActions = useCallback(async (): Promise<{ synced: number; failed: number }> => {
    const actions = loadPendingActions()
    if (actions.length === 0) return { synced: 0, failed: 0 }

    setIsSyncing(true)
    let synced = 0
    let failed = 0
    const remaining: OfflineAction[] = []

    for (const action of actions) {
      try {
        const response = await fetch(action.url, {
          method: action.method,
          headers: getAuthHeaders(),
          body: action.body || undefined,
        })
        if (response.ok) {
          synced++
        } else {
          failed++
          // Keep actions that failed with server errors (maybe transient)
          if (response.status >= 500) {
            remaining.push(action)
          }
          // 4xx errors mean the request is bad, discard it
        }
      } catch {
        // Network error - keep for retry
        failed++
        remaining.push(action)
      }
    }

    savePendingActions(remaining)
    setPendingActions(remaining)
    setIsSyncing(false)

    return { synced, failed }
  }, [loadPendingActions, savePendingActions])

  // Auto-sync when coming back online (using ref to avoid effect setState)
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (isOnline && pendingActions.length > 0 && !isSyncing) {
      syncTimeoutRef.current = setTimeout(() => {
        syncPendingActions()
      }, 100)
    }
    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
    }
  }, [isOnline, pendingActions.length, isSyncing, syncPendingActions])

  // Clear all pending actions
  const clearPendingActions = useCallback(() => {
    savePendingActions([])
    setPendingActions([])
  }, [savePendingActions])

  // Dismiss the offline banner
  const dismissBanner = useCallback(() => {
    setShowOfflineBanner(false)
  }, [])

  return {
    isOnline,
    isSyncing,
    pendingActions,
    pendingCount: pendingActions.length,
    showOfflineBanner,
    offlineFetch,
    queueAction,
    syncPendingActions,
    clearPendingActions,
    dismissBanner,
  }
}
