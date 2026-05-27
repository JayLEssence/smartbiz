import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import ZAI from 'z-ai-web-dev-sdk'
import { authenticateRequest, isCompanyAdmin } from '@/lib/auth'
import { logAudit, getRequestInfo } from '@/lib/audit-log'

interface Recommendation {
  type: 'reorder' | 'pricing' | 'discount' | 'general'
  priority: 'high' | 'medium' | 'low'
  productName: string
  recommendation: string
  suggestedAction: string
}

function generateRuleBasedRecommendations(
  lowStockProducts: { id: string; name: string; sku: string; category: string; currentStockLevel: number; reorderThreshold: number; defaultSalePrice: number }[],
  deadStockItems: { productId: string; productName: string; currentStockLevel: number; daysSinceLastSale: number | null }[],
  salesVelocity: { productId: string; productName: string; unitsPerWeek: number }[]
): Recommendation[] {
  const recommendations: Recommendation[] = []

  // Low stock recommendations
  for (const product of lowStockProducts) {
    const velocity = salesVelocity.find((v) => v.productId === product.id)
    const urgency = product.currentStockLevel === 0 ? 'high' : 'medium'
    recommendations.push({
      type: 'reorder',
      priority: urgency,
      productName: product.name,
      recommendation: `${product.name} is ${product.currentStockLevel === 0 ? 'out of stock' : 'below reorder threshold'}. Current stock: ${product.currentStockLevel}, Reorder point: ${product.reorderThreshold}.`,
      suggestedAction: product.currentStockLevel === 0
        ? `Reorder ${product.name} immediately. Suggested quantity: ${Math.max(product.reorderThreshold * 3, velocity ? Math.ceil(velocity.unitsPerWeek * 4) : product.reorderThreshold * 2)} units.`
        : `Place a reorder for ${product.name}. Suggested quantity: ${velocity ? Math.ceil(velocity.unitsPerWeek * 2) : product.reorderThreshold * 2} units.`,
    })
  }

  // Dead stock discount recommendations
  for (const item of deadStockItems) {
    const daysSince = item.daysSinceLastSale ?? 999
    if (daysSince > 30) {
      recommendations.push({
        type: 'discount',
        priority: daysSince > 60 ? 'high' : 'medium',
        productName: item.productName,
        recommendation: `${item.productName} has ${item.currentStockLevel} units in stock with no sales in ${daysSince} days. This is tying up capital and shelf space.`,
        suggestedAction: `Consider a clearance discount of 20-40% on ${item.productName} to move dead stock and free up capital.`,
      })
    }
  }

  // Pricing recommendations based on velocity
  for (const vel of salesVelocity) {
    if (vel.unitsPerWeek > 20) {
      recommendations.push({
        type: 'pricing',
        priority: 'low',
        productName: vel.productName,
        recommendation: `${vel.productName} is selling ${vel.unitsPerWeek.toFixed(1)} units per week — a strong performer.`,
        suggestedAction: `Consider a slight price increase (5-10%) on ${vel.productName} to maximize margin while demand is high.`,
      })
    }
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  return recommendations
}

export async function GET(request: Request) {
  try {
    // Authenticate the request
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    // Only admins can access the AI advisor
    if (!isCompanyAdmin(auth.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions. Only company admins can access the AI advisor.' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)

    // SECURITY: Always use the authenticated user's companyId — never trust client-provided companyId
    const companyId = auth.user.companyId

    // Admins can optionally filter by branch
    const branchId = searchParams.get('branchId') || undefined

    // Audit log for sensitive AI advisor access
    const reqInfo = getRequestInfo(request)
    logAudit({
      action: 'SUSPICIOUS_ACTIVITY' as never,
      userId: auth.user.id,
      userEmail: auth.user.email,
      companyId: auth.user.companyId,
      branchId: auth.user.branchId,
      details: `AI Advisor recommendations accessed, branchId=${branchId || 'all'}`,
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    })

    // Build filters
    const branchFilter = branchId ? { branchId } : {}
    const companyFilter = { companyId }
    const combinedFilter = { ...branchFilter, ...companyFilter }

    // Gather business data
    const lowStockProducts = await db.product.findMany({
      where: {
        ...combinedFilter,
        isActive: true,
      },
    })
    const lowStock = lowStockProducts.filter(
      (p) => p.currentStockLevel <= p.reorderThreshold
    )

    // Sales velocity - units sold per week over last 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const saleWhere: Prisma.SaleWhereInput = {
      saleDate: { gte: thirtyDaysAgo },
      companyId,
    }
    if (branchId) {
      saleWhere.branchId = branchId
    }

    const recentSaleItems = await db.saleItem.findMany({
      where: {
        sale: saleWhere,
      },
      include: {
        product: true,
      },
    })

    const velocityMap: Record<string, { productId: string; productName: string; totalSold: number }> = {}
    for (const item of recentSaleItems) {
      if (!velocityMap[item.productId]) {
        velocityMap[item.productId] = {
          productId: item.productId,
          productName: item.product.name,
          totalSold: 0,
        }
      }
      velocityMap[item.productId].totalSold += item.quantitySold
    }

    const salesVelocity = Object.values(velocityMap).map((v) => ({
      ...v,
      unitsPerWeek: v.totalSold / 4.3, // 30 days ≈ 4.3 weeks
    }))

    // Dead stock - products with stock but no sales in last 45 days
    const productsWithStock = lowStockProducts.filter((p) => p.currentStockLevel > 0)
    const deadStockItems: { productId: string; productName: string; currentStockLevel: number; daysSinceLastSale: number | null }[] = []

    for (const product of productsWithStock) {
      const saleItemWhere: Prisma.SaleItemWhereInput = {
        productId: product.id,
      }
      const saleSubWhere: Prisma.SaleWhereInput = { companyId }
      if (branchId) {
        saleSubWhere.branchId = branchId
      }
      if (Object.keys(saleSubWhere).length > 0) {
        saleItemWhere.sale = saleSubWhere
      }

      const lastSale = await db.saleItem.findFirst({
        where: saleItemWhere,
        include: { sale: true },
        orderBy: { sale: { saleDate: 'desc' } },
      })

      const lastSaleDate = lastSale ? lastSale.sale.saleDate : null
      const daysSinceLastSale = lastSaleDate
        ? Math.floor((Date.now() - new Date(lastSaleDate).getTime()) / (1000 * 60 * 60 * 24))
        : null

      if (!lastSaleDate || (daysSinceLastSale !== null && daysSinceLastSale >= 45)) {
        deadStockItems.push({
          productId: product.id,
          productName: product.name,
          currentStockLevel: product.currentStockLevel,
          daysSinceLastSale,
        })
      }
    }

    // Build the data summary for LLM
    const dataSummary = {
      lowStockProducts: lowStock.map((p) => ({
        name: p.name,
        sku: p.sku,
        currentStock: p.currentStockLevel,
        reorderThreshold: p.reorderThreshold,
      })),
      salesVelocity: salesVelocity.map((v) => ({
        productName: v.productName,
        unitsPerWeek: Math.round(v.unitsPerWeek * 10) / 10,
      })),
      deadStockItems: deadStockItems.map((d) => ({
        productName: d.productName,
        currentStock: d.currentStockLevel,
        daysSinceLastSale: d.daysSinceLastSale,
      })),
      branchId: branchId || 'all',
    }

    // Try LLM-powered recommendations
    try {
      const zai = await ZAI.create()
      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: 'assistant',
            content: `You are a Smart Business Advisor for a retail shop. Analyze the provided business data and generate actionable recommendations. Each recommendation must have:
- type: one of 'reorder', 'pricing', 'discount', 'general'
- priority: one of 'high', 'medium', 'low'
- productName: the specific product name
- recommendation: a clear explanation of the issue/opportunity
- suggestedAction: a specific actionable step to take

Return ONLY a JSON array of recommendation objects, no other text. Example:
[{"type":"reorder","priority":"high","productName":"Widget A","recommendation":"Stock is critically low","suggestedAction":"Reorder 50 units immediately"}]`,
          },
          {
            role: 'user',
            content: `Based on this business data, provide actionable recommendations:\n${JSON.stringify(dataSummary, null, 2)}`,
          },
        ],
        thinking: { type: 'disabled' },
      })

      const content = completion.choices?.[0]?.message?.content
      if (content) {
        // Try to parse the LLM response as JSON
        let cleanedContent = content.trim()
        // Remove markdown code fences if present
        if (cleanedContent.startsWith('```')) {
          cleanedContent = cleanedContent.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
        }

        const llmRecommendations: Recommendation[] = JSON.parse(cleanedContent)

        // Validate the structure
        const validTypes = ['reorder', 'pricing', 'discount', 'general']
        const validPriorities = ['high', 'medium', 'low']
        const validated = llmRecommendations.filter(
          (r) =>
            r &&
            validTypes.includes(r.type) &&
            validPriorities.includes(r.priority) &&
            r.productName &&
            r.recommendation &&
            r.suggestedAction
        )

        if (validated.length > 0) {
          return NextResponse.json({
            success: true,
            data: validated,
          })
        }
      }
    } catch (llmError) {
      console.error('LLM recommendations failed, falling back to rule-based:', llmError)
    }

    // Fallback: rule-based recommendations
    const recommendations = generateRuleBasedRecommendations(
      lowStock,
      deadStockItems,
      salesVelocity
    )

    return NextResponse.json({
      success: true,
      data: recommendations,
    })
  } catch (error) {
    console.error('Advisor recommendations GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
