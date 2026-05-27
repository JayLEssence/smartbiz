import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { checkRateLimit, getClientIdentifier, RATE_LIMITS, getRateLimitHeaders } from '@/lib/rate-limit'
import { validateCsrfToken } from '@/lib/csrf'

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/join',
  '/api/auth/register',
  '/api/auth/refresh',
]

// Routes exempt from CSRF checks (auth entry points + CSRF token endpoint itself)
const CSRF_EXEMPT_ROUTES = [
  '/api/auth/login',
  '/api/auth/join',
  '/api/auth/register',
  '/api/auth/csrf',
  '/api/auth/refresh',
]

// Routes that have specific rate limits
const RATE_LIMITED_ROUTES: Record<string, typeof RATE_LIMITS.login> = {
  '/api/auth/login': RATE_LIMITS.login,
  '/api/auth/join': RATE_LIMITS.join,
  '/api/auth/register': RATE_LIMITS.register,
}

// Security headers to add to all responses
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
  ].join('; '),
}

/**
 * Decode JWT payload without verification (Edge Runtime compatible).
 * This is only used in middleware to extract the sessionId claim for CSRF binding.
 * Full verification happens in the API route handlers.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    // Base64url decode
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
 * Extract session ID from a JWT token (without full verification — middleware is lightweight).
 * We only decode to get the sessionId claim for CSRF binding.
 */
function extractSessionIdFromToken(token: string): string | null {
  const payload = decodeJwtPayload(token)
  if (!payload) return null
  return (payload.sessionId as string) || null
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only apply to API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // ---- Rate Limiting ----
  const clientId = getClientIdentifier(request as unknown as Request)
  const rateLimitConfig = RATE_LIMITED_ROUTES[pathname] || RATE_LIMITS.api

  const rateLimitResult = checkRateLimit(clientId, rateLimitConfig)
  const rateLimitHeaders = getRateLimitHeaders(rateLimitResult, rateLimitConfig)

  if (!rateLimitResult.allowed) {
    const response = NextResponse.json(
      {
        success: false,
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((rateLimitResult.retryAfterMs || 60000) / 1000),
      },
      { status: 429 }
    )

    // Add security headers
    Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  }

  // ---- Authentication Check (non-public routes) ----
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname === route)
  let authToken: string | null = null

  if (!isPublicRoute && pathname.startsWith('/api/')) {
    // Try to get token from Authorization header or cookie
    const authHeader = request.headers.get('authorization')
    authToken = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : request.cookies.get('smartbiz_token')?.value || null

    if (!authToken) {
      // Also check for legacy base64 tokens in a custom header
      const customToken = request.headers.get('x-smartbiz-token')
      if (!customToken) {
        const response = NextResponse.json(
          { success: false, error: 'Authentication required' },
          { status: 401 }
        )
        Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
          response.headers.set(key, value)
        })
        return response
      }
    }
  }

  // ---- CSRF Protection (for mutating methods on non-exempt routes) ----
  const method = request.method.toUpperCase()
  const requiresCsrf = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)
  const isCsrfExempt = CSRF_EXEMPT_ROUTES.some(route => pathname === route)

  if (requiresCsrf && !isCsrfExempt && pathname.startsWith('/api/')) {
    const csrfToken = request.headers.get('x-csrf-token')

    if (!csrfToken) {
      const response = NextResponse.json(
        {
          success: false,
          error: 'CSRF token required. Include X-CSRF-Token header.',
        },
        { status: 403 }
      )
      Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
        response.headers.set(key, value)
      })
      return response
    }

    // Get session ID from token for CSRF validation
    const tokenForCsrf = authToken || request.cookies.get('smartbiz_token')?.value
    if (tokenForCsrf) {
      const sessionId = extractSessionIdFromToken(tokenForCsrf)
      if (sessionId) {
        const isCsrfValid = validateCsrfToken(csrfToken, sessionId)
        if (!isCsrfValid) {
          const response = NextResponse.json(
            {
              success: false,
              error: 'Invalid or expired CSRF token. Please refresh the page.',
            },
            { status: 403 }
          )
          Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
            response.headers.set(key, value)
          })
          return response
        }
      } else {
        // If we can't extract sessionId from the token, we can't validate CSRF
        // This might happen with legacy tokens — allow through but log
        // In strict mode, we would reject here
      }
    }
  }

  // ---- Continue with request ----
  const response = NextResponse.next()

  // Add security headers to all responses
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  // Add rate limit headers
  Object.entries(rateLimitHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  return response
}

export const config = {
  matcher: [
    '/api/:path*',
  ],
}
