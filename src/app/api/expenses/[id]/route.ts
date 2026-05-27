import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

const EXPENSE_CATEGORIES = ['Rent', 'Utilities', 'Salaries', 'Transport', 'Supplies', 'Maintenance', 'Other']

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const expense = await db.expense.findUnique({
      where: { id },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
            currency: true,
            currencySymbol: true,
            exchangeRate: true,
          },
        },
      },
    })

    if (!expense) {
      return NextResponse.json(
        { success: false, error: 'Expense not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: expense })
  } catch (error) {
    console.error('Expense GET error:', error)
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
    const { category, description, amount, date, branchId } = body

    const existing = await db.expense.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Expense not found' },
        { status: 404 }
      )
    }

    if (category && !EXPENSE_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { success: false, error: `Invalid category. Must be one of: ${EXPENSE_CATEGORIES.join(', ')}` },
        { status: 400 }
      )
    }

    if (amount !== undefined && Number(amount) <= 0) {
      return NextResponse.json(
        { success: false, error: 'Amount must be greater than 0' },
        { status: 400 }
      )
    }

    // If branchId is being changed, verify it belongs to same company
    if (branchId && branchId !== existing.branchId) {
      const branch = await db.branch.findUnique({ where: { id: branchId } })
      if (!branch || branch.companyId !== existing.companyId) {
        return NextResponse.json(
          { success: false, error: 'Branch does not belong to the same company' },
          { status: 400 }
        )
      }
    }

    const updateData: {
      category?: string
      description?: string
      amount?: number
      date?: Date
      branchId?: string
    } = {}
    if (category !== undefined) updateData.category = category
    if (description !== undefined) updateData.description = description
    if (amount !== undefined) updateData.amount = Number(amount)
    if (date !== undefined) updateData.date = new Date(date)
    if (branchId !== undefined) updateData.branchId = branchId

    const expense = await db.expense.update({
      where: { id },
      data: updateData,
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

    // Create notification if updated expense now exceeds threshold
    const newAmount = amount !== undefined ? Number(amount) : existing.amount
    if (newAmount > 1000000 && existing.amount <= 1000000) {
      await db.notification.create({
        data: {
          type: 'ExpenseAlert',
          title: 'Large Expense Updated',
          message: `Expense updated to ${newAmount.toLocaleString()}: ${description || existing.description}`,
          companyId: existing.companyId,
          branchId: branchId || existing.branchId,
        },
      })
    }

    return NextResponse.json({ success: true, data: expense })
  } catch (error) {
    console.error('Expense PUT error:', error)
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

    const existing = await db.expense.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Expense not found' },
        { status: 404 }
      )
    }

    await db.expense.delete({ where: { id } })

    return NextResponse.json({
      success: true,
      message: 'Expense deleted successfully',
    })
  } catch (error) {
    console.error('Expense DELETE error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
