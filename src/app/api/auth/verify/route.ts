import { NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired session' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        user: auth.user,
        tokenValid: true,
      },
    })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Session validation failed' },
      { status: 401 }
    )
  }
}
