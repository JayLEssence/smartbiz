/**
 * Shared auth-aware fetch utilities for SmartBiz frontend.
 * All API calls should use these helpers to include the JWT Authorization header
 * and handle 401 Unauthorized responses by logging the user out.
 */

/**
 * Get the auth headers including the JWT token from localStorage.
 * Returns an object with Content-Type and Authorization headers.
 */
export function getAuthHeaders(): Record<string, string> {
  const session = JSON.parse(localStorage.getItem('smartbiz_session') || '{}')
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.token || ''}`,
  }
}

/**
 * Get only the Authorization header (no Content-Type).
 * Useful for GET or DELETE requests that don't send a JSON body.
 */
export function getAuthHeaderOnly(): Record<string, string> {
  const session = JSON.parse(localStorage.getItem('smartbiz_session') || '{}')
  return {
    'Authorization': `Bearer ${session.token || ''}`,
  }
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
