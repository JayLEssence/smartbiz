// ============================================
// CSRF (Cross-Site Request Forgery) PROTECTION
// ============================================

// In-memory CSRF token store
// Maps token -> { sessionId, expiresAt }
const csrfTokenStore = new Map<string, { sessionId: string; expiresAt: number }>()

// Token TTL: 1 hour
const CSRF_TOKEN_TTL_MS = 60 * 60 * 1000

// Clean up expired tokens every 10 minutes
if (typeof globalThis !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [token, entry] of csrfTokenStore.entries()) {
      if (now > entry.expiresAt) {
        csrfTokenStore.delete(token)
      }
    }
  }, 10 * 60 * 1000)
}

/**
 * Generate random bytes using Web Crypto API (Edge Runtime compatible)
 * Falls back to Math.random for environments without Web Crypto
 */
function generateRandomHex(byteLength: number): string {
  try {
    // Web Crypto API - available in Edge Runtime
    const array = new Uint8Array(byteLength)
    crypto.getRandomValues(array)
    return Array.from(array)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  } catch {
    // Fallback: should not happen in modern environments
    let hex = ''
    for (let i = 0; i < byteLength * 2; i++) {
      hex += Math.floor(Math.random() * 16).toString(16)
    }
    return hex
  }
}

/**
 * Generate a CSRF token tied to a session ID.
 * The token is a crypto-random string stored with its associated session.
 */
export function generateCsrfToken(sessionId: string): string {
  // Generate a cryptographically random token using Web Crypto API
  const token = generateRandomHex(32)

  csrfTokenStore.set(token, {
    sessionId,
    expiresAt: Date.now() + CSRF_TOKEN_TTL_MS,
  })

  return token
}

/**
 * Validate a CSRF token against a session ID.
 * Returns true if the token is valid and matches the session.
 */
export function validateCsrfToken(token: string, sessionId: string): boolean {
  const entry = csrfTokenStore.get(token)

  if (!entry) {
    return false
  }

  // Check if token has expired
  if (Date.now() > entry.expiresAt) {
    csrfTokenStore.delete(token)
    return false
  }

  // Check if the session ID matches
  if (entry.sessionId !== sessionId) {
    return false
  }

  // Token is valid - keep it alive (don't delete on validation)
  return true
}

/**
 * Invalidate a CSRF token (e.g., on logout).
 */
export function invalidateCsrfToken(token: string): void {
  csrfTokenStore.delete(token)
}

/**
 * Clean up all CSRF tokens for a given session ID.
 */
export function cleanupSessionCsrfTokens(sessionId: string): void {
  for (const [token, entry] of csrfTokenStore.entries()) {
    if (entry.sessionId === sessionId) {
      csrfTokenStore.delete(token)
    }
  }
}
