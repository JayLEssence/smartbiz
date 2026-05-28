// ============================================
// RATE LIMITING - In-Memory Implementation
// ============================================

interface RateLimitEntry {
  count: number
  resetTime: number
  blocked: boolean
}

const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up expired entries every 5 minutes
if (typeof globalThis !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.resetTime) {
        rateLimitStore.delete(key)
      }
    }
  }, 5 * 60 * 1000)
}

export interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Max requests per window
  keyPrefix?: string
}

export const RATE_LIMITS = {
  // Authentication endpoints - strict limits
  login: { windowMs: 15 * 60 * 1000, maxRequests: 10, keyPrefix: 'login' }, // 10 per 15 min
  join: { windowMs: 60 * 60 * 1000, maxRequests: 5, keyPrefix: 'join' }, // 5 per hour
  register: { windowMs: 60 * 60 * 1000, maxRequests: 3, keyPrefix: 'register' }, // 3 per hour

  // Password reset
  passwordReset: { windowMs: 60 * 60 * 1000, maxRequests: 3, keyPrefix: 'pwreset' }, // 3 per hour

  // General API - moderate limits
  api: { windowMs: 60 * 1000, maxRequests: 200, keyPrefix: 'api' }, // 200 per minute

  // Write operations - stricter
  apiWrite: { windowMs: 60 * 1000, maxRequests: 30, keyPrefix: 'apiw' }, // 30 per minute

  // AI-powered endpoints - very strict
  advisor: { windowMs: 60 * 1000, maxRequests: 10, keyPrefix: 'advisor' }, // 10 per minute
} as const

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
  retryAfterMs?: number
}

export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const key = `${config.keyPrefix || 'default'}:${identifier}`
  const now = Date.now()

  const existing = rateLimitStore.get(key)

  // No entry or window expired - create new
  if (!existing || now > existing.resetTime) {
    const resetTime = now + config.windowMs
    rateLimitStore.set(key, { count: 1, resetTime, blocked: false })
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime,
    }
  }

  // Within window - increment count
  if (existing.count >= config.maxRequests) {
    existing.blocked = true
    return {
      allowed: false,
      remaining: 0,
      resetTime: existing.resetTime,
      retryAfterMs: existing.resetTime - now,
    }
  }

  existing.count++
  return {
    allowed: true,
    remaining: config.maxRequests - existing.count,
    resetTime: existing.resetTime,
  }
}

// Helper to get client identifier from request
export function getClientIdentifier(request: Request): string {
  // Try various headers for the real IP
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const cfIp = request.headers.get('cf-connecting-ip')

  if (cfIp) return cfIp
  if (realIp) return realIp
  if (forwarded) return forwarded.split(',')[0].trim()

  // Fallback to a hash of user agent
  const ua = request.headers.get('user-agent') || 'unknown'
  return `ua:${ua.slice(0, 50)}`
}

// Helper to add rate limit headers to response
export function getRateLimitHeaders(result: RateLimitResult, config: RateLimitConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': config.maxRequests.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
  }

  if (!result.allowed && result.retryAfterMs) {
    headers['Retry-After'] = Math.ceil(result.retryAfterMs / 1000).toString()
  }

  return headers
}
