import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { safeValidate, notificationUpdateSchema, sanitizeString } from '@/lib/validation'
import { logAudit, getRequestInfo } from '@/lib/audit-log'

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('branchId')
    const unreadOnly = searchParams.get('unreadOnly') === 'true'

    // CRITICAL: Always use companyId from the authenticated token, never from query params
    const companyId = auth.user.companyId

    const where: Record<string, unknown> = { companyId }
    if (branchId) where.branchId = branchId
    if (unreadOnly) where.isRead = false

    const notifications = await db.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const unreadCount = await db.notification.count({
      where: { ...where, isRead: false },
    })

    return NextResponse.json({
      success: true,
      data: notifications,
      unreadCount,
    })
  } catch (error) {
    console.error('Notifications GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Authentication required' },
        { status: 401 }
      )
    }

    // Any authenticated user can mark notifications as read
    const body = await request.json()

    // CRITICAL: Always use companyId from the authenticated token, never from request body
    const companyId = auth.user.companyId

    if (body.action === 'markAllRead') {
      const where: Record<string, unknown> = { companyId, isRead: false }
      if (body.branchId) where.branchId = sanitizeString(body.branchId)

      await db.notification.updateMany({
        where,
        data: { isRead: true },
      })

      // Audit log
      const reqInfo = getRequestInfo(request)
      logAudit({
        action: 'NOTIFICATION_READ',
        userId: auth.user.id,
        userEmail: auth.user.email,
        companyId: auth.user.companyId,
        branchId: auth.user.branchId,
        details: 'Marked all notifications as read',
        ...reqInfo,
      })

      return NextResponse.json({ success: true })
    }

    if (body.action === 'markRead' && body.notificationIds?.length) {
      // Validate notification IDs
      const validation = safeValidate(notificationUpdateSchema, {
        ids: body.notificationIds,
        isRead: true,
      })
      if (!validation.success) {
        return NextResponse.json(
          { success: false, error: 'Validation failed', details: validation.errors },
          { status: 400 }
        )
      }

      // Only update notifications belonging to the user's company
      await db.notification.updateMany({
        where: {
          id: { in: validation.data.ids },
          companyId, // Ensure only company's notifications are updated
        },
        data: { isRead: true },
      })

      // Audit log
      const reqInfo = getRequestInfo(request)
      logAudit({
        action: 'NOTIFICATION_READ',
        userId: auth.user.id,
        userEmail: auth.user.email,
        companyId: auth.user.companyId,
        branchId: auth.user.branchId,
        details: `Marked ${validation.data.ids.length} notifications as read`,
        ...reqInfo,
      })

      return NextResponse.json({ success: true })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Notifications PUT error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
