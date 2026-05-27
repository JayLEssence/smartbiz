import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    const branchId = searchParams.get('branchId')
    const unreadOnly = searchParams.get('unreadOnly') === 'true'

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'companyId is required' },
        { status: 400 }
      )
    }

    const where: any = { companyId }
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
    const body = await request.json()
    const { action, companyId, branchId, notificationIds } = body

    if (action === 'markAllRead') {
      const where: any = { companyId, isRead: false }
      if (branchId) where.branchId = branchId

      await db.notification.updateMany({
        where,
        data: { isRead: true },
      })

      return NextResponse.json({ success: true })
    }

    if (action === 'markRead' && notificationIds?.length) {
      await db.notification.updateMany({
        where: { id: { in: notificationIds } },
        data: { isRead: true },
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
