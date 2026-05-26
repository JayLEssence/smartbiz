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
      },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Demo mode: accept any password for existing users
    // In production, use proper bcrypt comparison
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
          branch: {
            id: user.branch.id,
            name: user.branch.name,
            code: user.branch.code,
            isHeadOffice: user.branch.isHeadOffice,
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
