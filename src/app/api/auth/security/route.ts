import { NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { getSecuritySummary } from '@/lib/audit-log'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const companyId = auth.user.companyId
    const summary = getSecuritySummary(companyId)

    // Get user security info
    const user = await db.user.findUnique({
      where: { id: auth.user.id },
      select: {
        twoFactorEnabled: true,
        mustChangePassword: true,
        passwordChangedAt: true,
        lastLoginAt: true,
        lastLoginIp: true,
        failedLoginAttempts: true,
      },
    })

    // Count active users in company
    const activeUsersCount = await db.user.count({
      where: { companyId, isActive: true },
    })

    return NextResponse.json({
      success: true,
      data: {
        summary,
        userInfo: user,
        activeUsersCount,
        securityScore: calculateSecurityScore({
          twoFactorEnabled: user?.twoFactorEnabled || false,
          passwordChangedAt: user?.passwordChangedAt,
          failedLogins: summary.failedLogins,
          lockedAccounts: summary.lockedAccounts,
          activeUsersCount,
        }),
      },
    })
  } catch (error) {
    console.error('Security summary error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve security summary' },
      { status: 500 }
    )
  }
}

function calculateSecurityScore(params: {
  twoFactorEnabled: boolean
  passwordChangedAt: Date | null
  failedLogins: number
  lockedAccounts: number
  activeUsersCount: number
}): { score: number; grade: string; recommendations: string[] } {
  let score = 50 // Base score
  const recommendations: string[] = []

  if (params.twoFactorEnabled) {
    score += 20
  } else {
    recommendations.push('Enable two-factor authentication for enhanced security')
  }

  if (params.passwordChangedAt) {
    const daysSinceChange = (Date.now() - new Date(params.passwordChangedAt).getTime()) / (1000 * 60 * 60 * 24)
    if (daysSinceChange < 90) {
      score += 10
    } else {
      recommendations.push('Your password is over 90 days old - consider changing it')
    }
  } else {
    recommendations.push('Set a strong password for your account')
  }

  if (params.failedLogins > 10) {
    score -= 10
    recommendations.push('High number of failed login attempts detected - review access logs')
  }

  if (params.lockedAccounts > 0) {
    score -= 5
    recommendations.push('Some accounts have been locked due to failed attempts')
  }

  if (params.activeUsersCount > 1) {
    score += 10 // Multi-user is good for accountability
  }

  score = Math.max(0, Math.min(100, score))

  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F'

  return { score, grade, recommendations }
}
