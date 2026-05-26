import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

// GET: List users for a company (filter by companyId), include branch info
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    const branchId = searchParams.get('branchId')
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const where: Prisma.UserWhereInput = {}

    if (companyId) {
      where.companyId = companyId
    }

    if (branchId) {
      where.branchId = branchId
    }

    if (!includeInactive) {
      where.isActive = true
    }

    const users = await db.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
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

    // Remove passwordHash from response
    const safeUsers = users.map(({ passwordHash, ...user }) => user)

    return NextResponse.json({ success: true, data: safeUsers })
  } catch (error) {
    console.error('Users GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST: Create a new user
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, password, role, branchId, companyId } = body

    if (!name || !email || !role || !branchId || !companyId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, email, role, branchId, companyId' },
        { status: 400 }
      )
    }

    // Validate branch belongs to the company
    const branch = await db.branch.findUnique({ where: { id: branchId } })
    if (!branch) {
      return NextResponse.json(
        { success: false, error: 'Branch not found' },
        { status: 404 }
      )
    }
    if (branch.companyId !== companyId) {
      return NextResponse.json(
        { success: false, error: 'Branch does not belong to the specified company' },
        { status: 400 }
      )
    }

    // Validate company exists
    const company = await db.company.findUnique({ where: { id: companyId } })
    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 }
      )
    }

    // Check for duplicate email
    const existingUser = await db.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'A user with this email already exists' },
        { status: 409 }
      )
    }

    const user = await db.user.create({
      data: {
        name,
        email,
        passwordHash: password || 'demo-password', // In production, use bcrypt
        role,
        branchId,
        companyId,
        isActive: true,
      },
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

    return NextResponse.json({ success: true, data: safeUser }, { status: 201 })
  } catch (error) {
    console.error('Users POST error:', error)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'A user with this email already exists' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT: Update user (role, branchId, name, isActive)
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, name, role, branchId, isActive } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: id' },
        { status: 400 }
      )
    }

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
    console.error('Users PUT error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE: Soft delete user (set isActive=false)
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing required query param: id' },
        { status: 400 }
      )
    }

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
    console.error('Users DELETE error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
