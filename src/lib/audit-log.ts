// ============================================
// AUDIT LOGGING SYSTEM
// ============================================

export type AuditAction =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGIN_LOCKED'
  | 'LOGOUT'
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DEACTIVATED'
  | 'USER_ROLE_CHANGED'
  | 'PASSWORD_CHANGED'
  | 'COMPANY_CREATED'
  | 'COMPANY_UPDATED'
  | 'COMPANY_DEACTIVATED'
  | 'BRANCH_CREATED'
  | 'BRANCH_UPDATED'
  | 'BRANCH_DEACTIVATED'
  | 'PRODUCT_CREATED'
  | 'PRODUCT_UPDATED'
  | 'PRODUCT_DELETED'
  | 'SALE_CREATED'
  | 'INVENTORY_ADDED'
  | 'SHRINKAGE_RECORDED'
  | 'EXPENSE_CREATED'
  | 'EXPENSE_UPDATED'
  | 'EXPENSE_DELETED'
  | 'SUPPLIER_CREATED'
  | 'SUPPLIER_UPDATED'
  | 'SUPPLIER_DELETED'
  | 'CUSTOMER_CREATED'
  | 'CUSTOMER_UPDATED'
  | 'CUSTOMER_DELETED'
  | 'NOTIFICATION_READ'
  | 'RATE_LIMIT_HIT'
  | 'SUSPICIOUS_ACTIVITY'

export interface AuditLogEntry {
  action: AuditAction
  userId?: string
  userEmail?: string
  companyId?: string
  branchId?: string
  details?: string
  ipAddress?: string
  userAgent?: string
  timestamp: Date
}

// In-memory audit log (for quick access - could be moved to DB)
const auditLogs: AuditLogEntry[] = []
const MAX_LOG_ENTRIES = 10000

function trimLogs() {
  if (auditLogs.length > MAX_LOG_ENTRIES) {
    auditLogs.splice(0, auditLogs.length - MAX_LOG_ENTRIES)
  }
}

export function logAudit(entry: Omit<AuditLogEntry, 'timestamp'>): void {
  const logEntry: AuditLogEntry = {
    ...entry,
    timestamp: new Date(),
  }
  auditLogs.push(logEntry)
  trimLogs()

  // Also log to console in development
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[AUDIT] ${logEntry.action} - ${logEntry.userEmail || 'anonymous'} - ${logEntry.details || ''}`)
  }
}

export function getAuditLogs(filters?: {
  companyId?: string
  userId?: string
  action?: AuditAction
  limit?: number
  offset?: number
}): { logs: AuditLogEntry[]; total: number } {
  let filtered = [...auditLogs]

  if (filters?.companyId) {
    filtered = filtered.filter(l => l.companyId === filters.companyId)
  }
  if (filters?.userId) {
    filtered = filtered.filter(l => l.userId === filters.userId)
  }
  if (filters?.action) {
    filtered = filtered.filter(l => l.action === filters.action)
  }

  // Sort by timestamp descending
  filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

  const total = filtered.length
  const offset = filters?.offset || 0
  const limit = filters?.limit || 50

  return {
    logs: filtered.slice(offset, offset + limit),
    total,
  }
}

export function getSecuritySummary(companyId: string): {
  totalLogins: number
  failedLogins: number
  lockedAccounts: number
  recentActions: AuditLogEntry[]
  suspiciousActivities: AuditLogEntry[]
} {
  const companyLogs = auditLogs.filter(l => l.companyId === companyId)
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const recentLogs = companyLogs.filter(l => l.timestamp > last24h)

  return {
    totalLogins: recentLogs.filter(l => l.action === 'LOGIN_SUCCESS').length,
    failedLogins: recentLogs.filter(l => l.action === 'LOGIN_FAILED').length,
    lockedAccounts: recentLogs.filter(l => l.action === 'LOGIN_LOCKED').length,
    recentActions: recentLogs.slice(0, 20),
    suspiciousActivities: recentLogs.filter(l =>
      l.action === 'SUSPICIOUS_ACTIVITY' ||
      l.action === 'RATE_LIMIT_HIT' ||
      l.action === 'LOGIN_LOCKED'
    ),
  }
}

// Extract request info for audit logging
export function getRequestInfo(request: Request): {
  ipAddress: string
  userAgent: string
} {
  return {
    ipAddress:
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      request.headers.get('cf-connecting-ip') ||
      'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
  }
}
