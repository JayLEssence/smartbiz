import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { authenticateRequest, isManagerOrAbove } from '@/lib/auth'
import { safeValidate, saleCreateSchema, sanitizeString } from '@/lib/validation'
import { logAudit, getRequestInfo } from '@/lib/audit-log'

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

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const userId = searchParams.get('userId')
    const branchId = searchParams.get('branchId')

    // ALWAYS filter by authenticated user's companyId (tenant isolation)
    const companyId = auth.user.companyId

    const where: Prisma.SaleWhereInput = {
      companyId, // Enforce tenant isolation
    }

    if (from || to) {
      where.saleDate = {}
      if (from) {
        where.saleDate.gte = new Date(from)
      }
      if (to) {
        where.saleDate.lte = new Date(to)
      }
    }

    if (userId) {
      where.userId = userId
    }

    if (branchId) {
      where.branchId = branchId
    }

    // Employees can only see sales from their own branch
    if (!isManagerOrAbove(auth.user.role)) {
      where.branchId = auth.user.branchId
    }

    const sales = await db.sale.findMany({
      where,
      include: {
        saleItems: {
          include: {
            product: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
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
          },
        },
      },
      orderBy: { saleDate: 'desc' },
    })

    return NextResponse.json({ success: true, data: sales })
  } catch (error) {
    console.error('Sales GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

const VALID_PAYMENT_METHODS = ['Cash', 'M-Pesa', 'Tigo Pesa', 'Airtel Money', 'Card', 'Credit'] as const
type PaymentMethod = (typeof VALID_PAYMENT_METHODS)[number]

async function generateReceiptNumber(tx: Prisma.TransactionClient): Promise<string> {
  // Get the latest sale with a receipt number to determine next sequential number
  const latestSale = await tx.sale.findFirst({
    where: { receiptNumber: { not: null } },
    orderBy: { createdAt: 'desc' },
    select: { receiptNumber: true },
  })

  let nextNumber = 1
  if (latestSale?.receiptNumber) {
    const match = latestSale.receiptNumber.match(/RCT-(\d+)/)
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1
    }
  }

  return `RCT-${String(nextNumber).padStart(5, '0')}`
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

    const reqInfo = getRequestInfo(request)
    const body = await request.json()

    // Validate input with Zod schema
    const validation = safeValidate(saleCreateSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.errors },
        { status: 400 }
      )
    }

    const validatedData = validation.data

    // CRITICAL: ALWAYS override companyId with authenticated user's companyId (never trust request body)
    const companyId = auth.user.companyId

    // Employees can only create sales for their own branch
    if (!isManagerOrAbove(auth.user.role) && validatedData.branchId !== auth.user.branchId) {
      logAudit({
        action: 'SUSPICIOUS_ACTIVITY',
        userId: auth.user.id,
        userEmail: auth.user.email,
        companyId: auth.user.companyId,
        branchId: auth.user.branchId,
        details: `Employee attempted to create sale for branch ${validatedData.branchId} (not their branch)`,
        ipAddress: reqInfo.ipAddress,
        userAgent: reqInfo.userAgent,
      })
      return NextResponse.json(
        { success: false, error: 'You can only create sales for your own branch' },
        { status: 403 }
      )
    }

    const salePaymentMethod: PaymentMethod = VALID_PAYMENT_METHODS.includes(validatedData.paymentMethod as PaymentMethod)
      ? (validatedData.paymentMethod as PaymentMethod)
      : 'Cash'

    const saleCustomerName = validatedData.customerName
      ? sanitizeString(validatedData.customerName)
      : null

    const result = await db.$transaction(async (tx) => {
      // Verify user exists and get their branch and company
      const user = await tx.user.findUnique({
        where: { id: auth.user!.id },
        include: { branch: true, company: true },
      })
      if (!user) {
        throw new Error('User not found')
      }

      // Use validated branchId (already checked for employees above)
      const saleBranchId = validatedData.branchId || user.branchId

      // Auto-generate receipt number
      const receiptNumber = await generateReceiptNumber(tx)

      let totalAmount = 0
      const saleItemsData: {
        productId: string
        quantitySold: number
        salePricePerUnit: number
        costPricePerUnit: number
      }[] = []

      // Validate all items and prepare data
      for (const item of validatedData.items) {
        const { productId, quantitySold, salePricePerUnit } = item

        if (!productId || !quantitySold || !salePricePerUnit) {
          throw new Error('Each item must have productId, quantitySold, and salePricePerUnit')
        }

        const product = await tx.product.findUnique({
          where: { id: productId },
        })

        if (!product) {
          throw new Error(`Product not found: ${productId}`)
        }

        // Validate product belongs to the same company (tenant isolation)
        if (product.companyId !== companyId) {
          throw new Error(`Product ${product.name} does not belong to the same company`)
        }

        if (product.currentStockLevel < Number(quantitySold)) {
          throw new Error(`Insufficient stock for ${product.name}. Available: ${product.currentStockLevel}, Requested: ${quantitySold}`)
        }

        // Get cost price from most recent inventory batch
        const latestBatch = await tx.inventoryBatch.findFirst({
          where: { productId },
          orderBy: { dateReceived: 'desc' },
        })

        const costPricePerUnit = latestBatch ? latestBatch.purchasePricePerUnit : 0
        const qty = Number(quantitySold)
        const price = Number(salePricePerUnit)

        totalAmount += qty * price
        saleItemsData.push({
          productId,
          quantitySold: qty,
          salePricePerUnit: price,
          costPricePerUnit,
        })
      }

      // Apply discount
      const discountAmount = validatedData.discount ? Number(validatedData.discount) : 0
      totalAmount -= discountAmount

      // Create the sale
      const sale = await tx.sale.create({
        data: {
          userId: auth.user!.id,
          totalAmount,
          discount: discountAmount,
          branchId: saleBranchId,
          companyId, // Use auth-derived companyId, NEVER from request body
          paymentMethod: salePaymentMethod,
          customerName: saleCustomerName,
          receiptNumber,
          saleItems: {
            create: saleItemsData,
          },
        },
        include: {
          saleItems: {
            include: {
              product: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
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

      // Decrement stock for each item sold
      for (const itemData of saleItemsData) {
        await tx.product.update({
          where: { id: itemData.productId },
          data: {
            currentStockLevel: {
              decrement: itemData.quantitySold,
            },
          },
        })
      }

      return sale
    })

    // Audit log for sale creation
    logAudit({
      action: 'SALE_CREATED',
      userId: auth.user.id,
      userEmail: auth.user.email,
      companyId: auth.user.companyId,
      branchId: validatedData.branchId,
      details: `Sale created with receipt ${result.receiptNumber}, total: ${result.totalAmount}`,
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    })

    return NextResponse.json({ success: true, data: result }, { status: 201 })
  } catch (error) {
    console.error('Sales POST error:', error)
    if (error instanceof Error) {
      if (error.message === 'User not found') {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 404 }
        )
      }
      if (error.message.startsWith('Product not found')) {
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
      if (error.message.includes('must have productId')) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 400 }
        )
      }
      if (error.message.includes('does not belong to the same company')) {
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
