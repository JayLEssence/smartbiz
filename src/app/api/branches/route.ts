import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'
    const companyId = searchParams.get('companyId')

    const where: Prisma.BranchWhereInput = {}
    if (!includeInactive) {
      where.isActive = true
    }
    if (companyId) {
      where.companyId = companyId
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
    const body = await request.json()
    const { name, code, address, phone, isHeadOffice, companyId } = body

    if (!name || !code) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, code' },
        { status: 400 }
      )
    }

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: companyId' },
        { status: 400 }
      )
    }

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
        name,
        code: code.toUpperCase(),
        address: address || null,
        phone: phone || null,
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
