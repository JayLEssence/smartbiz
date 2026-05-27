import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const supplier = await db.supplier.findUnique({
      where: { id },
      include: {
        inventoryBatches: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
          },
          orderBy: { dateReceived: 'desc' },
          take: 20,
        },
        _count: {
          select: {
            inventoryBatches: true,
          },
        },
      },
    })

    if (!supplier) {
      return NextResponse.json(
        { success: false, error: 'Supplier not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: supplier })
  } catch (error) {
    console.error('Supplier GET error:', error)
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
    const { name, email, phone, address, isActive } = body

    const existing = await db.supplier.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Supplier not found' },
        { status: 404 }
      )
    }

    const updateData: {
      name?: string
      email?: string | null
      phone?: string | null
      address?: string | null
      isActive?: boolean
    } = {}
    if (name !== undefined) updateData.name = name
    if (email !== undefined) updateData.email = email
    if (phone !== undefined) updateData.phone = phone
    if (address !== undefined) updateData.address = address
    if (isActive !== undefined) updateData.isActive = isActive

    const supplier = await db.supplier.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ success: true, data: supplier })
  } catch (error) {
    console.error('Supplier PUT error:', error)
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

    const existing = await db.supplier.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Supplier not found' },
        { status: 404 }
      )
    }

    // Soft delete - set isActive to false
    const supplier = await db.supplier.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({
      success: true,
      data: supplier,
      message: 'Supplier deactivated successfully',
    })
  } catch (error) {
    console.error('Supplier DELETE error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
