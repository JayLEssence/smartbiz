import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, password, branchCode } = body

    // Validate required fields
    if (!name || !email || !password || !branchCode) {
      return NextResponse.json(
        { success: false, error: 'All fields are required: name, email, password, branchCode' },
        { status: 400 }
      )
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    // Find the branch by code
    const branch = await db.branch.findUnique({
      where: { code: branchCode.toUpperCase() },
      include: { company: true },
    })

    if (!branch) {
      return NextResponse.json(
        { success: false, error: 'Invalid branch code. Please check with your manager.' },
        { status: 404 }
      )
    }

    if (!branch.isActive) {
      return NextResponse.json(
        { success: false, error: 'This branch is currently inactive. Contact your manager.' },
        { status: 400 }
      )
    }

    if (!branch.company.isActive) {
      return NextResponse.json(
        { success: false, error: 'This company account is currently inactive.' },
        { status: 400 }
      )
    }

    // Check for duplicate email
    const existingUser = await db.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'An account with this email already exists. Try signing in instead.' },
        { status: 409 }
      )
    }

    // Create the employee user
    const user = await db.user.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        passwordHash: password, // In production, use bcrypt
        role: 'Employee',
        branchId: branch.id,
        companyId: branch.companyId,
        isActive: true,
      },
      include: {
        branch: true,
        company: true,
      },
    })

    // Generate a simple token (base64 of user id)
    const token = Buffer.from(user.id).toString('base64')

    // Return the same format as login for seamless session creation
    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          branchId: user.branchId,
          companyId: user.companyId,
          branch: {
            id: user.branch.id,
            name: user.branch.name,
            code: user.branch.code,
            isHeadOffice: user.branch.isHeadOffice,
          },
          company: {
            id: user.company.id,
            name: user.company.name,
            industry: user.company.industry,
            plan: user.company.plan,
            email: user.company.email,
            phone: user.company.phone,
            address: user.company.address,
            logoUrl: user.company.logoUrl,
            isActive: user.company.isActive,
            currency: user.company.currency,
            currencySymbol: user.company.currencySymbol,
            country: user.company.country,
            exchangeRate: user.company.exchangeRate,
          },
        },
        token,
      },
    })
  } catch (error) {
    console.error('Join error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
