import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

// POST: Register a new company (creates company + head office branch + admin user)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, industry, email, phone, address, adminName, adminEmail, adminPassword } = body

    if (!name || !adminName || !adminEmail) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, adminName, adminEmail' },
        { status: 400 }
      )
    }

    const result = await db.$transaction(async (tx) => {
      // 1. Create the Company record
      const company = await tx.company.create({
        data: {
          name,
          industry: industry || null,
          email: email || null,
          phone: phone || null,
          address: address || null,
          plan: 'free',
          isActive: true,
        },
      })

      // 2. Create a Head Office branch under that company
      const branchCode = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) + '-HQ'
      const headOffice = await tx.branch.create({
        data: {
          name: `${name} - Head Office`,
          code: branchCode,
          address: address || null,
          phone: phone || null,
          isHeadOffice: true,
          isActive: true,
          companyId: company.id,
        },
      })

      // 3. Create an Admin user for that company assigned to the head office branch
      const admin = await tx.user.create({
        data: {
          email: adminEmail,
          name: adminName,
          passwordHash: adminPassword || '$2a$10$defaultpasswordhash',
          role: 'CompanyAdmin',
          branchId: headOffice.id,
          companyId: company.id,
          isActive: true,
        },
        include: {
          branch: true,
          company: true,
        },
      })

      return { company, headOffice, admin }
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
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET: Get company info by ID (query param: id) or list all companies
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (id) {
      // Get specific company
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

    // List all active companies
    const companies = await db.company.findMany({
      where: { isActive: true },
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
    const body = await request.json()
    const { id, name, industry, email, phone, address, logoUrl, plan } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: id' },
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

    const updateData: {
      name?: string
      industry?: string | null
      email?: string | null
      phone?: string | null
      address?: string | null
      logoUrl?: string | null
      plan?: string
    } = {}
    if (name !== undefined) updateData.name = name
    if (industry !== undefined) updateData.industry = industry
    if (email !== undefined) updateData.email = email
    if (phone !== undefined) updateData.phone = phone
    if (address !== undefined) updateData.address = address
    if (logoUrl !== undefined) updateData.logoUrl = logoUrl
    if (plan !== undefined) updateData.plan = plan

    const company = await db.company.update({
      where: { id },
      data: updateData,
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
