import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { logAudit, getRequestInfo } from '@/lib/audit-log'
import { cleanupSessionCsrfTokens } from '@/lib/csrf'

/**
 * POST /api/auth/logout
 * Invalidates the current session server-side and clears cookies.
 */
export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request)
    const { ipAddress, userAgent } = getRequestInfo(request)

    if (auth.authenticated && auth.user) {
      // Find and invalidate the current session
      try {
        // Get the token from the Authorization header
        const authHeader = request.headers.get('authorization')
        const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null

        if (token) {
          // Decode JWT to get sessionId (without verification - already done by authenticateRequest)
          const parts = token.split('.')
          if (parts.length === 3) {
            try {
              const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
              const json = decodeURIComponent(
                atob(base64)
                  .split('')
                  .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                  .join('')
              )
              const payload = JSON.parse(json)
              const sessionId = payload.sessionId

              if (sessionId) {
                // Invalidate the session in the database
                await db.session.updateMany({
                  where: {
                    userId: auth.user.id,
                    tokenHash: sessionId,
                    isValid: true,
                  },
                  data: { isValid: false },
                })

                // Clean up CSRF tokens for this session
                cleanupSessionCsrfTokens(sessionId)
              }
            } catch {
              // If we can't decode the token, just continue
            }
          }
        }
      } catch {
        // Session invalidation is non-critical
      }

      logAudit({
        action: 'LOGOUT',
        userId: auth.user.id,
        userEmail: auth.user.email,
        companyId: auth.user.companyId,
        branchId: auth.user.branchId,
        ipAddress,
        userAgent,
        details: 'User logged out',
      })
    }

    const response = NextResponse.json({ success: true })

    // Clear auth cookies
    response.cookies.set('smartbiz_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/',
    })

    response.cookies.set('smartbiz_refresh', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/api/auth',
    })

    return response
  } catch (error) {
    console.error('Logout error:', error)
    // Even if logout fails on server, clear cookies
    const response = NextResponse.json({ success: true })
    response.cookies.set('smartbiz_token', '', { maxAge: 0, path: '/' })
    response.cookies.set('smartbiz_refresh', '', { maxAge: 0, path: '/api/auth' })
    return response
  }
}
