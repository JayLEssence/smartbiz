import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { authenticateRequest, isCompanyAdmin } from '@/lib/auth'
import { safeValidate, sanitizeString, userUpdateSchema } from '@/lib/validation'
import { logAudit, getRequestInfo } from '@/lib/audit-log'

// GET: Get a single user by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const { id } = await params

    const user = await db.user.findUnique({
      where: { id },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
            isHeadOffice: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
            plan: true,
          },
        },
        _count: {
          select: {
            sales: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Tenant isolation: users can only view users in their own company
    if (user.companyId !== auth.user.companyId) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Remove passwordHash from response
    const { passwordHash, ...safeUser } = user

    return NextResponse.json({ success: true, data: safeUser })
  } catch (error) {
    console.error('User GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT: Update user by ID
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    if (!isCompanyAdmin(auth.user.role)) {
      return NextResponse.json({ success: false, error: 'Only company administrators can update users' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    const validation = safeValidate(userUpdateSchema, { ...body, id })
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.errors.join(', ') },
        { status: 400 }
      )
    }

    const existing = await db.user.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Tenant isolation: users can only update users in their own company
    if (existing.companyId !== auth.user.companyId) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    const { name, role, branchId, isActive } = validation.data

    // If branchId is changing, validate it belongs to the same company
    if (branchId && branchId !== existing.branchId) {
      const branch = await db.branch.findUnique({ where: { id: branchId } })
      if (!branch) {
        return NextResponse.json(
          { success: false, error: 'Branch not found' },
          { status: 404 }
        )
      }
      if (branch.companyId !== existing.companyId) {
        return NextResponse.json(
          { success: false, error: 'Branch does not belong to the user\'s company' },
          { status: 400 }
        )
      }
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = sanitizeString(name)
    if (role !== undefined) updateData.role = role
    if (branchId !== undefined) updateData.branchId = branchId
    if (isActive !== undefined) updateData.isActive = isActive

    const user = await db.user.update({
      where: { id },
      data: updateData,
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
            isHeadOffice: true,
          },
        },
      },
    })

    // Remove passwordHash from response
    const { passwordHash, ...safeUser } = user

    const reqInfo = getRequestInfo(request)
    logAudit({
      action: 'USER_UPDATED',
      userId: auth.user.id,
      userEmail: auth.user.email,
      companyId: auth.user.companyId,
      branchId: auth.user.branchId,
      details: `User updated: ${id}, fields: ${Object.keys(updateData).join(', ')}`,
      ...reqInfo,
    })

    return NextResponse.json({ success: true, data: safeUser })
  } catch (error) {
    console.error('User PUT error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE: Soft delete user by ID (set isActive=false)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    if (!isCompanyAdmin(auth.user.role)) {
      return NextResponse.json({ success: false, error: 'Only company administrators can deactivate users' }, { status: 403 })
    }

    const { id } = await params

    const existing = await db.user.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Tenant isolation: users can only deactivate users in their own company
    if (existing.companyId !== auth.user.companyId) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Soft delete - set isActive to false
    const user = await db.user.update({
      where: { id },
      data: { isActive: false },
    })

    // Remove passwordHash from response
    const { passwordHash, ...safeUser } = user

    const reqInfo = getRequestInfo(request)
    logAudit({
      action: 'USER_DEACTIVATED',
      userId: auth.user.id,
      userEmail: auth.user.email,
      companyId: auth.user.companyId,
      branchId: auth.user.branchId,
      details: `User deactivated: ${id}`,
      ...reqInfo,
    })

    return NextResponse.json({
      success: true,
      data: safeUser,
      message: 'User deactivated successfully',
    })
  } catch (error) {
    console.error('User DELETE error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
