/**
 * Shared auth-aware fetch utilities for SmartBiz frontend.
 * All API calls should use these helpers to include the JWT Authorization header,
 * handle 401 Unauthorized responses, and auto-refresh tokens.
 */

// ============================================
// SESSION HELPERS
// ============================================

interface SessionData {
  user?: {
    id: string
    email: string
    name: string
    role: string
    branchId: string
    companyId: string
    twoFactorEnabled?: boolean
    mustChangePassword?: boolean
    branch: {
      id: string
      name: string
      code: string
      isHeadOffice: boolean
    }
    company: {
      id: string
      name: string
      industry: string | null
      plan: string
      email: string | null
      phone: string | null
      address: string | null
      logoUrl: string | null
      isActive: boolean
      currency?: string
      currencySymbol?: string
      country?: string
      exchangeRate?: number
    }
  }
  token?: string
  refreshToken?: string
}

function getSession(): SessionData {
  try {
    return JSON.parse(localStorage.getItem('smartbiz_session') || '{}')
  } catch {
    return {}
  }
}

function saveSession(data: SessionData): void {
  localStorage.setItem('smartbiz_session', JSON.stringify(data))
}

// ============================================
// JWT EXPIRY CHECK
// ============================================

/**
 * Decode the JWT payload without verification (client-side only).
 * Returns the payload object or null if invalid.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

/**
 * Check if the JWT token is about to expire within the given number of minutes.
 * Returns true if the token is expired or will expire within the threshold.
 */
function isTokenExpiringSoon(token: string, minutesThreshold: number = 5): boolean {
  const payload = decodeJwtPayload(token)
  if (!payload || !payload.exp) return true

  const expiresAt = (payload.exp as number) * 1000 // Convert to ms
  const threshold = minutesThreshold * 60 * 1000 // Convert to ms
  return Date.now() + threshold >= expiresAt
}

// ============================================
// TOKEN REFRESH
// ============================================

let refreshPromise: Promise<boolean> | null = null

/**
 * Attempt to refresh the access token using the refresh token.
 * Returns true if refresh was successful, false otherwise.
 */
async function refreshAccessToken(): Promise<boolean> {
  const session = getSession()
  if (!session.refreshToken) {
    return false
  }

  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    })

    if (!response.ok) {
      return false
    }

    const json = await response.json()
    if (!json.success || !json.data) {
      return false
    }

    // Update localStorage with new session data
    saveSession(json.data)

    // Dispatch an event so the app can update its state
    window.dispatchEvent(new CustomEvent('auth:token-refreshed', {
      detail: json.data,
    }))

    return true
  } catch {
    return false
  }
}

/**
 * Refresh the token if needed, with deduplication to prevent concurrent refreshes.
 */
async function ensureFreshToken(): Promise<boolean> {
  const session = getSession()
  if (!session.token) return false

  // If token is not expiring soon, no need to refresh
  if (!isTokenExpiringSoon(session.token, 5)) {
    return true
  }

  // Deduplicate concurrent refresh attempts
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null
    })
  }

  return refreshPromise
}

// ============================================
// AUTH HEADER HELPERS
// ============================================

/**
 * Get the auth headers including the JWT token from localStorage.
 * NOTE: For automatic token refresh, use fetchWithAuth() or the api helpers instead.
 * This is kept for backward compatibility and simple use cases.
 */
export function getAuthHeaders(): Record<string, string> {
  const session = getSession()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.token || ''}`,
  }
  return headers
}

/**
 * Get only the Authorization header (no Content-Type).
 * Useful for GET or DELETE requests that don't send a JSON body.
 */
export function getAuthHeaderOnly(): Record<string, string> {
  const session = getSession()
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${session.token || ''}`,
  }
  return headers
}

/**
 * Handle a 401 Unauthorized response by clearing the session and redirecting to login.
 */
export function handleUnauthorized(): void {
  localStorage.removeItem('smartbiz_session')
  window.location.href = '/'
}

/**
 * Check if a response is 401 and handle it.
 * Returns true if the response was 401 (and was handled), false otherwise.
 */
export function checkUnauthorized(response: Response): boolean {
  if (response.status === 401) {
    handleUnauthorized()
    return true
  }
  return false
}

// ============================================
// fetchWithAuth - SMART FETCH WITH AUTO-REFRESH
// ============================================

/**
 * Auth-aware fetch wrapper that:
 * 1. Auto-refreshes the JWT if it's about to expire (within 5 minutes)
 * 2. Includes Authorization header for all requests
 * 3. On 401: tries to refresh the token once, then retries the request
 * 4. Only clears session if refresh also fails
 */
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Step 1: Ensure we have a fresh token
  const tokenFresh = await ensureFreshToken()
  if (!tokenFresh) {
    const session = getSession()
    if (!session.token) {
      handleUnauthorized()
      return new Response(JSON.stringify({ success: false, error: 'Not authenticated' }), { status: 401 })
    }
  }

  // Get the latest session data (may have been updated by refresh)
  const session = getSession()
  const token = session.token || ''

  // Step 2: Build headers
  const headers = new Headers(options.headers)

  // Set Authorization
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  // Set Content-Type for JSON requests if not already set
  const method = (options.method || 'GET').toUpperCase()
  if (!headers.has('Content-Type') && method !== 'GET' && method !== 'HEAD') {
    // Only set if there's a body that looks like JSON
    if (options.body && typeof options.body === 'string') {
      headers.set('Content-Type', 'application/json')
    }
  }

  // Step 3: Make the request
  let response = await fetch(url, {
    ...options,
    headers,
  })

  // Step 4: On 401, try to refresh token and retry ONCE
  if (response.status === 401) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      // Retry with new token
      const newSession = getSession()
      const newHeaders = new Headers(options.headers)
      if (!newHeaders.has('Authorization')) {
        newHeaders.set('Authorization', `Bearer ${newSession.token || ''}`)
      }
      if (!newHeaders.has('Content-Type') && method !== 'GET' && method !== 'HEAD') {
        if (options.body && typeof options.body === 'string') {
          newHeaders.set('Content-Type', 'application/json')
        }
      }
      response = await fetch(url, {
        ...options,
        headers: newHeaders,
      })

      // If still 401 after refresh, then truly unauthorized
      if (response.status === 401) {
        handleUnauthorized()
      }
    } else {
      // Refresh failed, clear session
      handleUnauthorized()
    }
  }

  return response
}

// ============================================
// CONVENIENCE API METHODS
// ============================================

/**
 * Auth-aware GET request with auto-refresh.
 */
export async function apiGet(url: string): Promise<Response> {
  return fetchWithAuth(url, { method: 'GET' })
}

/**
 * Auth-aware POST request with auto-refresh.
 */
export async function apiPost(url: string, body: unknown): Promise<Response> {
  return fetchWithAuth(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/**
 * Auth-aware PUT request with auto-refresh.
 */
export async function apiPut(url: string, body: unknown): Promise<Response> {
  return fetchWithAuth(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/**
 * Auth-aware DELETE request with auto-refresh.
 */
export async function apiDelete(url: string): Promise<Response> {
  return fetchWithAuth(url, { method: 'DELETE' })
}

// ============================================
// INITIALIZATION HELPER
// ============================================

/**
 * Get the JWT token's expiry time as a Date object.
 * Returns null if the token cannot be decoded.
 */
export function getTokenExpiry(): Date | null {
  const session = getSession()
  if (!session.token) return null

  const payload = decodeJwtPayload(session.token)
  if (!payload || !payload.exp) return null

  return new Date((payload.exp as number) * 1000)
}
