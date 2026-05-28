import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/db'

// ============================================
// SECURITY CONFIGURATION
// ============================================

const JWT_SECRET = process.env.JWT_SECRET || 'smartbiz-super-secret-key-change-in-production-2024'
const JWT_EXPIRES_IN = '24h' // Access token expires in 24 hours
const JWT_REFRESH_EXPIRES_IN = '7d' // Refresh token expires in 7 days
const BCRYPT_SALT_ROUNDS = 12
const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_DURATION_MINUTES = 15

// ============================================
// PASSWORD SECURITY
// ============================================

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function isPasswordHashed(hash: string): boolean {
  return hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')
}

// Password strength checker
export interface PasswordStrength {
  score: number // 0-4
  label: string
  color: string
  feedback: string[]
}

export function checkPasswordStrength(password: string): PasswordStrength {
  const feedback: string[] = []
  let score = 0

  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++

  if (password.length < 8) feedback.push('Use at least 8 characters')
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) feedback.push('Mix uppercase and lowercase')
  if (!/\d/.test(password)) feedback.push('Add numbers')
  if (!/[^a-zA-Z0-9]/.test(password)) feedback.push('Add special characters')

  const labels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong']
  const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500', 'bg-emerald-600']

  return {
    score: Math.min(score, 4),
    label: labels[Math.min(score, 4)],
    color: colors[Math.min(score, 4)],
    feedback,
  }
}

// ============================================
// JWT TOKEN MANAGEMENT
// ============================================

export interface TokenPayload {
  userId: string
  email: string
  role: string
  companyId: string
  branchId: string
  sessionId: string
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'smartbiz',
    audience: 'smartbiz-app',
  })
}

export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET + '-refresh', {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
    issuer: 'smartbiz',
    audience: 'smartbiz-app',
  })
}

export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'smartbiz',
      audience: 'smartbiz-app',
    }) as TokenPayload
    return decoded
  } catch {
    return null
  }
}

export function verifyRefreshToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET + '-refresh', {
      issuer: 'smartbiz',
      audience: 'smartbiz-app',
    }) as TokenPayload
    return decoded
  } catch {
    return null
  }
}

// ============================================
// ACCOUNT LOCKOUT PROTECTION
// ============================================

export async function handleFailedLogin(email: string): Promise<{ locked: boolean; attemptsLeft: number }> {
  const user = await db.user.findUnique({ where: { email } })
  if (!user) return { locked: false, attemptsLeft: MAX_LOGIN_ATTEMPTS }

  const currentAttempts = (user as unknown as Record<string, unknown>).failedLoginAttempts as number || 0
  const newAttempts = currentAttempts + 1

  if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: newAttempts,
        lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000),
      } as never,
    })
    return { locked: true, attemptsLeft: 0 }
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: newAttempts,
    } as never,
  })

  return { locked: false, attemptsLeft: MAX_LOGIN_ATTEMPTS - newAttempts }
}

export async function isAccountLocked(email: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { email } })
  if (!user) return false

  const lockedUntil = (user as unknown as Record<string, unknown>).lockedUntil as Date | null
  if (!lockedUntil) return false

  if (new Date() < new Date(lockedUntil)) return true

  // Lockout expired, reset
  await db.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
    } as never,
  })

  return false
}

export async function resetLoginAttempts(userId: string): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
    } as never,
  })
}

// ============================================
// SESSION & AUTH HELPERS
// ============================================

export function extractTokenFromHeader(request: Request): string | null {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.substring(7)
}

export function extractTokenFromRequest(request: Request): string | null {
  // Try Authorization header first
  const headerToken = extractTokenFromHeader(request)
  if (headerToken) return headerToken

  // Try cookie
  const cookieHeader = request.headers.get('cookie')
  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split(';').map(c => {
        const [key, ...v] = c.trim().split('=')
        return [key, v.join('=')]
      })
    )
    if (cookies['smartbiz_token']) return cookies['smartbiz_token']
  }

  return null
}

export async function authenticateRequest(request: Request): Promise<{
  authenticated: boolean
  user?: {
    id: string
    email: string
    name: string
    role: string
    branchId: string
    companyId: string
  }
  error?: string
}> {
  const token = extractTokenFromRequest(request)
  if (!token) {
    return { authenticated: false, error: 'Authentication required' }
  }

  // Also support legacy base64 tokens for migration
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8')
    if (decoded.startsWith('cl') && decoded.length < 30) {
      // Legacy base64 user ID token - validate user exists
      const user = await db.user.findUnique({
        where: { id: decoded },
        select: { id: true, email: true, name: true, role: true, branchId: true, companyId: true, isActive: true },
      })
      if (user && user.isActive) {
        return { authenticated: true, user: { id: user.id, email: user.email, name: user.name, role: user.role, branchId: user.branchId, companyId: user.companyId } }
      }
    }
  } catch {
    // Not a base64 token, try JWT
  }

  const payload = verifyAccessToken(token)
  if (!payload) {
    return { authenticated: false, error: 'Invalid or expired token' }
  }

  // Verify user still exists and is active
  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, name: true, role: true, branchId: true, companyId: true, isActive: true },
  })

  if (!user || !user.isActive) {
    return { authenticated: false, error: 'User account is deactivated' }
  }

  return {
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      branchId: user.branchId,
      companyId: user.companyId,
    },
  }
}

// ============================================
// AUTHORIZATION HELPERS
// ============================================

export type Role = 'CompanyAdmin' | 'BranchManager' | 'Employee'

export function hasRole(userRole: string, requiredRoles: Role[]): boolean {
  return requiredRoles.includes(userRole as Role)
}

export function isCompanyAdmin(userRole: string): boolean {
  return userRole === 'CompanyAdmin'
}

export function isManagerOrAbove(userRole: string): boolean {
  return userRole === 'CompanyAdmin' || userRole === 'BranchManager'
}

export function canAccessCompany(user: { companyId: string }, targetCompanyId: string): boolean {
  return user.companyId === targetCompanyId
}

export function canAccessBranch(user: { role: string; branchId: string; companyId: string }, targetBranchId: string, branchCompanyId: string): boolean {
  if (user.companyId !== branchCompanyId) return false
  if (user.role === 'CompanyAdmin') return true
  return user.branchId === targetBranchId
}
