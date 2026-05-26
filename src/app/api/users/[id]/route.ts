import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET: Get a single user by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const user = await db.user.findUnique({
      where: { id },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
            isHeadOffice: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
            plan: true,
          },
        },
        _count: {
          select: {
            sales: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Remove passwordHash from response
    const { passwordHash, ...safeUser } = user

    return NextResponse.json({ success: true, data: safeUser })
  } catch (error) {
    console.error('User GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT: Update user by ID
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, role, branchId, isActive } = body

    const existing = await db.user.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // If branchId is changing, validate it belongs to the same company
    if (branchId && branchId !== existing.branchId) {
      const branch = await db.branch.findUnique({ where: { id: branchId } })
      if (!branch) {
        return NextResponse.json(
          { success: false, error: 'Branch not found' },
          { status: 404 }
        )
      }
      if (branch.companyId !== existing.companyId) {
        return NextResponse.json(
          { success: false, error: 'Branch does not belong to the user\'s company' },
          { status: 400 }
        )
      }
    }

    const updateData: {
      name?: string
      role?: string
      branchId?: string
      isActive?: boolean
    } = {}
    if (name !== undefined) updateData.name = name
    if (role !== undefined) updateData.role = role
    if (branchId !== undefined) updateData.branchId = branchId
    if (isActive !== undefined) updateData.isActive = isActive

    const user = await db.user.update({
      where: { id },
      data: updateData,
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
            isHeadOffice: true,
          },
        },
      },
    })

    // Remove passwordHash from response
    const { passwordHash, ...safeUser } = user

    return NextResponse.json({ success: true, data: safeUser })
  } catch (error) {
    console.error('User PUT error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE: Soft delete user by ID (set isActive=false)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.user.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Soft delete - set isActive to false
    const user = await db.user.update({
      where: { id },
      data: { isActive: false },
    })

    // Remove passwordHash from response
    const { passwordHash, ...safeUser } = user

    return NextResponse.json({
      success: true,
      data: safeUser,
      message: 'User deactivated successfully',
    })
  } catch (error) {
    console.error('User DELETE error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
