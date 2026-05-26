import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({
      where: { email },
      include: {
        branch: true,
        company: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Password validation
    // Seeded demo users have passwords like "$2a$10$dummyhashforadmin"
    // Registered users store the actual password in passwordHash
    // Accept: (1) exact match with stored hash, (2) "demo" for seeded accounts
    const isSeededDemoUser = user.passwordHash.startsWith('$2a$10$dummy')
    const isRegisteredUser = !user.passwordHash.startsWith('$2a$10$')
    
    if (isRegisteredUser) {
      // For registered users, password must match exactly
      if (password !== user.passwordHash) {
        return NextResponse.json(
          { success: false, error: 'Invalid email or password' },
          { status: 401 }
        )
      }
    } else if (isSeededDemoUser) {
      // For seeded demo users, accept "demo" as password
      if (password !== 'demo') {
        return NextResponse.json(
          { success: false, error: 'Invalid email or password. Hint: try "demo" for demo accounts' },
          { status: 401 }
        )
      }
    }

    const token = Buffer.from(user.id).toString('base64')

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
          },
        },
        token,
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
