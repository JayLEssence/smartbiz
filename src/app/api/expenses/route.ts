import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

const EXPENSE_CATEGORIES = ['Rent', 'Utilities', 'Salaries', 'Transport', 'Supplies', 'Maintenance', 'Other']

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    const branchId = searchParams.get('branchId')
    const category = searchParams.get('category')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'companyId is required' },
        { status: 400 }
      )
    }

    const where: Prisma.ExpenseWhereInput = {
      companyId,
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
    const body = await request.json()
    const { category, description, amount, branchId, companyId, date } = body

    if (!category || !description || !amount || !branchId || !companyId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: category, description, amount, branchId, companyId' },
        { status: 400 }
      )
    }

    if (!EXPENSE_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { success: false, error: `Invalid category. Must be one of: ${EXPENSE_CATEGORIES.join(', ')}` },
        { status: 400 }
      )
    }

    if (Number(amount) <= 0) {
      return NextResponse.json(
        { success: false, error: 'Amount must be greater than 0' },
        { status: 400 }
      )
    }

    // Verify branch belongs to company
    const branch = await db.branch.findUnique({
      where: { id: branchId },
    })
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

    const expense = await db.expense.create({
      data: {
        category,
        description,
        amount: Number(amount),
        date: date ? new Date(date) : new Date(),
        branchId,
        companyId,
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
    if (Number(amount) > 1000000) {
      await db.notification.create({
        data: {
          type: 'ExpenseAlert',
          title: 'Large Expense Recorded',
          message: `Expense of ${Number(amount).toLocaleString()} recorded: ${description}`,
          companyId,
          branchId,
        },
      })
    }

    return NextResponse.json({ success: true, data: expense }, { status: 201 })
  } catch (error) {
    console.error('Expenses POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
