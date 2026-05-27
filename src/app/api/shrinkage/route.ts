import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { authenticateRequest, isManagerOrAbove } from '@/lib/auth'
import { safeValidate, shrinkageCreateSchema, sanitizeString } from '@/lib/validation'
import { logAudit, getRequestInfo } from '@/lib/audit-log'

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const reason = searchParams.get('reason')
    const branchId = searchParams.get('branchId')

    const where: Prisma.ShrinkageWhereInput = {}

    // Tenant isolation: always filter by authenticated user's companyId
    where.branch = { companyId: auth.user.companyId }

    if (from || to) {
      where.dateRecorded = {}
      if (from) {
        where.dateRecorded.gte = new Date(from)
      }
      if (to) {
        where.dateRecorded.lte = new Date(to)
      }
    }

    if (reason) {
      where.reason = sanitizeString(reason)
    }

    // Branch-based access control
    if (auth.user.role !== 'CompanyAdmin') {
      // Employees and managers can only see shrinkage for their own branch
      if (branchId && branchId !== auth.user.branchId) {
        return NextResponse.json(
          { success: false, error: 'You can only view shrinkage records for your assigned branch' },
          { status: 403 }
        )
      }
      where.branchId = auth.user.branchId
    } else {
      // Admin can filter by any branch within their company
      if (branchId) {
        where.branchId = branchId
      }
    }

    const shrinkages = await db.shrinkage.findMany({
      where,
      include: {
        product: true,
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: { dateRecorded: 'desc' },
    })

    // Add financialLoss to each record
    const shrinkagesWithLoss = await Promise.all(
      shrinkages.map(async (s) => {
        const batch = await db.inventoryBatch.findFirst({
          where: {
            productId: s.productId,
            dateReceived: { lte: s.dateRecorded },
          },
          orderBy: { dateReceived: 'desc' },
        })
        const costPrice = batch ? batch.purchasePricePerUnit : 0
        const financialLoss = costPrice * s.quantityLost
        return {
          ...s,
          financialLoss: Math.round(financialLoss * 100) / 100,
        }
      })
    )

    return NextResponse.json({ success: true, data: shrinkagesWithLoss })
  } catch (error) {
    console.error('Shrinkage GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Authentication required' },
        { status: 401 }
      )
    }

    if (!isManagerOrAbove(auth.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Only managers and admins can record shrinkage' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { productId, quantityLost, reason, branchId } = body

    // Sanitize string inputs
    const sanitizedBody = {
      productId,
      quantityLost,
      reason: reason ? sanitizeString(String(reason)) : reason,
      branchId,
    }

    // Validate input with Zod schema
    const validation = safeValidate(shrinkageCreateSchema, sanitizedBody)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.errors },
        { status: 400 }
      )
    }

    const validatedData = validation.data

    // Non-admin users can only record shrinkage for their own branch
    if (auth.user.role !== 'CompanyAdmin' && validatedData.branchId !== auth.user.branchId) {
      return NextResponse.json(
        { success: false, error: 'You can only record shrinkage for your assigned branch' },
        { status: 403 }
      )
    }

    const result = await db.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: validatedData.productId },
      })

      if (!product) {
        throw new Error('Product not found')
      }

      // Tenant isolation: product must belong to the authenticated user's company
      if (product.companyId !== auth.user.companyId) {
        throw new Error('Product not found')
      }

      if (product.currentStockLevel < validatedData.quantityLost) {
        throw new Error(`Insufficient stock. Available: ${product.currentStockLevel}, Lost: ${validatedData.quantityLost}`)
      }

      // Validate branch belongs to user's company
      const shrinkageBranch = await tx.branch.findUnique({
        where: { id: validatedData.branchId },
      })

      if (!shrinkageBranch) {
        throw new Error('Branch not found')
      }

      if (shrinkageBranch.companyId !== auth.user.companyId) {
        throw new Error('Branch does not belong to your company')
      }

      // Validate branch belongs to same company as product
      if (validatedData.branchId !== product.branchId && shrinkageBranch.companyId !== product.companyId) {
        throw new Error('Branch does not belong to the same company as the product')
      }

      // Get cost price from most recent inventory batch for financial loss calculation
      const latestBatch = await tx.inventoryBatch.findFirst({
        where: { productId: validatedData.productId },
        orderBy: { dateReceived: 'desc' },
      })

      const costPricePerUnit = latestBatch ? latestBatch.purchasePricePerUnit : 0
      const financialLoss = costPricePerUnit * validatedData.quantityLost

      // Create shrinkage record
      const shrinkage = await tx.shrinkage.create({
        data: {
          productId: validatedData.productId,
          quantityLost: validatedData.quantityLost,
          reason: validatedData.reason,
          branchId: validatedData.branchId,
        },
        include: {
          product: true,
          branch: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      })

      // Decrement product stock
      await tx.product.update({
        where: { id: validatedData.productId },
        data: {
          currentStockLevel: {
            decrement: validatedData.quantityLost,
          },
        },
      })

      return {
        ...shrinkage,
        financialLoss: Math.round(financialLoss * 100) / 100,
      }
    })

    // Audit log
    const reqInfo = getRequestInfo(request)
    logAudit({
      action: 'SHRINKAGE_RECORDED',
      userId: auth.user.id,
      userEmail: auth.user.email,
      companyId: auth.user.companyId,
      branchId: validatedData.branchId,
      details: `Shrinkage recorded: ${validatedData.quantityLost} units of product ${validatedData.productId}, reason: ${validatedData.reason}`,
      ...reqInfo,
    })

    return NextResponse.json({ success: true, data: result }, { status: 201 })
  } catch (error) {
    console.error('Shrinkage POST error:', error)
    if (error instanceof Error) {
      if (error.message === 'Product not found') {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 404 }
        )
      }
      if (error.message === 'Branch not found') {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 404 }
        )
      }
      if (error.message.startsWith('Insufficient stock')) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 400 }
        )
      }
      if (error.message.includes('does not belong to')) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 400 }
        )
      }
    }
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
