import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET: Get company details with branches summary
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

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
    const { id } = await params
    const body = await request.json()
    const { name, industry, email, phone, address, logoUrl, plan } = body

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

// DELETE: Deactivate company (soft delete)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

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
