import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { hashPassword, authenticateRequest, isCompanyAdmin } from '@/lib/auth'
import { safeValidate, registerSchema, companyUpdateSchema, sanitizeString } from '@/lib/validation'
import { logAudit, getRequestInfo } from '@/lib/audit-log'

// Note: Rate limiting is handled by middleware.ts - no duplicate check here

// POST: Register a new company (creates company + head office branch + admin user)
export async function POST(request: Request) {
  try {
    // ---- Input Validation ----
    const body = await request.json()
    const validation = safeValidate(registerSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.errors.join(', ') },
        { status: 400 }
      )
    }

    const { name, industry, email, phone, address, adminName, adminEmail, adminPassword, currency, currencySymbol, country, exchangeRate } = validation.data
    const { ipAddress, userAgent } = getRequestInfo(request)

    const result = await db.$transaction(async (tx) => {
      // 1. Create the Company record
      const company = await tx.company.create({
        data: {
          name: sanitizeString(name),
          industry: industry ? sanitizeString(industry) : null,
          email: email ? sanitizeString(email) : null,
          phone: phone ? sanitizeString(phone) : null,
          address: address ? sanitizeString(address) : null,
          plan: 'free',
          isActive: true,
          currency: currency || 'TZS',
          currencySymbol: currencySymbol || 'TSh',
          country: country || 'Tanzania',
          exchangeRate: exchangeRate || 2570,
        },
      })

      // 2. Create a Head Office branch under that company
      const branchCode = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) + '-HQ'
      const headOffice = await tx.branch.create({
        data: {
          name: `${name} - Head Office`,
          code: branchCode,
          address: address ? sanitizeString(address) : null,
          phone: phone ? sanitizeString(phone) : null,
          isHeadOffice: true,
          isActive: true,
          companyId: company.id,
        },
      })

      // 3. Create an Admin user with HASHED password
      const hashedPassword = await hashPassword(adminPassword)
      const admin = await tx.user.create({
        data: {
          email: sanitizeString(adminEmail),
          name: sanitizeString(adminName),
          passwordHash: hashedPassword,
          role: 'CompanyAdmin',
          branchId: headOffice.id,
          companyId: company.id,
          isActive: true,
          lastLoginAt: new Date(),
          lastLoginIp: ipAddress,
          passwordChangedAt: new Date(),
        },
        include: {
          branch: true,
          company: true,
        },
      })

      return { company, headOffice, admin }
    })

    logAudit({
      action: 'COMPANY_CREATED',
      userId: result.admin.id,
      userEmail: result.admin.email,
      companyId: result.company.id,
      ipAddress,
      userAgent,
      details: `Company "${name}" registered with head office`,
    })

    logAudit({
      action: 'USER_CREATED',
      userId: result.admin.id,
      userEmail: result.admin.email,
      companyId: result.company.id,
      branchId: result.headOffice.id,
      ipAddress,
      userAgent,
      details: 'Admin user created during company registration',
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          company: result.company,
          headOffice: result.headOffice,
          admin: {
            id: result.admin.id,
            email: result.admin.email,
            name: result.admin.name,
            role: result.admin.role,
            branchId: result.admin.branchId,
            companyId: result.admin.companyId,
            branch: {
              id: result.admin.branch.id,
              name: result.admin.branch.name,
              code: result.admin.branch.code,
              isHeadOffice: result.admin.branch.isHeadOffice,
            },
            company: {
              id: result.admin.company.id,
              name: result.admin.company.name,
              plan: result.admin.company.plan,
            },
          },
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Company registration error:', error)
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        const meta = error.meta as { target?: string[] } | undefined
        const target = meta?.target?.join(', ') || 'field'
        let message = 'A record with this unique field already exists'
        if (target.includes('email') || target.includes('adminEmail')) {
          message = 'An account with this email already exists. Please use a different email or log in instead.'
        } else if (target.includes('code')) {
          message = 'A branch with a similar code already exists. Please try a different company name.'
        }
        return NextResponse.json(
          { success: false, error: message },
          { status: 409 }
        )
      }
    }
    return NextResponse.json(
      { success: false, error: 'An error occurred during registration. Please try again.' },
      { status: 500 }
    )
  }
}

// GET: Get company info by ID (query param: id) or list all companies
export async function GET(request: Request) {
  try {
    // ---- Authentication ----
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (id) {
      // Non-admin users can only see their own company
      if (id !== auth.user.companyId && !isCompanyAdmin(auth.user.role)) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        )
      }

      const company = await db.company.findUnique({
        where: { id },
        include: {
          branches: {
            where: { isActive: true },
            select: {
              id: true,
              name: true,
              code: true,
              isHeadOffice: true,
              isActive: true,
              _count: {
                select: {
                  users: true,
                  products: { where: { isActive: true } },
                  sales: true,
                },
              },
            },
          },
          _count: {
            select: {
              branches: { where: { isActive: true } },
              users: { where: { isActive: true } },
              products: { where: { isActive: true } },
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
    }

    // List only the user's company (no company enumeration)
    const companies = await db.company.findMany({
      where: { id: auth.user.companyId, isActive: true },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            branches: { where: { isActive: true } },
            users: { where: { isActive: true } },
            products: { where: { isActive: true } },
          },
        },
      },
    })

    return NextResponse.json({ success: true, data: companies })
  } catch (error) {
    console.error('Companies GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT: Update company info
export async function PUT(request: Request) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    if (!isCompanyAdmin(auth.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Only company administrators can update company settings' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validation = safeValidate(companyUpdateSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.errors.join(', ') },
        { status: 400 }
      )
    }

    const { id, ...updateData } = validation.data

    // Verify the company belongs to the user
    if (id !== auth.user.companyId) {
      return NextResponse.json(
        { success: false, error: 'You can only update your own company' },
        { status: 403 }
      )
    }

    const existing = await db.company.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 }
      )
    }

    // Sanitize string fields
    const sanitizedData: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(updateData)) {
      if (typeof value === 'string') {
        sanitizedData[key] = sanitizeString(value)
      } else {
        sanitizedData[key] = value
      }
    }

    const company = await db.company.update({
      where: { id },
      data: sanitizedData,
    })

    const { ipAddress, userAgent } = getRequestInfo(request)
    logAudit({
      action: 'COMPANY_UPDATED',
      userId: auth.user.id,
      userEmail: auth.user.email,
      companyId: auth.user.companyId,
      ipAddress,
      userAgent,
      details: `Company settings updated`,
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
