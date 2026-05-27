import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import {
  hashPassword,
  verifyPassword,
  isPasswordHashed,
  generateAccessToken,
  generateRefreshToken,
  handleFailedLogin,
  isAccountLocked,
  resetLoginAttempts,
  checkPasswordStrength,
} from '@/lib/auth'
import { safeValidate, loginSchema, sanitizeString } from '@/lib/validation'
import { logAudit, getRequestInfo } from '@/lib/audit-log'
import { checkRateLimit, getClientIdentifier, RATE_LIMITS, getRateLimitHeaders } from '@/lib/rate-limit'

export async function POST(request: Request) {
  try {
    // ---- Rate Limiting ----
    const clientId = getClientIdentifier(request)
    const rateResult = checkRateLimit(clientId, RATE_LIMITS.login)
    if (!rateResult.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many login attempts. Please try again later.', retryAfter: Math.ceil((rateResult.retryAfterMs || 60000) / 1000) },
        { status: 429, headers: getRateLimitHeaders(rateResult, RATE_LIMITS.login) }
      )
    }

    // ---- Input Validation ----
    const body = await request.json()
    const validation = safeValidate(loginSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.errors.join(', ') },
        { status: 400 }
      )
    }

    const { email, password } = validation.data
    const sanitizedEmail = sanitizeString(email)
    const { ipAddress, userAgent } = getRequestInfo(request)

    // ---- Account Lockout Check ----
    const locked = await isAccountLocked(sanitizedEmail)
    if (locked) {
      logAudit({
        action: 'LOGIN_LOCKED',
        userEmail: sanitizedEmail,
        ipAddress,
        userAgent,
        details: 'Account is locked due to too many failed attempts',
      })
      return NextResponse.json(
        { success: false, error: 'Account is temporarily locked due to too many failed login attempts. Please try again in 15 minutes.' },
        { status: 423 }
      )
    }

    // ---- Find User ----
    const user = await db.user.findUnique({
      where: { email: sanitizedEmail },
      include: {
        branch: true,
        company: true,
      },
    })

    if (!user) {
      // Don't reveal whether email exists
      logAudit({
        action: 'LOGIN_FAILED',
        userEmail: sanitizedEmail,
        ipAddress,
        userAgent,
        details: 'User not found',
      })
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    if (!user.isActive) {
      logAudit({
        action: 'LOGIN_FAILED',
        userId: user.id,
        userEmail: user.email,
        companyId: user.companyId,
        ipAddress,
        userAgent,
        details: 'Account is deactivated',
      })
      return NextResponse.json(
        { success: false, error: 'Account is deactivated. Contact your administrator.' },
        { status: 403 }
      )
    }

    // ---- Password Verification ----
    let passwordValid = false

    if (isPasswordHashed(user.passwordHash)) {
      // Properly hashed password - use bcrypt
      passwordValid = await verifyPassword(password, user.passwordHash)
    } else {
      // Legacy plaintext password - migrate to bcrypt
      if (password === user.passwordHash) {
        passwordValid = true
        // Migrate to bcrypt hash immediately
        const hashedPassword = await hashPassword(password)
        await db.user.update({
          where: { id: user.id },
          data: { passwordHash: hashedPassword, passwordChangedAt: new Date() },
        })
      }
    }

    // Also handle seeded demo users (password starting with $2a$10$dummy)
    if (!passwordValid && user.passwordHash.startsWith('$2a$10$dummy')) {
      if (password === 'demo') {
        passwordValid = true
        // Migrate demo user to proper bcrypt hash
        const hashedPassword = await hashPassword(password)
        await db.user.update({
          where: { id: user.id },
          data: { passwordHash: hashedPassword, passwordChangedAt: new Date() },
        })
      }
    }

    if (!passwordValid) {
      // ---- Handle Failed Login ----
      const lockResult = await handleFailedLogin(sanitizedEmail)
      logAudit({
        action: 'LOGIN_FAILED',
        userId: user.id,
        userEmail: user.email,
        companyId: user.companyId,
        ipAddress,
        userAgent,
        details: `Failed attempt. ${lockResult.attemptsLeft} attempts remaining.`,
      })

      if (lockResult.locked) {
        return NextResponse.json(
          { success: false, error: 'Account has been locked due to too many failed attempts. Please try again in 15 minutes.' },
          { status: 423 }
        )
      }

      return NextResponse.json(
        { success: false, error: `Invalid email or password. ${lockResult.attemptsLeft} attempts remaining before lockout.` },
        { status: 401 }
      )
    }

    // ---- Reset Failed Login Attempts ----
    await resetLoginAttempts(user.id)

    // ---- Update Last Login Info ----
    await db.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
      },
    })

    // ---- Create Audit Log ----
    logAudit({
      action: 'LOGIN_SUCCESS',
      userId: user.id,
      userEmail: user.email,
      companyId: user.companyId,
      branchId: user.branchId,
      ipAddress,
      userAgent,
      details: `User logged in as ${user.role}`,
    })

    // ---- Generate JWT Tokens ----
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      branchId: user.branchId,
      sessionId,
    }

    const accessToken = generateAccessToken(tokenPayload)
    const refreshToken = generateRefreshToken(tokenPayload)

    // ---- Build Response ----
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
      token: accessToken,
      refreshToken,
    }

    const response = NextResponse.json({
      success: true,
      data: responseData,
    })

    // Set httpOnly cookie for additional security
    response.cookies.set('smartbiz_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/',
    })

    response.cookies.set('smartbiz_refresh', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/api/auth',
    })

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { success: false, error: 'An error occurred during login. Please try again.' },
      { status: 500 }
    )
  }
}
