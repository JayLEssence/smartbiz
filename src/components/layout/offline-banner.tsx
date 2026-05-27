'use client'

import { useOfflineMode } from '@/hooks/use-offline'
import { Wifi, WifiOff, RefreshCw, CheckCircle2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState, useEffect, useRef } from 'react'
import { useLanguage } from '@/lib/i18n/language-context'

export function OfflineBanner() {
  const { isOnline, isSyncing, pendingCount, showOfflineBanner, syncPendingActions, dismissBanner } = useOfflineMode()
  const { t } = useLanguage()
  const [syncResult, setSyncResult] = useState<{ synced: number; failed: number } | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-clear sync result after 3 seconds
  useEffect(() => {
    if (syncResult) {
      timerRef.current = setTimeout(() => {
        setSyncResult(null)
      }, 3000)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [syncResult])

  const handleSync = async () => {
    const result = await syncPendingActions()
    setSyncResult(result)
  }

  // Don't show banner if dismissed and online
  if (!showOfflineBanner && isOnline && !syncResult) return null

  // Show brief "back online" message
  if (isOnline && showOfflineBanner && !syncResult && pendingCount === 0) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[60]">
        <div className="bg-emerald-600 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4" />
          <span>{t('offline.backOnline')}</span>
          <button onClick={dismissBanner} className="ml-2 hover:bg-emerald-700 rounded p-0.5">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    )
  }

  // Offline banner
  if (!isOnline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[60]">
        <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <WifiOff className="h-4 w-4" />
            <span className="font-medium">{t('offline.youAreOffline')}</span>
            {pendingCount > 0 && (
              <span className="bg-amber-700/40 text-white text-xs px-2 py-0.5 rounded-full">
                {pendingCount} {t('offline.pending')}
              </span>
            )}
          </div>
          <button onClick={dismissBanner} className="hover:bg-amber-600 rounded p-0.5">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    )
  }

  // Online with pending actions - show sync option
  if (isOnline && (pendingCount > 0 || syncResult)) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[60]">
        <div className="bg-blue-500 text-white px-4 py-2 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Wifi className="h-4 w-4" />
            <span>
              {syncResult
                ? `${syncResult.synced} ${t('offline.synced')} ${syncResult.failed > 0 ? `• ${syncResult.failed} ${t('offline.failed')}` : ''}`
                : `${pendingCount} ${t('offline.pendingSync')}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleSync}
              disabled={isSyncing}
              className="h-7 text-xs border-white/40 text-white hover:bg-white/20 hover:text-white bg-transparent"
            >
              {isSyncing ? (
                <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
              )}
              {isSyncing ? t('offline.syncing') : t('offline.syncNow')}
            </Button>
            <button onClick={dismissBanner} className="hover:bg-blue-600 rounded p-0.5">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
