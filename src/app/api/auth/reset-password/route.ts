import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { safeValidate, forgotPasswordSchema, sanitizeString } from '@/lib/validation'
import { getRequestInfo } from '@/lib/audit-log'
import crypto from 'crypto'

const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000
const RATE_LIMIT_PER_EMAIL = 3
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkEmailRateLimit(email: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(email)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(email, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT_PER_EMAIL) return false
  entry.count++
  return true
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validation = safeValidate(forgotPasswordSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.errors.join(', ') },
        { status: 400 }
      )
    }

    const { email } = validation.data
    const sanitizedEmail = sanitizeString(email)
    const { ipAddress, userAgent } = getRequestInfo(request)

    if (!checkEmailRateLimit(sanitizedEmail)) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    const user = await db.user.findUnique({ where: { email: sanitizedEmail } })
    if (!user) {
      return NextResponse.json(
        { success: true, data: { message: 'If an account exists with this email, a reset code has been generated.' } },
        { status: 200 }
      )
    }

    const resetToken = crypto.randomBytes(32).toString('hex')
    const tokenExpiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS)

    await db.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        resetTokenExpiresAt: tokenExpiresAt,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        message: 'Reset code generated',
        resetToken,
        expiresIn: '1 hour',
      },
    })
  } catch (error) {
    console.error('Reset password token generation error:', error)
    return NextResponse.json(
      { success: false, error: 'An error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
