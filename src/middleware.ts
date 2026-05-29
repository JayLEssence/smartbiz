import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { checkRateLimit, getClientIdentifier, RATE_LIMITS, getRateLimitHeaders, type RateLimitConfig } from '@/lib/rate-limit'

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
  '/api/auth/reset-password',
  '/api/auth/reset-password/confirm',
]

// Routes that have specific rate limits
const RATE_LIMITED_ROUTES: Record<string, RateLimitConfig> = {
  '/api/auth/login': RATE_LIMITS.login,
  '/api/auth/join': RATE_LIMITS.join,
  '/api/companies': RATE_LIMITS.register,
}

// HTTP methods that mutate state
const MUTATION_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH'])

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

function addSecurityHeaders(response: NextResponse): void {
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
}

function jsonResponse(data: Record<string, unknown>, status: number): NextResponse {
  const response = NextResponse.json(data, { status })
  addSecurityHeaders(response)
  return response
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const method = request.method

  // Only apply to API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // ---- Rate Limiting ----
  const clientId = getClientIdentifier(request as unknown as Request)
  const isMutation = MUTATION_METHODS.has(method)

  // Use stricter rate limits for write endpoints
  const rateLimitConfig = RATE_LIMITED_ROUTES[pathname] || (isMutation ? RATE_LIMITS.apiWrite : RATE_LIMITS.api)

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

    addSecurityHeaders(response)
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  }

  // ---- Authentication Check (non-public routes) ----
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname === route)

  if (!isPublicRoute && pathname.startsWith('/api/')) {
    const authHeader = request.headers.get('authorization')
    const authToken = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : request.cookies.get('smartbiz_token')?.value || null

    if (!authToken) {
      const customToken = request.headers.get('x-smartbiz-token')
      if (!customToken) {
        return jsonResponse({ success: false, error: 'Authentication required' }, 401)
      }
    }
  }

  // ---- CSRF Protection (mutation requests) ----
  // Require X-CSRF-Token header on state-changing requests to same-origin pages
  // API-to-API calls via Authorization header are exempt
  const hasAuthHeader = request.headers.get('authorization')?.startsWith('Bearer ')
  if (isMutation && !hasAuthHeader && !isPublicRoute) {
    const csrfToken = request.headers.get('x-csrf-token')
    if (!csrfToken) {
      return jsonResponse({ success: false, error: 'CSRF token required' }, 403)
    }
  }

  // ---- Continue with request ----
  const response = NextResponse.next()

  addSecurityHeaders(response)
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
