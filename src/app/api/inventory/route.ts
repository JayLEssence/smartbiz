import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')

    const where: Record<string, unknown> = {}
    if (productId) {
      where.productId = productId
    }

    const batches = await db.inventoryBatch.findMany({
      where,
      include: {
        product: true,
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
    const { productId, quantityAdded, purchasePricePerUnit, supplier } = body

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

      // Create the inventory batch
      const batch = await tx.inventoryBatch.create({
        data: {
          productId,
          quantityAdded: Number(quantityAdded),
          purchasePricePerUnit: Number(purchasePricePerUnit),
          supplier: supplier || null,
        },
        include: {
          product: true,
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
    if (error instanceof Error && error.message === 'Product not found') {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
