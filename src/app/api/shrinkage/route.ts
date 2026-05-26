import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const reason = searchParams.get('reason')

    const where: Prisma.ShrinkageWhereInput = {}

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
      where.reason = reason
    }

    const shrinkages = await db.shrinkage.findMany({
      where,
      include: {
        product: true,
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
    const body = await request.json()
    const { productId, quantityLost, reason } = body

    if (!productId || !quantityLost || !reason) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: productId, quantityLost, reason' },
        { status: 400 }
      )
    }

    const validReasons = ['Stolen', 'Expired', 'Damaged']
    if (!validReasons.includes(reason)) {
      return NextResponse.json(
        { success: false, error: `Invalid reason. Must be one of: ${validReasons.join(', ')}` },
        { status: 400 }
      )
    }

    const result = await db.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
      })

      if (!product) {
        throw new Error('Product not found')
      }

      if (product.currentStockLevel < Number(quantityLost)) {
        throw new Error(`Insufficient stock. Available: ${product.currentStockLevel}, Lost: ${quantityLost}`)
      }

      // Get cost price from most recent inventory batch for financial loss calculation
      const latestBatch = await tx.inventoryBatch.findFirst({
        where: { productId },
        orderBy: { dateReceived: 'desc' },
      })

      const costPricePerUnit = latestBatch ? latestBatch.purchasePricePerUnit : 0
      const financialLoss = costPricePerUnit * Number(quantityLost)

      // Create shrinkage record
      const shrinkage = await tx.shrinkage.create({
        data: {
          productId,
          quantityLost: Number(quantityLost),
          reason,
        },
        include: {
          product: true,
        },
      })

      // Decrement product stock
      await tx.product.update({
        where: { id: productId },
        data: {
          currentStockLevel: {
            decrement: Number(quantityLost),
          },
        },
      })

      return {
        ...shrinkage,
        financialLoss: Math.round(financialLoss * 100) / 100,
      }
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
      if (error.message.startsWith('Insufficient stock')) {
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
