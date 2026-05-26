import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    const branchId = searchParams.get('branchId')
    const companyId = searchParams.get('companyId')

    const where: Prisma.InventoryBatchWhereInput = {}
    if (productId) {
      where.productId = productId
    }
    if (branchId) {
      where.branchId = branchId
    }
    if (companyId) {
      where.branch = { companyId }
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
    const body = await request.json()
    const { productId, quantityAdded, purchasePricePerUnit, supplier, branchId } = body

    if (!productId || quantityAdded === undefined || purchasePricePerUnit === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: productId, quantityAdded, purchasePricePerUnit' },
        { status: 400 }
      )
    }

    const result = await db.$transaction(async (tx) => {
      // Verify product exists
      const product = await tx.product.findUnique({
        where: { id: productId },
      })

      if (!product) {
        throw new Error('Product not found')
      }

      // Use the product's branchId if branchId not provided
      const batchBranchId = branchId || product.branchId

      // Validate product belongs to the same branch's company
      const batchBranch = await tx.branch.findUnique({
        where: { id: batchBranchId },
      })
      if (batchBranch && batchBranch.companyId !== product.companyId) {
        throw new Error('Product does not belong to the same company as the branch')
      }

      // Create the inventory batch
      const batch = await tx.inventoryBatch.create({
        data: {
          productId,
          quantityAdded: Number(quantityAdded),
          purchasePricePerUnit: Number(purchasePricePerUnit),
          supplier: supplier || null,
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
        where: { id: productId },
        data: {
          currentStockLevel: {
            increment: Number(quantityAdded),
          },
        },
      })

      return batch
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
