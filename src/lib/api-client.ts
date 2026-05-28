// ============================================
// API CLIENT WITH AUTH TOKEN INJECTION
// Delegates to fetchWithAuth for auto-refresh and 401 handling
// ============================================

import { fetchWithAuth } from '@/lib/auth-fetch'

// Authenticated fetch wrapper
export async function apiFetch<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: string; status: number }> {
  try {
    const response = await fetchWithAuth(url, options)
    const json = await response.json()

    // If token is expired or invalid, the fetchWithAuth already handles redirect
    if (response.status === 401) {
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),

  put: <T = unknown>(url: string, body: unknown) =>
    apiFetch<T>(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),

  delete: <T = unknown>(url: string) =>
    apiFetch<T>(url, { method: 'DELETE' }),
}
