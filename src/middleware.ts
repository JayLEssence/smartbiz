import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { checkRateLimit, getClientIdentifier, RATE_LIMITS, getRateLimitHeaders } from '@/lib/rate-limit'

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/join',
  '/api/companies',  // Company registration (creates company + admin)
  '/api/auth/refresh',
  '/api/auth/csrf',  // CSRF token endpoint
]

// Routes that have specific rate limits
const RATE_LIMITED_ROUTES: Record<string, typeof RATE_LIMITS.login> = {
  '/api/auth/login': RATE_LIMITS.login,
  '/api/auth/join': RATE_LIMITS.join,
  '/api/companies': RATE_LIMITS.register,
}

// Security headers to add to all responses
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
  // CSP relaxed for PWA compatibility and same-origin API calls
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
  ].join('; '),
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

  if (!isPublicRoute && pathname.startsWith('/api/')) {
    // Try to get token from Authorization header or cookie
    const authHeader = request.headers.get('authorization')
    const authToken = authHeader?.startsWith('Bearer ')
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
