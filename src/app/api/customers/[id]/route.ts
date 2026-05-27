import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { authenticateRequest, isManagerOrAbove } from '@/lib/auth'
import { safeValidate, customerUpdateSchema, sanitizeString } from '@/lib/validation'
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

    // Only managers/admins can access customers
    if (!isManagerOrAbove(auth.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions. Manager or Admin role required.' },
        { status: 403 }
      )
    }

    const { id } = await params

    const customer = await db.customer.findUnique({
      where: { id },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
            currency: true,
            currencySymbol: true,
            exchangeRate: true,
          },
        },
      },
    })

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      )
    }

    // Verify customer belongs to the authenticated user's company
    if (customer.companyId !== auth.user.companyId) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Customer does not belong to your company.' },
        { status: 403 }
      )
    }

    return NextResponse.json({ success: true, data: customer })
  } catch (error) {
    console.error('Customer GET error:', error)
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

    // Only managers/admins can update customers
    if (!isManagerOrAbove(auth.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions. Manager or Admin role required.' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()

    // Validate input with Zod schema
    const validation = safeValidate(customerUpdateSchema, { ...body, id })
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.errors },
        { status: 400 }
      )
    }

    const existing = await db.customer.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      )
    }

    // Verify customer belongs to the authenticated user's company
    if (existing.companyId !== auth.user.companyId) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Customer does not belong to your company.' },
        { status: 403 }
      )
    }

    const { name, email, phone, address, loyaltyPoints, creditBalance, creditLimit, isActive } = validation.data

    const updateData: {
      name?: string
      email?: string | null
      phone?: string | null
      address?: string | null
      loyaltyPoints?: number
      creditBalance?: number
      creditLimit?: number
      isActive?: boolean
    } = {}

    // Sanitize all string inputs
    if (name !== undefined) updateData.name = sanitizeString(name)
    if (email !== undefined) updateData.email = email ? sanitizeString(email) : null
    if (phone !== undefined) updateData.phone = phone ? sanitizeString(phone) : null
    if (address !== undefined) updateData.address = address ? sanitizeString(address) : null
    if (loyaltyPoints !== undefined) updateData.loyaltyPoints = loyaltyPoints
    if (creditBalance !== undefined) updateData.creditBalance = creditBalance
    if (creditLimit !== undefined) updateData.creditLimit = creditLimit
    if (isActive !== undefined) updateData.isActive = isActive

    const customer = await db.customer.update({
      where: { id },
      data: updateData,
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    })

    // Audit log
    const reqInfo = getRequestInfo(request)
    logAudit({
      action: 'CUSTOMER_UPDATED',
      userId: auth.user.id,
      userEmail: auth.user.email,
      companyId: auth.user.companyId,
      branchId: auth.user.branchId,
      details: `Updated customer: ${customer.name} (${customer.id})`,
      ...reqInfo,
    })

    return NextResponse.json({ success: true, data: customer })
  } catch (error) {
    console.error('Customer PUT error:', error)
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

    // Only managers/admins can delete customers
    if (!isManagerOrAbove(auth.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions. Manager or Admin role required.' },
        { status: 403 }
      )
    }

    const { id } = await params

    const existing = await db.customer.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      )
    }

    // Verify customer belongs to the authenticated user's company
    if (existing.companyId !== auth.user.companyId) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Customer does not belong to your company.' },
        { status: 403 }
      )
    }

    // Soft delete - set isActive to false
    const customer = await db.customer.update({
      where: { id },
      data: { isActive: false },
    })

    // Audit log
    const reqInfo = getRequestInfo(request)
    logAudit({
      action: 'CUSTOMER_DELETED',
      userId: auth.user.id,
      userEmail: auth.user.email,
      companyId: auth.user.companyId,
      branchId: auth.user.branchId,
      details: `Deactivated customer: ${existing.name} (${existing.id})`,
      ...reqInfo,
    })

    return NextResponse.json({
      success: true,
      data: customer,
      message: 'Customer deactivated successfully',
    })
  } catch (error) {
    console.error('Customer DELETE error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
