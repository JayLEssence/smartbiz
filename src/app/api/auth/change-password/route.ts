import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { authenticateRequest, hashPassword, verifyPassword, checkPasswordStrength } from '@/lib/auth'
import { safeValidate, passwordChangeSchema, sanitizeString } from '@/lib/validation'
import { logAudit, getRequestInfo } from '@/lib/audit-log'

export async function POST(request: Request) {
  try {
    // ---- Authentication ----
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // ---- Input Validation ----
    const body = await request.json()
    const validation = safeValidate(passwordChangeSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.errors.join(', ') },
        { status: 400 }
      )
    }

    const { currentPassword, newPassword } = validation.data
    const { ipAddress, userAgent } = getRequestInfo(request)

    // ---- Find User ----
    const user = await db.user.findUnique({ where: { id: auth.user.id } })
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // ---- Verify Current Password ----
    let currentPasswordValid = false
    try {
      currentPasswordValid = await verifyPassword(currentPassword, user.passwordHash)
    } catch {
      // Legacy plaintext fallback
      currentPasswordValid = currentPassword === user.passwordHash
    }

    if (!currentPasswordValid) {
      logAudit({
        action: 'PASSWORD_CHANGED',
        userId: user.id,
        userEmail: user.email,
        companyId: user.companyId,
        ipAddress,
        userAgent,
        details: 'Failed - incorrect current password',
        severity: 'warning',
      })
      return NextResponse.json(
        { success: false, error: 'Current password is incorrect' },
        { status: 401 }
      )
    }

    // ---- Check New Password Strength ----
    const strength = checkPasswordStrength(newPassword)
    if (strength.score < 2) {
      return NextResponse.json(
        { success: false, error: `New password is too weak: ${strength.feedback.join(', ')}` },
        { status: 400 }
      )
    }

    // ---- Hash and Update Password ----
    const hashedPassword = await hashPassword(newPassword)
    await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashedPassword,
        passwordChangedAt: new Date(),
        mustChangePassword: false,
      },
    })

    logAudit({
      action: 'PASSWORD_CHANGED',
      userId: user.id,
      userEmail: user.email,
      companyId: user.companyId,
      ipAddress,
      userAgent,
      details: 'Password changed successfully',
    })

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully',
    })
  } catch (error) {
    console.error('Password change error:', error)
    return NextResponse.json(
      { success: false, error: 'An error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
