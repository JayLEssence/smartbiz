import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { authenticateRequest, isCompanyAdmin } from '@/lib/auth'
import { safeValidate, branchCreateSchema, sanitizeString } from '@/lib/validation'
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
    const includeInactive = searchParams.get('includeInactive') === 'true'

    // Always filter by authenticated user's companyId - never trust query params
    const where: Prisma.BranchWhereInput = {
      companyId: auth.user.companyId,
    }
    if (!includeInactive) {
      where.isActive = true
    }

    const branches = await db.branch.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            plan: true,
          },
        },
        _count: {
          select: {
            users: true,
            products: { where: { isActive: true } },
            sales: true,
          },
        },
      },
    })

    return NextResponse.json({ success: true, data: branches })
  } catch (error) {
    console.error('Branches GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Authentication required' },
        { status: 401 }
      )
    }

    // Only admins can create branches
    if (!isCompanyAdmin(auth.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions. Company Admin role required.' },
        { status: 403 }
      )
    }

    const body = await request.json()

    // Validate input with Zod schema
    const validation = safeValidate(branchCreateSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.errors },
        { status: 400 }
      )
    }

    const { name, code, address, phone, isHeadOffice } = validation.data

    // CRITICAL: Always use companyId from the authenticated token, never from request body
    const companyId = auth.user.companyId

    // Verify company exists
    const company = await db.company.findUnique({ where: { id: companyId } })
    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 }
      )
    }

    // Check if this is the first branch for the company - auto set as head office
    const existingBranchCount = await db.branch.count({
      where: { companyId },
    })
    const shouldBeHeadOffice = existingBranchCount === 0 ? true : (isHeadOffice || false)

    const branch = await db.branch.create({
      data: {
        name: sanitizeString(name),
        code: sanitizeString(code).toUpperCase(),
        address: address ? sanitizeString(address) : null,
        phone: phone ? sanitizeString(phone) : null,
        isHeadOffice: shouldBeHeadOffice,
        companyId,
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Audit log
    const reqInfo = getRequestInfo(request)
    logAudit({
      action: 'BRANCH_CREATED',
      userId: auth.user.id,
      userEmail: auth.user.email,
      companyId: auth.user.companyId,
      branchId: branch.id,
      details: `Created branch: ${branch.name} (${branch.code})`,
      ...reqInfo,
    })

    return NextResponse.json({ success: true, data: branch }, { status: 201 })
  } catch (error) {
    console.error('Branches POST error:', error)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'A branch with this code already exists' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
