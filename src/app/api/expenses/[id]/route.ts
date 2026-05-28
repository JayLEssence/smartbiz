import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { authenticateRequest, isManagerOrAbove } from '@/lib/auth'
import { safeValidate, sanitizeString, expenseUpdateSchema } from '@/lib/validation'
import { logAudit, getRequestInfo } from '@/lib/audit-log'

const EXPENSE_CATEGORIES = ['Rent', 'Utilities', 'Salaries', 'Transport', 'Supplies', 'Maintenance', 'Other']

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Verify expense belongs to authenticated user's company (tenant isolation)
    if (expense.companyId !== auth.user.companyId) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Expense does not belong to your company.' },
        { status: 403 }
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
    // Authenticate request
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Authentication required' },
        { status: 401 }
      )
    }

    // Only managers/admins can update expenses
    if (!isManagerOrAbove(auth.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Manager or Admin role required to update expenses.' },
        { status: 403 }
      )
    }

    const reqInfo = getRequestInfo(request)
    const { id } = await params
    const body = await request.json()

    const validation = safeValidate(expenseUpdateSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.errors.join(', ') },
        { status: 400 }
      )
    }

    const existing = await db.expense.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Expense not found' },
        { status: 404 }
      )
    }

    // Verify expense belongs to authenticated user's company (tenant isolation)
    if (existing.companyId !== auth.user.companyId) {
      logAudit({
        action: 'SUSPICIOUS_ACTIVITY',
        userId: auth.user.id,
        userEmail: auth.user.email,
        companyId: auth.user.companyId,
        branchId: auth.user.branchId,
        details: `Attempted to update expense outside company: ${id}`,
        ipAddress: reqInfo.ipAddress,
        userAgent: reqInfo.userAgent,
      })
      return NextResponse.json(
        { success: false, error: 'Access denied. Expense does not belong to your company.' },
        { status: 403 }
      )
    }

    const { category, description, amount, date, branchId } = validation.data

    // If branchId is being changed, verify it belongs to same company
    if (branchId && branchId !== existing.branchId) {
      const branch = await db.branch.findUnique({ where: { id: branchId } })
      if (!branch || branch.companyId !== auth.user.companyId) {
        return NextResponse.json(
          { success: false, error: 'Branch does not belong to your company' },
          { status: 400 }
        )
      }
    }

    const updateData: Record<string, unknown> = {}
    if (category !== undefined) updateData.category = category
    if (description !== undefined) updateData.description = sanitizeString(description)
    if (amount !== undefined) updateData.amount = amount
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
    const newAmount = amount !== undefined ? amount : existing.amount
    if (newAmount > 1000000 && existing.amount <= 1000000) {
      await db.notification.create({
        data: {
          type: 'ExpenseAlert',
          title: 'Large Expense Updated',
          message: `Expense updated to ${newAmount.toLocaleString()}: ${description || existing.description}`,
          companyId: auth.user.companyId,
          branchId: branchId || existing.branchId,
        },
      })
    }

    // Audit log for expense update
    logAudit({
      action: 'EXPENSE_UPDATED',
      userId: auth.user.id,
      userEmail: auth.user.email,
      companyId: auth.user.companyId,
      branchId: existing.branchId,
      details: `Expense updated: ${id}, fields: ${Object.keys(updateData).join(', ')}`,
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    })

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
    // Authenticate request
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Authentication required' },
        { status: 401 }
      )
    }

    // Only managers/admins can delete expenses
    if (!isManagerOrAbove(auth.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Manager or Admin role required to delete expenses.' },
        { status: 403 }
      )
    }

    const reqInfo = getRequestInfo(request)
    const { id } = await params

    const existing = await db.expense.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Expense not found' },
        { status: 404 }
      )
    }

    // Verify expense belongs to authenticated user's company (tenant isolation)
    if (existing.companyId !== auth.user.companyId) {
      logAudit({
        action: 'SUSPICIOUS_ACTIVITY',
        userId: auth.user.id,
        userEmail: auth.user.email,
        companyId: auth.user.companyId,
        branchId: auth.user.branchId,
        details: `Attempted to delete expense outside company: ${id}`,
        ipAddress: reqInfo.ipAddress,
        userAgent: reqInfo.userAgent,
      })
      return NextResponse.json(
        { success: false, error: 'Access denied. Expense does not belong to your company.' },
        { status: 403 }
      )
    }

    await db.expense.delete({ where: { id } })

    // Audit log for expense deletion
    logAudit({
      action: 'EXPENSE_DELETED',
      userId: auth.user.id,
      userEmail: auth.user.email,
      companyId: auth.user.companyId,
      branchId: existing.branchId,
      details: `Expense deleted: ${id}, description: ${existing.description}, amount: ${existing.amount}`,
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    })

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
