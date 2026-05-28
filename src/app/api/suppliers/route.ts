import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { authenticateRequest, isManagerOrAbove, isCompanyAdmin } from '@/lib/auth'
import { safeValidate, supplierCreateSchema, sanitizeString } from '@/lib/validation'
import { logAudit, getRequestInfo } from '@/lib/audit-log'

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url)

    // ALWAYS use authenticated user's companyId (tenant isolation)
    const companyId = auth.user.companyId
    const search = searchParams.get('search') || ''
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const where: Prisma.SupplierWhereInput = {
      companyId, // Enforce tenant isolation
    }

    if (!includeInactive) {
      where.isActive = true
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ]
    }

    const suppliers = await db.supplier.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            inventoryBatches: true,
          },
        },
      },
    })

    return NextResponse.json({ success: true, data: suppliers })
  } catch (error) {
    console.error('Suppliers GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    // Authenticate request
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Authentication required' },
        { status: 401 }
      )
    }

    // Only admins can create suppliers
    if (!isCompanyAdmin(auth.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Company Admin role required to create suppliers.' },
        { status: 403 }
      )
    }

    const reqInfo = getRequestInfo(request)
    const body = await request.json()

    // CRITICAL: ALWAYS override companyId with authenticated user's companyId (never trust request body)
    const companyId = auth.user.companyId

    // Validate input with Zod schema
    const validation = safeValidate(supplierCreateSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.errors },
        { status: 400 }
      )
    }

    const validatedData = validation.data

    // Sanitize string inputs
    const name = sanitizeString(validatedData.name)
    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Supplier name is required after sanitization' },
        { status: 400 }
      )
    }

    const supplier = await db.supplier.create({
      data: {
        name,
        email: validatedData.email ? sanitizeString(validatedData.email) : null,
        phone: validatedData.phone ? sanitizeString(validatedData.phone) : null,
        address: validatedData.address ? sanitizeString(validatedData.address) : null,
        companyId, // Use auth-derived companyId, NEVER from request body
      },
    })

    // Audit log for supplier creation
    logAudit({
      action: 'SUPPLIER_CREATED',
      userId: auth.user.id,
      userEmail: auth.user.email,
      companyId: auth.user.companyId,
      branchId: auth.user.branchId,
      details: `Supplier created: ${name}`,
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    })

    return NextResponse.json({ success: true, data: supplier }, { status: 201 })
  } catch (error) {
    console.error('Suppliers POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
