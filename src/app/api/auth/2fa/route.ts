import { NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { enabled, pin } = body

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'enabled field is required (boolean)' },
        { status: 400 }
      )
    }

    if (enabled) {
      // Enabling 2FA - validate PIN
      if (!pin || typeof pin !== 'string') {
        return NextResponse.json(
          { success: false, error: 'A 4-digit PIN is required to enable 2FA' },
          { status: 400 }
        )
      }

      if (!/^\d{4}$/.test(pin)) {
        return NextResponse.json(
          { success: false, error: 'PIN must be exactly 4 digits' },
          { status: 400 }
        )
      }

      // Hash the PIN and save it as the twoFactorSecret
      const hashedPin = await bcrypt.hash(pin, 10)

      await db.user.update({
        where: { id: auth.user.id },
        data: {
          twoFactorEnabled: true,
          twoFactorSecret: hashedPin,
        } as never,
      })

      return NextResponse.json({
        success: true,
        message: 'Two-factor authentication enabled successfully',
        data: { enabled: true },
      })
    } else {
      // Disabling 2FA
      await db.user.update({
        where: { id: auth.user.id },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
        } as never,
      })

      return NextResponse.json({
        success: true,
        message: 'Two-factor authentication disabled',
        data: { enabled: false },
      })
    }
  } catch (error) {
    console.error('2FA setup error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update 2FA settings' },
      { status: 500 }
    )
  }
}
