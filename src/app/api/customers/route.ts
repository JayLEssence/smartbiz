import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { authenticateRequest, isManagerOrAbove } from '@/lib/auth'
import { safeValidate, customerCreateSchema, sanitizeString } from '@/lib/validation'
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

    // Only managers/admins can access customers
    if (!isManagerOrAbove(auth.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions. Manager or Admin role required.' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('branchId')
    const search = searchParams.get('search')
    const includeInactive = searchParams.get('includeInactive') === 'true'

    // Always filter by authenticated user's companyId - never trust query params
    const where: Prisma.CustomerWhereInput = {
      companyId: auth.user.companyId,
    }

    if (branchId) {
      where.branchId = branchId
    }
    if (!includeInactive) {
      where.isActive = true
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
      ]
    }

    const customers = await db.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
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

    // Compute summary values
    const totalCreditOutstanding = customers.reduce((sum, c) => sum + c.creditBalance, 0)
    const totalLoyaltyPoints = customers.reduce((sum, c) => sum + c.loyaltyPoints, 0)

    return NextResponse.json({
      success: true,
      data: customers,
      summary: {
        totalCustomers: customers.filter((c) => c.isActive).length,
        totalCreditOutstanding,
        totalLoyaltyPoints,
      },
    })
  } catch (error) {
    console.error('Customers GET error:', error)
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

    // Only managers/admins can create customers
    if (!isManagerOrAbove(auth.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions. Manager or Admin role required.' },
        { status: 403 }
      )
    }

    const body = await request.json()

    // Validate input with Zod schema
    const validation = safeValidate(customerCreateSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.errors },
        { status: 400 }
      )
    }

    const { name, email, phone, address, loyaltyPoints, creditBalance, creditLimit, branchId } = validation.data

    // CRITICAL: Always use companyId from the authenticated token, never from request body
    const companyId = auth.user.companyId

    // Verify branch exists and belongs to the user's company
    const branch = await db.branch.findFirst({
      where: { id: branchId, companyId },
    })
    if (!branch) {
      return NextResponse.json(
        { success: false, error: 'Branch not found or does not belong to your company' },
        { status: 404 }
      )
    }

    // Sanitize all string inputs
    const customer = await db.customer.create({
      data: {
        name: sanitizeString(name),
        email: email ? sanitizeString(email) : null,
        phone: phone ? sanitizeString(phone) : null,
        address: address ? sanitizeString(address) : null,
        loyaltyPoints: loyaltyPoints ?? 0,
        creditBalance: creditBalance ?? 0,
        creditLimit: creditLimit ?? 0,
        branchId,
        companyId,
      },
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
      action: 'CUSTOMER_CREATED',
      userId: auth.user.id,
      userEmail: auth.user.email,
      companyId: auth.user.companyId,
      branchId: auth.user.branchId,
      details: `Created customer: ${customer.name} (${customer.id})`,
      ...reqInfo,
    })

    return NextResponse.json({ success: true, data: customer }, { status: 201 })
  } catch (error) {
    console.error('Customers POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
