import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    const branchId = searchParams.get('branchId')
    const search = searchParams.get('search')
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const where: Prisma.CustomerWhereInput = {}

    if (companyId) {
      where.companyId = companyId
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
    const body = await request.json()
    const { name, email, phone, address, creditLimit, branchId, companyId } = body

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: name' },
        { status: 400 }
      )
    }

    if (!branchId) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: branchId' },
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

    // Verify branch exists and belongs to company
    const branch = await db.branch.findFirst({
      where: { id: branchId, companyId },
    })
    if (!branch) {
      return NextResponse.json(
        { success: false, error: 'Branch not found or does not belong to this company' },
        { status: 404 }
      )
    }

    const customer = await db.customer.create({
      data: {
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        creditLimit: typeof creditLimit === 'number' ? creditLimit : 0,
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

    return NextResponse.json({ success: true, data: customer }, { status: 201 })
  } catch (error) {
    console.error('Customers POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
