import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const userId = searchParams.get('userId')

    const where: Prisma.SaleWhereInput = {}

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

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { userId, items, discount } = body

    if (!userId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: userId, items (non-empty array)' },
        { status: 400 }
      )
    }

    const result = await db.$transaction(async (tx) => {
      // Verify user exists
      const user = await tx.user.findUnique({ where: { id: userId } })
      if (!user) {
        throw new Error('User not found')
      }

      let totalAmount = 0
      const saleItemsData: {
        productId: string
        quantitySold: number
        salePricePerUnit: number
        costPricePerUnit: number
      }[] = []

      // Validate all items and prepare data
      for (const item of items) {
        const { productId, quantity, salePricePerUnit } = item

        if (!productId || !quantity || !salePricePerUnit) {
          throw new Error('Each item must have productId, quantity, and salePricePerUnit')
        }

        const product = await tx.product.findUnique({
          where: { id: productId },
        })

        if (!product) {
          throw new Error(`Product not found: ${productId}`)
        }

        if (product.currentStockLevel < Number(quantity)) {
          throw new Error(`Insufficient stock for ${product.name}. Available: ${product.currentStockLevel}, Requested: ${quantity}`)
        }

        // Get cost price from most recent inventory batch
        const latestBatch = await tx.inventoryBatch.findFirst({
          where: { productId },
          orderBy: { dateReceived: 'desc' },
        })

        const costPricePerUnit = latestBatch ? latestBatch.purchasePricePerUnit : 0
        const qty = Number(quantity)
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
      const discountAmount = discount ? Number(discount) : 0
      totalAmount -= discountAmount

      // Create the sale
      const sale = await tx.sale.create({
        data: {
          userId,
          totalAmount,
          discount: discountAmount,
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
    }
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
