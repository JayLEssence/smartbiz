import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { authenticateRequest, isManagerOrAbove } from '@/lib/auth'
import { safeValidate, expenseCreateSchema, sanitizeString } from '@/lib/validation'
import { logAudit, getRequestInfo } from '@/lib/audit-log'

const EXPENSE_CATEGORIES = ['Rent', 'Utilities', 'Salaries', 'Transport', 'Supplies', 'Maintenance', 'Other']

export async function GET(request: Request) {
  try {
    // Authenticate request
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Authentication required' },
        { status: 401 }
      )
    }

    // Only managers/admins can access expense data
    if (!isManagerOrAbove(auth.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Manager or Admin role required.' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)

    // ALWAYS use authenticated user's companyId (tenant isolation)
    const companyId = auth.user.companyId
    const branchId = searchParams.get('branchId')
    const category = searchParams.get('category')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: Prisma.ExpenseWhereInput = {
      companyId, // Enforce tenant isolation
    }

    if (branchId) {
      where.branchId = branchId
    }

    if (category) {
      where.category = category
    }

    if (dateFrom || dateTo) {
      where.date = {}
      if (dateFrom) {
        where.date.gte = new Date(dateFrom)
      }
      if (dateTo) {
        where.date.lte = new Date(dateTo)
      }
    }

    const [expenses, total] = await Promise.all([
      db.expense.findMany({
        where,
        include: {
          branch: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        orderBy: { date: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.expense.count({ where }),
    ])

    // Calculate category totals for summary
    const categoryTotals = await db.expense.groupBy({
      by: ['category'],
      where,
      _sum: {
        amount: true,
      },
    })

    // Calculate total for current month
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthWhere: Prisma.ExpenseWhereInput = {
      companyId,
      date: { gte: monthStart },
    }
    if (branchId) {
      monthWhere.branchId = branchId
    }

    const monthTotal = await db.expense.aggregate({
      where: monthWhere,
      _sum: {
        amount: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: expenses,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      summary: {
        totalThisMonth: monthTotal._sum.amount ?? 0,
        byCategory: categoryTotals.reduce(
          (acc, item) => {
            acc[item.category] = item._sum.amount ?? 0
            return acc
          },
          {} as Record<string, number>
        ),
      },
    })
  } catch (error) {
    console.error('Expenses GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    // Authenticate request
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Authentication required' },
        { status: 401 }
      )
    }

    // Only managers/admins can create expenses
    if (!isManagerOrAbove(auth.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Manager or Admin role required to create expenses.' },
        { status: 403 }
      )
    }

    const reqInfo = getRequestInfo(request)
    const body = await request.json()

    // CRITICAL: ALWAYS override companyId with authenticated user's companyId (never trust request body)
    const companyId = auth.user.companyId

    // Validate input with Zod schema
    const validation = safeValidate(expenseCreateSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.errors },
        { status: 400 }
      )
    }

    const validatedData = validation.data

    // Sanitize string inputs
    const description = sanitizeString(validatedData.description)
    if (!description) {
      return NextResponse.json(
        { success: false, error: 'Description is required after sanitization' },
        { status: 400 }
      )
    }

    // Verify branch belongs to the authenticated user's company
    const branch = await db.branch.findUnique({
      where: { id: validatedData.branchId },
    })
    if (!branch) {
      return NextResponse.json(
        { success: false, error: 'Branch not found' },
        { status: 404 }
      )
    }
    if (branch.companyId !== companyId) {
      logAudit({
        action: 'SUSPICIOUS_ACTIVITY',
        userId: auth.user.id,
        userEmail: auth.user.email,
        companyId: auth.user.companyId,
        branchId: auth.user.branchId,
        details: `Attempted to create expense for branch outside company: ${validatedData.branchId}`,
        ipAddress: reqInfo.ipAddress,
        userAgent: reqInfo.userAgent,
      })
      return NextResponse.json(
        { success: false, error: 'Branch does not belong to your company' },
        { status: 400 }
      )
    }

    const expense = await db.expense.create({
      data: {
        category: validatedData.category,
        description,
        amount: Number(validatedData.amount),
        date: validatedData.date ? new Date(validatedData.date) : new Date(),
        branchId: validatedData.branchId,
        companyId, // Use auth-derived companyId, NEVER from request body
      },
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

    // Create notification if expense exceeds threshold (1,000,000 local currency)
    if (Number(validatedData.amount) > 1000000) {
      await db.notification.create({
        data: {
          type: 'ExpenseAlert',
          title: 'Large Expense Recorded',
          message: `Expense of ${Number(validatedData.amount).toLocaleString()} recorded: ${description}`,
          companyId,
          branchId: validatedData.branchId,
        },
      })
    }

    // Audit log for expense creation
    logAudit({
      action: 'EXPENSE_CREATED',
      userId: auth.user.id,
      userEmail: auth.user.email,
      companyId: auth.user.companyId,
      branchId: validatedData.branchId,
      details: `Expense created: ${description}, amount: ${validatedData.amount}, category: ${validatedData.category}`,
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    })

    return NextResponse.json({ success: true, data: expense }, { status: 201 })
  } catch (error) {
    console.error('Expenses POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
