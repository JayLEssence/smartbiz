import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { authenticateRequest, isCompanyAdmin } from '@/lib/auth'
import { safeValidate, sanitizeString, companyUpdateSchema } from '@/lib/validation'
import { logAudit, getRequestInfo } from '@/lib/audit-log'

// GET: Get company details with branches summary
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

    // Tenant isolation: users can only view their own company
    if (id !== auth.user.companyId) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    const company = await db.company.findUnique({
      where: { id },
      include: {
        branches: {
          select: {
            id: true,
            name: true,
            code: true,
            isHeadOffice: true,
            isActive: true,
            address: true,
            phone: true,
            _count: {
              select: {
                users: true,
                products: { where: { isActive: true } },
                sales: true,
              },
            },
          },
          orderBy: { isHeadOffice: 'desc' },
        },
        users: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            branch: {
              select: { id: true, name: true },
            },
          },
        },
        _count: {
          select: {
            branches: true,
            users: true,
            products: { where: { isActive: true } },
            sales: true,
          },
        },
      },
    })

    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: company })
  } catch (error) {
    console.error('Company GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT: Update company details
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
      return NextResponse.json({ success: false, error: 'Only company administrators can update company settings' }, { status: 403 })
    }

    const { id } = await params

    if (id !== auth.user.companyId) {
      return NextResponse.json({ success: false, error: 'You can only update your own company' }, { status: 403 })
    }

    const body = await request.json()

    const validation = safeValidate(companyUpdateSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.errors.join(', ') },
        { status: 400 }
      )
    }

    const existing = await db.company.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 }
      )
    }

    const { id: schemaId, ...validatedData } = validation.data

    const updateData: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(validatedData)) {
      if (value !== undefined) {
        updateData[key] = typeof value === 'string' ? sanitizeString(value) : value
      }
    }

    const company = await db.company.update({
      where: { id },
      data: updateData,
    })

    const reqInfo = getRequestInfo(request)
    logAudit({
      action: 'COMPANY_UPDATED',
      userId: auth.user.id,
      userEmail: auth.user.email,
      companyId: auth.user.companyId,
      details: `Company settings updated`,
      ...reqInfo,
    })

    return NextResponse.json({ success: true, data: company })
  } catch (error) {
    console.error('Company PUT error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE: Deactivate company (soft delete)
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
      return NextResponse.json({ success: false, error: 'Only company administrators can deactivate the company' }, { status: 403 })
    }

    const { id } = await params

    if (id !== auth.user.companyId) {
      return NextResponse.json({ success: false, error: 'You can only deactivate your own company' }, { status: 403 })
    }

    const existing = await db.company.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 }
      )
    }

    // Soft delete - set isActive to false on company and all its branches
    await db.$transaction(async (tx) => {
      await tx.company.update({
        where: { id },
        data: { isActive: false },
      })

      // Also deactivate all branches in the company
      await tx.branch.updateMany({
        where: { companyId: id },
        data: { isActive: false },
      })
    })

    return NextResponse.json({
      success: true,
      data: { id, isActive: false },
      message: 'Company and all its branches deactivated successfully',
    })
  } catch (error) {
    console.error('Company DELETE error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
