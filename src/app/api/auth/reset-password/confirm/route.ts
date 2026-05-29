import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { hashPassword, checkPasswordStrength } from '@/lib/auth'
import { safeValidate, resetPasswordSchema, sanitizeString } from '@/lib/validation'
import crypto from 'crypto'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validation = safeValidate(resetPasswordSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.errors.join(', ') },
        { status: 400 }
      )
    }

    const { email, token, password } = validation.data
    const sanitizedEmail = sanitizeString(email)

    const user = await db.user.findUnique({ where: { email: sanitizedEmail } })
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired reset code.' },
        { status: 400 }
      )
    }

    if (!user.passwordResetToken || !user.resetTokenExpiresAt) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired reset code.' },
        { status: 400 }
      )
    }

    if (new Date() > user.resetTokenExpiresAt) {
      return NextResponse.json(
        { success: false, error: 'Reset code has expired. Please request a new one.' },
        { status: 400 }
      )
    }

    const tokenMatches = crypto.timingSafeEqual(
      Buffer.from(token),
      Buffer.from(user.passwordResetToken)
    )

    if (!tokenMatches) {
      return NextResponse.json(
        { success: false, error: 'Invalid reset code.' },
        { status: 400 }
      )
    }

    const strength = checkPasswordStrength(password)
    if (strength.score < 2) {
      return NextResponse.json(
        { success: false, error: `New password is too weak: ${strength.feedback.join(', ')}` },
        { status: 400 }
      )
    }

    const hashedPassword = await hashPassword(password)
    await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashedPassword,
        passwordChangedAt: new Date(),
        passwordResetToken: null,
        resetTokenExpiresAt: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully.',
    })
  } catch (error) {
    console.error('Reset password confirm error:', error)
    return NextResponse.json(
      { success: false, error: 'An error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
