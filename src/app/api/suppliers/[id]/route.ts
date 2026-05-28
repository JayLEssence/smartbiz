import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { authenticateRequest, isManagerOrAbove, isCompanyAdmin } from '@/lib/auth'
import { safeValidate, sanitizeString, supplierCreateSchema } from '@/lib/validation'
import { logAudit, getRequestInfo } from '@/lib/audit-log'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate request
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Authentication required' },
        { status: 401 }
      )
    }

    // Only managers/admins can access supplier data
    if (!isManagerOrAbove(auth.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Manager or Admin role required.' },
        { status: 403 }
      )
    }

    const { id } = await params

    const supplier = await db.supplier.findUnique({
      where: { id },
      include: {
        inventoryBatches: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
          },
          orderBy: { dateReceived: 'desc' },
          take: 20,
        },
        _count: {
          select: {
            inventoryBatches: true,
          },
        },
      },
    })

    if (!supplier) {
      return NextResponse.json(
        { success: false, error: 'Supplier not found' },
        { status: 404 }
      )
    }

    // Verify supplier belongs to authenticated user's company (tenant isolation)
    if (supplier.companyId !== auth.user.companyId) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Supplier does not belong to your company.' },
        { status: 403 }
      )
    }

    return NextResponse.json({ success: true, data: supplier })
  } catch (error) {
    console.error('Supplier GET error:', error)
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
    // Authenticate request
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Authentication required' },
        { status: 401 }
      )
    }

    // Only admins can update suppliers
    if (!isCompanyAdmin(auth.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Company Admin role required to update suppliers.' },
        { status: 403 }
      )
    }

    const reqInfo = getRequestInfo(request)
    const { id } = await params
    const body = await request.json()

    const validation = safeValidate(supplierCreateSchema, { ...body, companyId: auth.user.companyId })
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.errors.join(', ') },
        { status: 400 }
      )
    }

    const existing = await db.supplier.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Supplier not found' },
        { status: 404 }
      )
    }

    // Verify supplier belongs to authenticated user's company (tenant isolation)
    if (existing.companyId !== auth.user.companyId) {
      logAudit({
        action: 'SUSPICIOUS_ACTIVITY',
        userId: auth.user.id,
        userEmail: auth.user.email,
        companyId: auth.user.companyId,
        branchId: auth.user.branchId,
        details: `Attempted to update supplier outside company: ${id}`,
        ipAddress: reqInfo.ipAddress,
        userAgent: reqInfo.userAgent,
      })
      return NextResponse.json(
        { success: false, error: 'Access denied. Supplier does not belong to your company.' },
        { status: 403 }
      )
    }

    const { name, email, phone, address, companyId: _companyId } = validation.data

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = sanitizeString(name)
    if (email !== undefined) updateData.email = email ? sanitizeString(email) : null
    if (phone !== undefined) updateData.phone = phone ? sanitizeString(phone) : null
    if (address !== undefined) updateData.address = address ? sanitizeString(address) : null

    const supplier = await db.supplier.update({
      where: { id },
      data: updateData,
    })

    // Audit log for supplier update
    logAudit({
      action: 'SUPPLIER_UPDATED',
      userId: auth.user.id,
      userEmail: auth.user.email,
      companyId: auth.user.companyId,
      branchId: auth.user.branchId,
      details: `Supplier updated: ${id}, name: ${existing.name}, fields: ${Object.keys(updateData).join(', ')}`,
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    })

    return NextResponse.json({ success: true, data: supplier })
  } catch (error) {
    console.error('Supplier PUT error:', error)
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
    // Authenticate request
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Authentication required' },
        { status: 401 }
      )
    }

    // Only admins can delete suppliers
    if (!isCompanyAdmin(auth.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Company Admin role required to delete suppliers.' },
        { status: 403 }
      )
    }

    const reqInfo = getRequestInfo(request)
    const { id } = await params

    const existing = await db.supplier.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Supplier not found' },
        { status: 404 }
      )
    }

    // Verify supplier belongs to authenticated user's company (tenant isolation)
    if (existing.companyId !== auth.user.companyId) {
      logAudit({
        action: 'SUSPICIOUS_ACTIVITY',
        userId: auth.user.id,
        userEmail: auth.user.email,
        companyId: auth.user.companyId,
        branchId: auth.user.branchId,
        details: `Attempted to delete supplier outside company: ${id}`,
        ipAddress: reqInfo.ipAddress,
        userAgent: reqInfo.userAgent,
      })
      return NextResponse.json(
        { success: false, error: 'Access denied. Supplier does not belong to your company.' },
        { status: 403 }
      )
    }

    // Soft delete - set isActive to false
    const supplier = await db.supplier.update({
      where: { id },
      data: { isActive: false },
    })

    // Audit log for supplier deletion
    logAudit({
      action: 'SUPPLIER_DELETED',
      userId: auth.user.id,
      userEmail: auth.user.email,
      companyId: auth.user.companyId,
      branchId: auth.user.branchId,
      details: `Supplier deactivated: ${id}, name: ${existing.name}`,
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    })

    return NextResponse.json({
      success: true,
      data: supplier,
      message: 'Supplier deactivated successfully',
    })
  } catch (error) {
    console.error('Supplier DELETE error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
