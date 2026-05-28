import { NextResponse } from 'next/server'
import { authenticateRequest, extractTokenFromRequest, verifyAccessToken } from '@/lib/auth'
import { generateCsrfToken } from '@/lib/csrf'

export async function GET(request: Request) {
  try {
    // Authenticate the request
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Extract the token to get the session ID for CSRF binding
    const token = extractTokenFromRequest(request)
    let sessionId = ''

    if (token) {
      const decoded = verifyAccessToken(token)
      sessionId = decoded?.sessionId || auth.user.id
    } else {
      sessionId = auth.user.id
    }

    // Generate a CSRF token tied to the session
    const csrfToken = generateCsrfToken(sessionId)

    return NextResponse.json({
      success: true,
      csrfToken,
    })
  } catch (error) {
    console.error('CSRF token generation error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate CSRF token' },
      { status: 500 }
    )
  }
}
