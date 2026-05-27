import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    const search = searchParams.get('search') || ''
    const includeInactive = searchParams.get('includeInactive') === 'true'

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: companyId' },
        { status: 400 }
      )
    }

    const where: Prisma.SupplierWhereInput = {
      companyId,
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
    const body = await request.json()
    const { name, email, phone, address, companyId } = body

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: name' },
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

    const supplier = await db.supplier.create({
      data: {
        name,
        email: email || null,
        phone: phone || null,
        address: address || null,
        companyId,
      },
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
