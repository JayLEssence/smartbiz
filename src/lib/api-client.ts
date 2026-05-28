// ============================================
// API CLIENT WITH AUTH TOKEN INJECTION + CSRF
// ============================================

// Get the stored session token
function getToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem('smartbiz_session')
    if (stored) {
      const data = JSON.parse(stored)
      return data?.token || null
    }
  } catch {
    // ignore
  }
  return null
}

// Build headers with auth token and CSRF token for mutating requests
function getAuthHeaders(method: string = 'GET'): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  const token = getToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  // Include cached CSRF token for mutating requests
  const requiresCsrf = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase())
  if (requiresCsrf) {
    // Try to get the CSRF token from the auth-fetch module's cache
    try {
      const csrfToken = getCachedCsrfToken()
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken
      }
    } catch {
      // CSRF token not available yet
    }
  }

  return headers
}

// Access the cached CSRF token from auth-fetch module
// We use a shared cache approach
let _cachedCsrfToken: string | null = null
let _csrfTokenExpiry = 0

export function setCachedCsrfToken(token: string, expiry: number): void {
  _cachedCsrfToken = token
  _csrfTokenExpiry = expiry
}

export function getCachedCsrfToken(): string | null {
  if (_cachedCsrfToken && Date.now() < _csrfTokenExpiry) {
    return _cachedCsrfToken
  }
  return null
}

// Authenticated fetch wrapper with CSRF support
export async function apiFetch<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: string; status: number }> {
  const method = (options.method || 'GET').toUpperCase()
  const headers = {
    ...getAuthHeaders(method),
    ...(options.headers as Record<string, string> || {}),
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    })

    const json = await response.json()

    // If token is expired or invalid, redirect to login
    if (response.status === 401) {
      // Clear session and redirect
      if (typeof window !== 'undefined') {
        localStorage.removeItem('smartbiz_session')
        window.dispatchEvent(new CustomEvent('auth:expired'))
      }
    }

    // Handle CSRF errors - try to refresh CSRF token
    if (response.status === 403 && json.error?.includes('CSRF')) {
      // Clear cached CSRF and retry once
      _cachedCsrfToken = null
      _csrfTokenExpiry = 0

      try {
        const session = JSON.parse(localStorage.getItem('smartbiz_session') || '{}')
        if (session.token) {
          const csrfRes = await fetch('/api/auth/csrf', {
            headers: { 'Authorization': `Bearer ${session.token}` },
          })
          if (csrfRes.ok) {
            const csrfJson = await csrfRes.json()
            if (csrfJson.csrfToken) {
              setCachedCsrfToken(csrfJson.csrfToken, Date.now() + 50 * 60 * 1000)

              // Retry with fresh CSRF token
              const retryHeaders = {
                ...headers,
                'X-CSRF-Token': csrfJson.csrfToken,
              }
              const retryResponse = await fetch(url, {
                ...options,
                headers: retryHeaders,
              })
              const retryJson = await retryResponse.json()

              if (retryResponse.status === 401) {
                if (typeof window !== 'undefined') {
                  localStorage.removeItem('smartbiz_session')
                  window.dispatchEvent(new CustomEvent('auth:expired'))
                }
              }

              return {
                success: retryJson.success,
                data: retryJson.data,
                error: retryJson.error,
                status: retryResponse.status,
              }
            }
          }
        }
      } catch {
        // CSRF refresh failed, return original error
      }
    }

    return {
      success: json.success,
      data: json.data,
      error: json.error,
      status: response.status,
    }
  } catch {
    return {
      success: false,
      error: 'Network error. Please check your connection.',
      status: 0,
    }
  }
}

// Convenience methods
export const api = {
  get: <T = unknown>(url: string) => apiFetch<T>(url, { method: 'GET' }),

  post: <T = unknown>(url: string, body: unknown) =>
    apiFetch<T>(url, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  put: <T = unknown>(url: string, body: unknown) =>
    apiFetch<T>(url, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  delete: <T = unknown>(url: string) =>
    apiFetch<T>(url, { method: 'DELETE' }),
}
