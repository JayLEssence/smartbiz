import { NextResponse } from 'next/server'
import { authenticateRequest, isCompanyAdmin } from '@/lib/auth'
import { getAuditLogs } from '@/lib/audit-log'

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const action = searchParams.get('action') as string | null

    // Non-admin users can only see their own activity
    const userId = isCompanyAdmin(auth.user.role) ? (searchParams.get('userId') || undefined) : auth.user.id

    const result = getAuditLogs({
      companyId: auth.user.companyId,
      userId,
      action: action as never,
      limit,
      offset,
    })

    return NextResponse.json({
      success: true,
      data: result.logs,
      total: result.total,
    })
  } catch (error) {
    console.error('Activity log error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve activity log' },
      { status: 500 }
    )
  }
}
