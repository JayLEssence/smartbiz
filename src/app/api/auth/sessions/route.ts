import { NextResponse } from 'next/server'
import { authenticateRequest, extractTokenFromRequest, verifyAccessToken } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get current session ID from the JWT token
    const token = extractTokenFromRequest(request)
    let currentSessionId: string | null = null
    if (token) {
      const payload = verifyAccessToken(token)
      if (payload) {
        currentSessionId = payload.sessionId
      }
    }

    // Fetch all valid sessions for this user
    const sessions = await db.session.findMany({
      where: {
        userId: auth.user.id,
        isValid: true,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        deviceInfo: true,
        ipAddress: true,
        createdAt: true,
        expiresAt: true,
      },
    })

    const formattedSessions = sessions.map((session) => ({
      id: session.id,
      deviceInfo: session.deviceInfo || 'Unknown device',
      ipAddress: session.ipAddress || 'Unknown',
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      isCurrent: session.id === currentSessionId,
    }))

    return NextResponse.json({
      success: true,
      data: formattedSessions,
    })
  } catch (error) {
    console.error('Sessions list error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve sessions' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get current session ID from the JWT token
    const token = extractTokenFromRequest(request)
    let currentSessionId: string | null = null
    if (token) {
      const payload = verifyAccessToken(token)
      if (payload) {
        currentSessionId = payload.sessionId
      }
    }

    // Invalidate all sessions except the current one
    const result = await db.session.updateMany({
      where: {
        userId: auth.user.id,
        isValid: true,
        id: { not: currentSessionId || '' },
      },
      data: {
        isValid: false,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Revoked ${result.count} session(s)`,
      data: { revokedCount: result.count },
    })
  } catch (error) {
    console.error('Sessions revoke error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to revoke sessions' },
      { status: 500 }
    )
  }
}
