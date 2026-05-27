import { NextResponse } from 'next/server'
import {
  verifyRefreshToken,
  generateAccessToken,
  generateRefreshToken,
  extractTokenFromRequest,
} from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit, getRequestInfo } from '@/lib/audit-log'

export async function POST(request: Request) {
  try {
    // Extract refresh token from body or cookie
    let refreshToken: string | null = null

    // Try request body first
    try {
      const body = await request.json()
      refreshToken = body.refreshToken || null
    } catch {
      // No JSON body, try cookie
    }

    // Fallback to cookie
    if (!refreshToken) {
      const cookieHeader = request.headers.get('cookie')
      if (cookieHeader) {
        const cookies = Object.fromEntries(
          cookieHeader.split(';').map(c => {
            const [key, ...v] = c.trim().split('=')
            return [key, v.join('=')]
          })
        )
        refreshToken = cookies['smartbiz_refresh'] || null
      }
    }

    // Last resort: try the access token from Authorization header
    // (some clients may only have the access token)
    if (!refreshToken) {
      const accessToken = extractTokenFromRequest(request)
      if (accessToken) {
        // We can't refresh with an access token directly, but we can check
        // if it's still valid and return it (no-op refresh)
        return NextResponse.json(
          { success: false, error: 'No refresh token provided' },
          { status: 401 }
        )
      }
      return NextResponse.json(
        { success: false, error: 'No refresh token provided' },
        { status: 401 }
      )
    }

    // Verify the refresh token
    const payload = verifyRefreshToken(refreshToken)
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired refresh token' },
        { status: 401 }
      )
    }

    // Verify user still exists and is active
    const user = await db.user.findUnique({
      where: { id: payload.userId },
      include: {
        branch: true,
        company: true,
      },
    })

    if (!user || !user.isActive) {
      return NextResponse.json(
        { success: false, error: 'User account is deactivated' },
        { status: 401 }
      )
    }

    // Generate new tokens
    const newSessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const newTokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      branchId: user.branchId,
      sessionId: newSessionId,
    }

    const newAccessToken = generateAccessToken(newTokenPayload)
    const newRefreshToken = generateRefreshToken(newTokenPayload)

    // Update or create session in database
    try {
      // Try to update existing session
      const existingSession = await db.session.findFirst({
        where: {
          userId: user.id,
          isValid: true,
        },
        orderBy: { createdAt: 'desc' },
      })

      if (existingSession) {
        await db.session.update({
          where: { id: existingSession.id },
          data: {
            tokenHash: newSessionId, // Store session ID as token hash for verification
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            isValid: true,
          },
        })
      } else {
        // Create new session
        const { ipAddress, userAgent } = getRequestInfo(request)
        await db.session.create({
          data: {
            userId: user.id,
            companyId: user.companyId,
            tokenHash: newSessionId,
            deviceInfo: userAgent,
            ipAddress,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            isValid: true,
          },
        })
      }
    } catch {
      // Session update is non-critical; continue with token refresh
    }

    // Audit log
    const { ipAddress, userAgent } = getRequestInfo(request)
    logAudit({
      action: 'LOGIN_SUCCESS',
      userId: user.id,
      userEmail: user.email,
      companyId: user.companyId,
      branchId: user.branchId,
      ipAddress,
      userAgent,
      details: 'Token refreshed',
    })

    // Build response with full user data (same structure as login)
    const responseData = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        branchId: user.branchId,
        companyId: user.companyId,
        twoFactorEnabled: user.twoFactorEnabled || false,
        mustChangePassword: user.mustChangePassword || false,
        branch: {
          id: user.branch.id,
          name: user.branch.name,
          code: user.branch.code,
          isHeadOffice: user.branch.isHeadOffice,
        },
        company: {
          id: user.company.id,
          name: user.company.name,
          industry: user.company.industry,
          plan: user.company.plan,
          email: user.company.email,
          phone: user.company.phone,
          address: user.company.address,
          logoUrl: user.company.logoUrl,
          isActive: user.company.isActive,
          currency: user.company.currency,
          currencySymbol: user.company.currencySymbol,
          country: user.company.country,
          exchangeRate: user.company.exchangeRate,
        },
      },
      token: newAccessToken,
      refreshToken: newRefreshToken,
    }

    const response = NextResponse.json({
      success: true,
      data: responseData,
    })

    // Update httpOnly cookies
    response.cookies.set('smartbiz_token', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60,
      path: '/',
    })

    response.cookies.set('smartbiz_refresh', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60,
      path: '/api/auth',
    })

    return response
  } catch (error) {
    console.error('Token refresh error:', error)
    return NextResponse.json(
      { success: false, error: 'Token refresh failed' },
      { status: 500 }
    )
  }
}
