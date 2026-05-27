import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const customer = await db.customer.findUnique({
      where: { id },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
            currency: true,
            currencySymbol: true,
            exchangeRate: true,
          },
        },
      },
    })

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: customer })
  } catch (error) {
    console.error('Customer GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, email, phone, address, creditLimit, isActive } = body

    const existing = await db.customer.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      )
    }

    const updateData: {
      name?: string
      email?: string | null
      phone?: string | null
      address?: string | null
      creditLimit?: number
      isActive?: boolean
    } = {}

    if (name !== undefined) updateData.name = name.trim()
    if (email !== undefined) updateData.email = email?.trim() || null
    if (phone !== undefined) updateData.phone = phone?.trim() || null
    if (address !== undefined) updateData.address = address?.trim() || null
    if (creditLimit !== undefined) updateData.creditLimit = creditLimit
    if (isActive !== undefined) updateData.isActive = isActive

    const customer = await db.customer.update({
      where: { id },
      data: updateData,
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

    return NextResponse.json({ success: true, data: customer })
  } catch (error) {
    console.error('Customer PUT error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.customer.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      )
    }

    // Soft delete - set isActive to false
    const customer = await db.customer.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({
      success: true,
      data: customer,
      message: 'Customer deactivated successfully',
    })
  } catch (error) {
    console.error('Customer DELETE error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
