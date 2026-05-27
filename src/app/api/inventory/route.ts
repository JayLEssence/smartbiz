import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { authenticateRequest, isManagerOrAbove } from '@/lib/auth'
import { safeValidate, inventoryBatchSchema, sanitizeString } from '@/lib/validation'
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
    const productId = searchParams.get('productId')
    const branchId = searchParams.get('branchId')

    const where: Prisma.InventoryBatchWhereInput = {}

    // Tenant isolation: always filter by authenticated user's companyId
    where.branch = { companyId: auth.user.companyId }

    if (productId) {
      where.productId = productId
    }

    // Branch-based access control
    if (auth.user.role !== 'CompanyAdmin') {
      // Employees and managers can only see inventory for their own branch
      if (branchId && branchId !== auth.user.branchId) {
        return NextResponse.json(
          { success: false, error: 'You can only view inventory for your assigned branch' },
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

    const batches = await db.inventoryBatch.findMany({
      where,
      include: {
        product: true,
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
            companyId: true,
            company: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { dateReceived: 'desc' },
    })

    return NextResponse.json({ success: true, data: batches })
  } catch (error) {
    console.error('Inventory GET error:', error)
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
        { success: false, error: 'Only managers and admins can add inventory' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { productId, quantityAdded, purchasePricePerUnit, supplier, supplierName, branchId } = body

    // Sanitize string inputs
    const sanitizedBody = {
      productId,
      quantityAdded,
      purchasePricePerUnit,
      supplierId: body.supplierId,
      branchId,
      supplierName: supplierName ? sanitizeString(String(supplierName)) : supplierName,
    }

    // Validate input with Zod schema
    const validation = safeValidate(inventoryBatchSchema, sanitizedBody)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.errors },
        { status: 400 }
      )
    }

    const validatedData = validation.data

    // Non-admin users can only add inventory to their own branch
    if (auth.user.role !== 'CompanyAdmin' && validatedData.branchId !== auth.user.branchId) {
      return NextResponse.json(
        { success: false, error: 'You can only add inventory for your assigned branch' },
        { status: 403 }
      )
    }

    const result = await db.$transaction(async (tx) => {
      // Verify product exists and belongs to user's company
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

      // Use the product's branchId if branchId not provided
      const batchBranchId = validatedData.branchId || product.branchId

      // Validate product branch belongs to the same company
      const batchBranch = await tx.branch.findUnique({
        where: { id: batchBranchId },
      })

      if (!batchBranch) {
        throw new Error('Branch not found')
      }

      if (batchBranch.companyId !== auth.user.companyId) {
        throw new Error('Branch does not belong to your company')
      }

      if (batchBranch.companyId !== product.companyId) {
        throw new Error('Product does not belong to the same company as the branch')
      }

      // Create the inventory batch
      const batch = await tx.inventoryBatch.create({
        data: {
          productId: validatedData.productId,
          quantityAdded: validatedData.quantityAdded,
          purchasePricePerUnit: validatedData.purchasePricePerUnit,
          supplier: supplier ? sanitizeString(String(supplier)) : null,
          branchId: batchBranchId,
        },
        include: {
          product: true,
          branch: {
            select: {
              id: true,
              name: true,
              code: true,
              company: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      })

      // Increment the product's current stock level
      await tx.product.update({
        where: { id: validatedData.productId },
        data: {
          currentStockLevel: {
            increment: validatedData.quantityAdded,
          },
        },
      })

      return batch
    })

    // Audit log
    const reqInfo = getRequestInfo(request)
    logAudit({
      action: 'INVENTORY_ADDED',
      userId: auth.user.id,
      userEmail: auth.user.email,
      companyId: auth.user.companyId,
      branchId: validatedData.branchId,
      details: `Inventory batch added: ${validatedData.quantityAdded} units of product ${validatedData.productId}`,
      ...reqInfo,
    })

    return NextResponse.json({ success: true, data: result }, { status: 201 })
  } catch (error) {
    console.error('Inventory POST error:', error)
    if (error instanceof Error) {
      if (error.message === 'Product not found') {
        return NextResponse.json(
          { success: false, error: 'Product not found' },
          { status: 404 }
        )
      }
      if (error.message === 'Branch not found') {
        return NextResponse.json(
          { success: false, error: 'Branch not found' },
          { status: 404 }
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
