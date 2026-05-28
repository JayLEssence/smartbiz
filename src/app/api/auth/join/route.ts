import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import {
  hashPassword,
  generateAccessToken,
  generateRefreshToken,
  checkPasswordStrength,
} from '@/lib/auth'
import { safeValidate, joinSchema, sanitizeString } from '@/lib/validation'
import { logAudit, getRequestInfo } from '@/lib/audit-log'

// Note: Rate limiting is handled by middleware.ts - no duplicate check here

export async function POST(request: Request) {
  try {
    // ---- Input Validation ----
    const body = await request.json()
    const validation = safeValidate(joinSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.errors.join(', ') },
        { status: 400 }
      )
    }

    const { name, email, password, branchCode } = validation.data
    const sanitizedName = sanitizeString(name)
    const sanitizedEmail = sanitizeString(email)
    const sanitizedBranchCode = sanitizeString(branchCode)
    const { ipAddress, userAgent } = getRequestInfo(request)

    // ---- Password Strength Check ----
    const strength = checkPasswordStrength(password)
    if (strength.score < 2) {
      return NextResponse.json(
        {
          success: false,
          error: `Password is too weak: ${strength.feedback.join(', ')}`,
          strength,
        },
        { status: 400 }
      )
    }

    // ---- Find Branch ----
    const branch = await db.branch.findUnique({
      where: { code: sanitizedBranchCode.toUpperCase() },
      include: { company: true },
    })

    if (!branch) {
      // Don't reveal whether branch code exists (prevents enumeration)
      return NextResponse.json(
        { success: false, error: 'Unable to register with the provided information. Please verify your branch code with your manager.' },
        { status: 400 }
      )
    }

    if (!branch.isActive) {
      return NextResponse.json(
        { success: false, error: 'This branch is currently inactive. Contact your manager.' },
        { status: 400 }
      )
    }

    if (!branch.company.isActive) {
      return NextResponse.json(
        { success: false, error: 'This company account is currently inactive.' },
        { status: 400 }
      )
    }

    // ---- Check Duplicate Email ----
    const existingUser = await db.user.findUnique({ where: { email: sanitizedEmail } })
    if (existingUser) {
      // Don't reveal that email exists (prevents enumeration)
      return NextResponse.json(
        { success: false, error: 'Unable to create an account with the provided information. Try signing in instead.' },
        { status: 409 }
      )
    }

    // ---- Hash Password ----
    const hashedPassword = await hashPassword(password)

    // ---- Create Employee User ----
    const user = await db.user.create({
      data: {
        name: sanitizedName,
        email: sanitizedEmail,
        passwordHash: hashedPassword,
        role: 'Employee',
        branchId: branch.id,
        companyId: branch.companyId,
        isActive: true,
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
        passwordChangedAt: new Date(),
      },
      include: {
        branch: true,
        company: true,
      },
    })

    // ---- Audit Log ----
    logAudit({
      action: 'USER_CREATED',
      userId: user.id,
      userEmail: user.email,
      companyId: user.companyId,
      branchId: user.branchId,
      ipAddress,
      userAgent,
      details: `Employee self-registered via branch code ${sanitizedBranchCode}`,
    })

    logAudit({
      action: 'LOGIN_SUCCESS',
      userId: user.id,
      userEmail: user.email,
      companyId: user.companyId,
      branchId: user.branchId,
      ipAddress,
      userAgent,
      details: 'Auto-login after self-registration',
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
        twoFactorEnabled: false,
        mustChangePassword: false,
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

    // Set httpOnly cookies
    response.cookies.set('smartbiz_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60,
      path: '/',
    })

    response.cookies.set('smartbiz_refresh', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60,
      path: '/api/auth',
    })

    return response
  } catch (error) {
    console.error('Join error:', error)
    return NextResponse.json(
      { success: false, error: 'An error occurred during registration. Please try again.' },
      { status: 500 }
    )
  }
}
