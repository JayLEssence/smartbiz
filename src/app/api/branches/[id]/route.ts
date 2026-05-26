import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const branch = await db.branch.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            products: { where: { isActive: true } },
            sales: true,
            shrinkages: true,
            inventoryBatches: true,
          },
        },
      },
    })

    if (!branch) {
      return NextResponse.json(
        { success: false, error: 'Branch not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: branch })
  } catch (error) {
    console.error('Branch GET error:', error)
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
    const { name, address, phone, isActive } = body

    const existing = await db.branch.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Branch not found' },
        { status: 404 }
      )
    }

    const updateData: { name?: string; address?: string | null; phone?: string | null; isActive?: boolean } = {}
    if (name !== undefined) updateData.name = name
    if (address !== undefined) updateData.address = address
    if (phone !== undefined) updateData.phone = phone
    if (isActive !== undefined) updateData.isActive = isActive

    const branch = await db.branch.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ success: true, data: branch })
  } catch (error) {
    console.error('Branch PUT error:', error)
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

    const existing = await db.branch.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Branch not found' },
        { status: 404 }
      )
    }

    // Soft delete - set isActive to false
    const branch = await db.branch.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({
      success: true,
      data: branch,
      message: 'Branch deactivated successfully',
    })
  } catch (error) {
    console.error('Branch DELETE error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
