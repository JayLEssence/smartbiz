'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '@/stores/app-store'
import { getTokenExpiry, invalidateCsrfCache } from '@/lib/auth-fetch'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Clock, Loader2, ShieldAlert } from 'lucide-react'

// Warn 5 minutes before expiry
const WARNING_THRESHOLD_MS = 5 * 60 * 1000
// Check every 30 seconds
const CHECK_INTERVAL_MS = 30 * 1000

export function SessionTimeout() {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated)
  const logout = useAppStore((s) => s.logout)
  const setAuthToken = useAppStore((s) => s.setAuthToken)
  const [showWarning, setShowWarning] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [timeLeft, setTimeLeft] = useState<string>('')
  const [expired, setExpired] = useState(false)

  const formatTimeLeft = useCallback((ms: number): string => {
    if (ms <= 0) return '0:00'
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }, [])

  const checkExpiry = useCallback(() => {
    const expiry = getTokenExpiry()
    if (!expiry) return

    const now = Date.now()
    const expiryMs = expiry.getTime()
    const remaining = expiryMs - now

    if (remaining <= 0) {
      // Token has expired
      setShowWarning(false)
      setExpired(true)
      invalidateCsrfCache()
      logout()
      return
    }

    if (remaining <= WARNING_THRESHOLD_MS) {
      setTimeLeft(formatTimeLeft(remaining))
      setShowWarning(true)
    } else {
      setShowWarning(false)
    }
  }, [logout, formatTimeLeft])

  // Periodically check token expiry
  useEffect(() => {
    if (!isAuthenticated) {
      setShowWarning(false)
      setExpired(false)
      return
    }

    // Initial check
    checkExpiry()

    const interval = setInterval(checkExpiry, CHECK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [isAuthenticated, checkExpiry])

  // Handle "Stay Logged In" — refresh the token
  const handleStayLoggedIn = async () => {
    setRefreshing(true)
    try {
      const session = JSON.parse(localStorage.getItem('smartbiz_session') || '{}')
      if (!session.refreshToken) {
        logout()
        return
      }

      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      })

      if (!response.ok) {
        // Refresh failed — log out
        logout()
        return
      }

      const json = await response.json()
      if (!json.success || !json.data) {
        logout()
        return
      }

      // Update localStorage
      localStorage.setItem('smartbiz_session', JSON.stringify(json.data))

      // Update app state
      setAuthToken(json.data.token)

      // Dispatch event for other parts of the app
      window.dispatchEvent(new CustomEvent('auth:token-refreshed', {
        detail: json.data,
      }))

      // Hide the warning
      setShowWarning(false)
    } catch {
      logout()
    } finally {
      setRefreshing(false)
    }
  }

  // Handle "Log Out Now"
  const handleLogout = () => {
    setShowWarning(false)
    invalidateCsrfCache()
    logout()
  }

  if (!isAuthenticated) return null

  return (
    <>
      {/* Expiry Warning Dialog */}
      <AlertDialog open={showWarning && !expired}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              Session Expiring Soon
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Your session will expire in <span className="font-semibold text-orange-600">{timeLeft}</span>.
                  Any unsaved changes may be lost if you are logged out.
                </p>
                <p className="text-sm text-muted-foreground">
                  Would you like to stay logged in?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleLogout}
              disabled={refreshing}
              className="sm:mr-auto"
            >
              Log Out Now
            </Button>
            <Button
              onClick={handleStayLoggedIn}
              disabled={refreshing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {refreshing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Refreshing...
                </>
              ) : (
                'Stay Logged In'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Session Expired Dialog */}
      <AlertDialog open={expired}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Session Expired
            </AlertDialogTitle>
            <AlertDialogDescription>
              Your session has expired for security reasons. Please log in again to continue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              onClick={() => setExpired(false)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              OK
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
