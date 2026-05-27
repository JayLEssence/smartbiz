// ============================================
// API CLIENT WITH AUTH TOKEN INJECTION
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

// Build headers with auth token
function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  const token = getToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  return headers
}

// Authenticated fetch wrapper
export async function apiFetch<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: string; status: number }> {
  const headers = {
    ...getAuthHeaders(),
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
