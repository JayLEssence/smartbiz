import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { authenticateRequest, hashPassword, isCompanyAdmin, isManagerOrAbove } from '@/lib/auth'
import { safeValidate, userCreateSchema, userUpdateSchema, sanitizeString } from '@/lib/validation'
import { logAudit, getRequestInfo } from '@/lib/audit-log'

// GET: List users for a company (filter by companyId), include branch info
export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId') || auth.user.companyId
    const branchId = searchParams.get('branchId')
    const includeInactive = searchParams.get('includeInactive') === 'true'

    // Users can only see users in their own company
    if (companyId !== auth.user.companyId) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    const where: Prisma.UserWhereInput = { companyId }

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
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Only admins and managers can create users
    if (!isManagerOrAbove(auth.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Only managers and administrators can create users' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validation = safeValidate(userCreateSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.errors.join(', ') },
        { status: 400 }
      )
    }

    const { name, email, password, role, branchId, companyId } = validation.data
    const { ipAddress, userAgent } = getRequestInfo(request)

    // Verify the company matches
    if (companyId !== auth.user.companyId) {
      return NextResponse.json(
        { success: false, error: 'Cannot create users for a different company' },
        { status: 403 }
      )
    }

    // Only admins can create admin users
    if (role === 'CompanyAdmin' && !isCompanyAdmin(auth.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Only administrators can create admin users' },
        { status: 403 }
      )
    }

    // Managers can only create employees in their own branch
    if (auth.user.role === 'BranchManager' && branchId !== auth.user.branchId) {
      return NextResponse.json(
        { success: false, error: 'Managers can only create users in their own branch' },
        { status: 403 }
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

    // Check for duplicate email
    const existingUser = await db.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'A user with this email already exists' },
        { status: 409 }
      )
    }

    // Hash password
    const hashedPassword = await hashPassword(password)

    const user = await db.user.create({
      data: {
        name: sanitizeString(name),
        email: sanitizeString(email),
        passwordHash: hashedPassword,
        role,
        branchId,
        companyId,
        isActive: true,
        passwordChangedAt: new Date(),
        mustChangePassword: true, // Force password change on first login
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

    // Audit log
    logAudit({
      action: 'USER_CREATED',
      userId: auth.user.id,
      userEmail: auth.user.email,
      companyId: auth.user.companyId,
      branchId: auth.user.branchId,
      ipAddress,
      userAgent,
      details: `Created user ${email} with role ${role}`,
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
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validation = safeValidate(userUpdateSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.errors.join(', ') },
        { status: 400 }
      )
    }

    const { id, name, role, branchId, isActive, password } = validation.data
    const { ipAddress, userAgent } = getRequestInfo(request)

    const existing = await db.user.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Verify user belongs to the same company
    if (existing.companyId !== auth.user.companyId) {
      return NextResponse.json(
        { success: false, error: 'Cannot update users from a different company' },
        { status: 403 }
      )
    }

    // Only admins can change roles
    if (role !== undefined && !isCompanyAdmin(auth.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Only administrators can change user roles' },
        { status: 403 }
      )
    }

    // Prevent self-demotion
    if (id === auth.user.id && role && role !== auth.user.role) {
      return NextResponse.json(
        { success: false, error: 'You cannot change your own role' },
        { status: 403 }
      )
    }

    // Managers can only update users in their branch
    if (auth.user.role === 'BranchManager' && existing.branchId !== auth.user.branchId) {
      return NextResponse.json(
        { success: false, error: 'Managers can only update users in their own branch' },
        { status: 403 }
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
      passwordHash?: string
      mustChangePassword?: boolean
    } = {}
    if (name !== undefined) updateData.name = sanitizeString(name)
    if (role !== undefined) updateData.role = role
    if (branchId !== undefined) updateData.branchId = branchId
    if (isActive !== undefined) updateData.isActive = isActive

    // If password is being updated, hash it
    if (password) {
      updateData.passwordHash = await hashPassword(password)
      updateData.mustChangePassword = true
    }

    // Track role changes in audit log
    if (role && role !== existing.role) {
      logAudit({
        action: 'USER_ROLE_CHANGED',
        userId: auth.user.id,
        userEmail: auth.user.email,
        companyId: auth.user.companyId,
        branchId: auth.user.branchId,
        ipAddress,
        userAgent,
        details: `Changed ${existing.email} role from ${existing.role} to ${role}`,
        severity: 'warning',
      })
    }

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

    logAudit({
      action: 'USER_UPDATED',
      userId: auth.user.id,
      userEmail: auth.user.email,
      companyId: auth.user.companyId,
      ipAddress,
      userAgent,
      details: `Updated user ${existing.email}`,
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
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    if (!isCompanyAdmin(auth.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Only administrators can deactivate users' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing required query param: id' },
        { status: 400 }
      )
    }

    // Prevent self-deactivation
    if (id === auth.user.id) {
      return NextResponse.json(
        { success: false, error: 'You cannot deactivate your own account' },
        { status: 403 }
      )
    }

    const existing = await db.user.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    if (existing.companyId !== auth.user.companyId) {
      return NextResponse.json(
        { success: false, error: 'Cannot deactivate users from a different company' },
        { status: 403 }
      )
    }

    const user = await db.user.update({
      where: { id },
      data: { isActive: false },
    })

    const { ipAddress, userAgent } = getRequestInfo(request)
    logAudit({
      action: 'USER_DEACTIVATED',
      userId: auth.user.id,
      userEmail: auth.user.email,
      companyId: auth.user.companyId,
      ipAddress,
      userAgent,
      details: `Deactivated user ${existing.email}`,
    })

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
