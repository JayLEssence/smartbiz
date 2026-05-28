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

interface SecurityChecklistItem {
  label: string
  points: number
  achieved: boolean
  description: string
}

function calculateSecurityScore(params: {
  twoFactorEnabled: boolean
  passwordChangedAt: Date | null
  failedLogins: number
  lockedAccounts: number
  activeUsersCount: number
}): { score: number; grade: string; recommendations: string[]; checklist: SecurityChecklistItem[] } {
  let score = 50 // Base score
  const recommendations: string[] = []
  const checklist: SecurityChecklistItem[] = []

  // 2FA check (+20 points)
  const twoFactorAchieved = params.twoFactorEnabled
  checklist.push({
    label: 'Two-Factor Authentication',
    points: 20,
    achieved: twoFactorAchieved,
    description: twoFactorAchieved
      ? '2FA is enabled - your account has an extra layer of protection'
      : 'Enable 2FA for an extra layer of security beyond your password',
  })
  if (twoFactorAchieved) {
    score += 20
  } else {
    recommendations.push('Enable two-factor authentication for enhanced security')
  }

  // Password recency check (+10 points)
  let passwordRecent = false
  if (params.passwordChangedAt) {
    const daysSinceChange = (Date.now() - new Date(params.passwordChangedAt).getTime()) / (1000 * 60 * 60 * 24)
    passwordRecent = daysSinceChange < 90
    checklist.push({
      label: 'Password Changed Recently',
      points: 10,
      achieved: passwordRecent,
      description: passwordRecent
        ? `Password changed ${Math.floor(daysSinceChange)} days ago - within the recommended 90-day window`
        : `Password was changed ${Math.floor(daysSinceChange)} days ago - consider updating it`,
    })
    if (passwordRecent) {
      score += 10
    } else {
      recommendations.push('Your password is over 90 days old - consider changing it')
    }
  } else {
    checklist.push({
      label: 'Password Changed Recently',
      points: 10,
      achieved: false,
      description: 'No record of password change - set a strong password for your account',
    })
    recommendations.push('Set a strong password for your account')
  }

  // No failed login attempts check (+10 points)
  const noFailedLogins = params.failedLogins === 0
  checklist.push({
    label: 'No Failed Login Attempts',
    points: 10,
    achieved: noFailedLogins,
    description: noFailedLogins
      ? 'No failed login attempts detected - your account is secure'
      : `${params.failedLogins} failed login attempt(s) detected - review your access logs`,
  })
  if (noFailedLogins) {
    score += 10
  } else if (params.failedLogins > 10) {
    score -= 10
    recommendations.push('High number of failed login attempts detected - review access logs')
  }

  // Account lockout penalty (-5 points per locked account)
  if (params.lockedAccounts > 0) {
    score -= 5
    recommendations.push('Some accounts have been locked due to failed attempts')
  }

  // Multi-user check (+10 points)
  const multiUser = params.activeUsersCount > 1
  checklist.push({
    label: 'Multi-User Accountability',
    points: 10,
    achieved: multiUser,
    description: multiUser
      ? `${params.activeUsersCount} active users - good for audit trails and accountability`
      : 'Add more users for better accountability and audit trails',
  })
  if (multiUser) {
    score += 10
  }

  score = Math.max(0, Math.min(100, score))

  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F'

  return { score, grade, recommendations, checklist }
}
