import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { authenticateRequest, isCompanyAdmin } from '@/lib/auth'
import { safeValidate, branchUpdateSchema, sanitizeString } from '@/lib/validation'
import { logAudit, getRequestInfo } from '@/lib/audit-log'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Authentication required' },
        { status: 401 }
      )
    }

    const { id } = await params

    const branch = await db.branch.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            products: { where: { isActive: true } },
            sales: true,
            shrinkages: true,
            inventoryBatches: true,
          },
        },
      },
    })

    if (!branch) {
      return NextResponse.json(
        { success: false, error: 'Branch not found' },
        { status: 404 }
      )
    }

    // Verify branch belongs to the authenticated user's company
    if (branch.companyId !== auth.user.companyId) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Branch does not belong to your company.' },
        { status: 403 }
      )
    }

    return NextResponse.json({ success: true, data: branch })
  } catch (error) {
    console.error('Branch GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Authentication required' },
        { status: 401 }
      )
    }

    // Only admins can update branches
    if (!isCompanyAdmin(auth.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions. Company Admin role required.' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()

    // Validate input with Zod schema
    const validation = safeValidate(branchUpdateSchema, { ...body, id })
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.errors },
        { status: 400 }
      )
    }

    const existing = await db.branch.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Branch not found' },
        { status: 404 }
      )
    }

    // Verify branch belongs to the authenticated user's company
    if (existing.companyId !== auth.user.companyId) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Branch does not belong to your company.' },
        { status: 403 }
      )
    }

    const { name, address, phone, isActive } = validation.data

    const updateData: { name?: string; address?: string | null; phone?: string | null; isActive?: boolean } = {}
    if (name !== undefined) updateData.name = sanitizeString(name)
    if (address !== undefined) updateData.address = address ? sanitizeString(address) : null
    if (phone !== undefined) updateData.phone = phone ? sanitizeString(phone) : null
    if (isActive !== undefined) updateData.isActive = isActive

    const branch = await db.branch.update({
      where: { id },
      data: updateData,
    })

    // Audit log
    const reqInfo = getRequestInfo(request)
    logAudit({
      action: 'BRANCH_UPDATED',
      userId: auth.user.id,
      userEmail: auth.user.email,
      companyId: auth.user.companyId,
      branchId: id,
      details: `Updated branch: ${branch.name} (${branch.code})`,
      ...reqInfo,
    })

    return NextResponse.json({ success: true, data: branch })
  } catch (error) {
    console.error('Branch PUT error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Authentication required' },
        { status: 401 }
      )
    }

    // Only admins can delete branches
    if (!isCompanyAdmin(auth.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions. Company Admin role required.' },
        { status: 403 }
      )
    }

    const { id } = await params

    const existing = await db.branch.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Branch not found' },
        { status: 404 }
      )
    }

    // Verify branch belongs to the authenticated user's company
    if (existing.companyId !== auth.user.companyId) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Branch does not belong to your company.' },
        { status: 403 }
      )
    }

    // Soft delete - set isActive to false
    const branch = await db.branch.update({
      where: { id },
      data: { isActive: false },
    })

    // Audit log
    const reqInfo = getRequestInfo(request)
    logAudit({
      action: 'BRANCH_DEACTIVATED',
      userId: auth.user.id,
      userEmail: auth.user.email,
      companyId: auth.user.companyId,
      branchId: id,
      details: `Deactivated branch: ${existing.name} (${existing.code})`,
      ...reqInfo,
    })

    return NextResponse.json({
      success: true,
      data: branch,
      message: 'Branch deactivated successfully',
    })
  } catch (error) {
    console.error('Branch DELETE error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
