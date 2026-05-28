'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/stores/app-store'
import { useLanguage } from '@/lib/i18n/language-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Shield, ShieldCheck, ShieldAlert, Key, Eye, EyeOff, Loader2,
  Activity, Lock, AlertTriangle, CheckCircle2, Clock, MapPin,
  MonitorSmartphone, TrendingUp, ArrowRight, RefreshCw, Download,
  UserCheck, UserX, LogIn, FileText, Package,
  XCircle, Fingerprint, Globe, Trash2
} from 'lucide-react'
import { toast } from 'sonner'

interface SecurityScore {
  score: number
  grade: string
  recommendations: string[]
  checklist: {
    label: string
    points: number
    achieved: boolean
    description: string
  }[]
}

interface AuditEntry {
  action: string
  userId?: string
  userEmail?: string
  companyId?: string
  details?: string
  ipAddress?: string
  userAgent?: string
  timestamp: string
  severity?: string
}

interface SecuritySummary {
  totalLogins: number
  failedLogins: number
  lockedAccounts: number
  recentActions: AuditEntry[]
  suspiciousActivities: AuditEntry[]
}

interface SessionInfo {
  id: string
  deviceInfo: string
  ipAddress: string
  createdAt: string
  expiresAt: string
  isCurrent: boolean
}

interface SecurityData {
  summary: SecuritySummary
  userInfo: {
    twoFactorEnabled: boolean
    mustChangePassword: boolean
    passwordChangedAt: string | null
    lastLoginAt: string | null
    lastLoginIp: string | null
    failedLoginAttempts: number
  }
  activeUsersCount: number
  securityScore: SecurityScore
}

const actionIcons: Record<string, React.ReactNode> = {
  LOGIN_SUCCESS: <LogIn className="h-3.5 w-3.5 text-emerald-500" />,
  LOGIN_FAILED: <LogIn className="h-3.5 w-3.5 text-red-500" />,
  LOGIN_LOCKED: <Lock className="h-3.5 w-3.5 text-red-600" />,
  USER_CREATED: <UserCheck className="h-3.5 w-3.5 text-blue-500" />,
  USER_UPDATED: <UserCheck className="h-3.5 w-3.5 text-blue-500" />,
  USER_DEACTIVATED: <UserX className="h-3.5 w-3.5 text-red-500" />,
  USER_ROLE_CHANGED: <Shield className="h-3.5 w-3.5 text-orange-500" />,
  PASSWORD_CHANGED: <Key className="h-3.5 w-3.5 text-emerald-500" />,
  PRODUCT_CREATED: <Package className="h-3.5 w-3.5 text-blue-500" />,
  SALE_CREATED: <FileText className="h-3.5 w-3.5 text-emerald-500" />,
  SUSPICIOUS_ACTIVITY: <AlertTriangle className="h-3.5 w-3.5 text-red-600" />,
  RATE_LIMIT_HIT: <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />,
}

function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    LOGIN_SUCCESS: 'Successful Login',
    LOGIN_FAILED: 'Failed Login',
    LOGIN_LOCKED: 'Account Locked',
    LOGOUT: 'Logged Out',
    USER_CREATED: 'User Created',
    USER_UPDATED: 'User Updated',
    USER_DEACTIVATED: 'User Deactivated',
    USER_ROLE_CHANGED: 'Role Changed',
    PASSWORD_CHANGED: 'Password Changed',
    COMPANY_CREATED: 'Company Created',
    COMPANY_UPDATED: 'Company Updated',
    BRANCH_CREATED: 'Branch Created',
    BRANCH_UPDATED: 'Branch Updated',
    PRODUCT_CREATED: 'Product Created',
    PRODUCT_UPDATED: 'Product Updated',
    PRODUCT_DELETED: 'Product Deleted',
    SALE_CREATED: 'Sale Recorded',
    INVENTORY_ADDED: 'Stock Added',
    SHRINKAGE_RECORDED: 'Loss Recorded',
    EXPENSE_CREATED: 'Expense Added',
    SUPPLIER_CREATED: 'Supplier Added',
    CUSTOMER_CREATED: 'Customer Added',
    SUSPICIOUS_ACTIVITY: 'Suspicious Activity',
    RATE_LIMIT_HIT: 'Rate Limit Hit',
  }
  return labels[action] || action
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function parseDeviceInfo(deviceInfo: string): { browser: string; os: string; device: string } {
  if (!deviceInfo || deviceInfo === 'Unknown device') {
    return { browser: 'Unknown', os: 'Unknown', device: 'Unknown' }
  }

  let browser = 'Unknown'
  let os = 'Unknown'
  const device = 'Desktop'

  if (deviceInfo.includes('Chrome') && !deviceInfo.includes('Edg')) browser = 'Chrome'
  else if (deviceInfo.includes('Firefox')) browser = 'Firefox'
  else if (deviceInfo.includes('Safari') && !deviceInfo.includes('Chrome')) browser = 'Safari'
  else if (deviceInfo.includes('Edg')) browser = 'Edge'

  if (deviceInfo.includes('Windows')) os = 'Windows'
  else if (deviceInfo.includes('Mac')) os = 'macOS'
  else if (deviceInfo.includes('Linux')) os = 'Linux'
  else if (deviceInfo.includes('Android')) os = 'Android'
  else if (deviceInfo.includes('iPhone') || deviceInfo.includes('iPad')) os = 'iOS'

  return { browser, os, device }
}

export function SecurityView() {
  const { currentUser, authToken } = useAppStore()
  const { t } = useLanguage()

  const [securityData, setSecurityData] = useState<SecurityData | null>(null)
  const [activityLog, setActivityLog] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [activityLoading, setActivityLoading] = useState(false)

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  // 2FA state
  const [show2faDialog, setShow2faDialog] = useState(false)
  const [twoFaPin, setTwoFaPin] = useState('')
  const [twoFaConfirmPin, setTwoFaConfirmPin] = useState('')
  const [toggling2fa, setToggling2fa] = useState(false)

  // Sessions state
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [revokingSessions, setRevokingSessions] = useState(false)

  // Password strength
  const [pwStrength, setPwStrength] = useState({ score: -1, label: '', feedback: [] as string[] })
  useEffect(() => {
    if (!newPassword) { setPwStrength({ score: -1, label: '', feedback: [] }); return }
    let score = 0
    const feedback: string[] = []
    if (newPassword.length >= 8) score++; else feedback.push('8+ chars')
    if (newPassword.length >= 12) score++
    if (/[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword)) score++; else feedback.push('Mix cases')
    if (/\d/.test(newPassword)) score++; else feedback.push('Add numbers')
    if (/[^a-zA-Z0-9]/.test(newPassword)) score++; else feedback.push('Add symbols')
    const labels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong']
    setPwStrength({ score: Math.min(score, 4), label: labels[Math.min(score, 4)], feedback })
  }, [newPassword])

  const fetchSecurityData = async () => {
    try {
      const res = await fetch('/api/auth/security', {
        headers: { 'Authorization': `Bearer ${authToken}` },
      })
      const json = await res.json()
      if (json.success) {
        setSecurityData(json.data)
      }
    } catch {
      // ignore
    }
  }

  const fetchActivityLog = async () => {
    setActivityLoading(true)
    try {
      const res = await fetch('/api/auth/activity?limit=30', {
        headers: { 'Authorization': `Bearer ${authToken}` },
      })
      const json = await res.json()
      if (json.success) {
        setActivityLog(json.data)
      }
    } catch {
      // ignore
    } finally {
      setActivityLoading(false)
    }
  }

  const fetchSessions = async () => {
    setSessionsLoading(true)
    try {
      const res = await fetch('/api/auth/sessions', {
        headers: { 'Authorization': `Bearer ${authToken}` },
      })
      const json = await res.json()
      if (json.success) {
        setSessions(json.data)
      }
    } catch {
      // ignore
    } finally {
      setSessionsLoading(false)
    }
  }

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await Promise.all([fetchSecurityData(), fetchActivityLog(), fetchSessions()])
      setLoading(false)
    }
    init()
  }, [authToken])

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill in all password fields')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match')
      return
    }
    if (pwStrength.score < 2) {
      toast.error('Password is too weak. Use a stronger password.')
      return
    }

    setChangingPassword(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Password changed successfully')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        await fetchSecurityData()
      } else {
        toast.error(json.error || 'Failed to change password')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setChangingPassword(false)
    }
  }

  const handleEnable2fa = async () => {
    if (!twoFaPin || !/^\d{4}$/.test(twoFaPin)) {
      toast.error('Please enter a valid 4-digit PIN')
      return
    }
    if (twoFaPin !== twoFaConfirmPin) {
      toast.error('PINs do not match')
      return
    }

    setToggling2fa(true)
    try {
      const res = await fetch('/api/auth/2fa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ enabled: true, pin: twoFaPin }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Two-factor authentication enabled successfully!')
        setShow2faDialog(false)
        setTwoFaPin('')
        setTwoFaConfirmPin('')
        await fetchSecurityData()
      } else {
        toast.error(json.error || 'Failed to enable 2FA')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setToggling2fa(false)
    }
  }

  const handleDisable2fa = async () => {
    setToggling2fa(true)
    try {
      const res = await fetch('/api/auth/2fa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ enabled: false }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Two-factor authentication disabled')
        await fetchSecurityData()
      } else {
        toast.error(json.error || 'Failed to disable 2FA')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setToggling2fa(false)
    }
  }

  const handleRevokeAllSessions = async () => {
    setRevokingSessions(true)
    try {
      const res = await fetch('/api/auth/sessions', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` },
      })
      const json = await res.json()
      if (json.success) {
        toast.success(`Revoked ${json.data?.revokedCount || 0} session(s)`)
        await fetchSessions()
      } else {
        toast.error(json.error || 'Failed to revoke sessions')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setRevokingSessions(false)
    }
  }

  const handleExportActivity = () => {
    const csv = [
      'Timestamp,Action,User,Details,IP Address',
      ...activityLog.map(e =>
        `"${new Date(e.timestamp).toISOString()}","${e.action}","${e.userEmail || 'System'}","${(e.details || '').replace(/"/g, '""')}","${e.ipAddress || 'N/A'}"`
      )
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `smartbiz-activity-log-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Activity log exported')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  const score = securityData?.securityScore
  const summary = securityData?.summary
  const userInfo = securityData?.userInfo
  const twoFactorEnabled = userInfo?.twoFactorEnabled || false

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-emerald-600" />
            Security Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor and manage your account security
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { fetchSecurityData(); fetchActivityLog(); fetchSessions() }}
          disabled={activityLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-1.5 ${activityLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Security Score + Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Security Score */}
        <Card className="md:col-span-1">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <div className={`relative flex h-24 w-24 items-center justify-center rounded-full border-4 ${
                score && score.score >= 75 ? 'border-emerald-500' :
                score && score.score >= 50 ? 'border-yellow-500' :
                'border-red-500'
              }`}>
                <div className="text-center">
                  <span className="text-3xl font-bold">{score?.score ?? 0}</span>
                  <span className="text-lg text-muted-foreground">/{100}</span>
                </div>
              </div>
              <div className="mt-3">
                <span className={`text-lg font-bold ${
                  score && score.grade === 'A' ? 'text-emerald-600' :
                  score && score.grade === 'B' ? 'text-emerald-500' :
                  score && score.grade === 'C' ? 'text-yellow-500' :
                  'text-red-500'
                }`}>
                  Grade: {score?.grade ?? 'F'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Security Score</p>
            </div>

            {/* Security Checklist */}
            {score?.checklist && score.checklist.length > 0 && (
              <div className="mt-4 pt-4 border-t w-full">
                <h4 className="text-xs font-medium text-muted-foreground mb-2 text-center">Score Breakdown</h4>
                <div className="space-y-2">
                  {score.checklist.map((item) => (
                    <div key={item.label} className="flex items-start gap-2 text-xs">
                      {item.achieved ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className={item.achieved ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-muted-foreground'}>
                            {item.label}
                          </span>
                          <span className={`font-semibold shrink-0 ml-1 ${item.achieved ? 'text-emerald-600' : 'text-red-400'}`}>
                            +{item.points}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card className="md:col-span-3">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <LogIn className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary?.totalLogins ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Logins (24h)</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary?.failedLogins ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Failed Logins</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
                  <Lock className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary?.lockedAccounts ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Locked Accounts</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <UserCheck className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{securityData?.activeUsersCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Active Users</p>
                </div>
              </div>
            </div>

            {/* Recommendations */}
            {score && score.recommendations.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <h4 className="text-xs font-medium text-muted-foreground mb-2">Recommendations</h4>
                <div className="space-y-1.5">
                  {score.recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <ArrowRight className="h-3 w-3 text-emerald-600 mt-0.5 shrink-0" />
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Key className="h-4 w-4 text-emerald-600" />
              Change Password
            </CardTitle>
            <CardDescription>
              {userInfo?.passwordChangedAt
                ? `Last changed ${formatTimeAgo(userInfo.passwordChangedAt)}`
                : 'Update your password regularly for better security'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="current-pw">Current Password</Label>
              <div className="relative">
                <Input
                  id="current-pw"
                  type={showPasswords ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-pw">New Password</Label>
              <Input
                id="new-pw"
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              {pwStrength.score >= 0 && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[0,1,2,3,4].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-all ${
                        i <= pwStrength.score
                          ? pwStrength.score <= 1 ? 'bg-red-500'
                          : pwStrength.score === 2 ? 'bg-yellow-500'
                          : pwStrength.score === 3 ? 'bg-emerald-500'
                          : 'bg-emerald-600'
                          : 'bg-muted'
                      }`} />
                    ))}
                  </div>
                  <span className={`text-[10px] font-medium ${
                    pwStrength.score <= 1 ? 'text-red-500' :
                    pwStrength.score === 2 ? 'text-yellow-500' : 'text-emerald-500'
                  }`}>{pwStrength.label}</span>
                  {pwStrength.feedback.length > 0 && pwStrength.score < 3 && (
                    <span className="text-[10px] text-muted-foreground ml-2">Need: {pwStrength.feedback.join(' · ')}</span>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-pw">Confirm New Password</Label>
              <Input
                id="confirm-pw"
                type={showPasswords ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {confirmPassword && newPassword && confirmPassword !== newPassword && (
                <p className="text-[10px] text-destructive">Passwords don&apos;t match</p>
              )}
            </div>
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleChangePassword}
              disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
            >
              {changingPassword ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Changing...</>
              ) : (
                <><Key className="h-4 w-4 mr-2" />Change Password</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Two-Factor Authentication */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Fingerprint className="h-4 w-4 text-emerald-600" />
              Two-Factor Authentication
            </CardTitle>
            <CardDescription>
              Add an extra layer of security with a PIN-based second factor
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current 2FA Status */}
            <div className="flex items-center justify-between py-3 px-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  twoFactorEnabled
                    ? 'bg-emerald-100 dark:bg-emerald-900/30'
                    : 'bg-gray-100 dark:bg-gray-900/30'
                }`}>
                  {twoFactorEnabled ? (
                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <ShieldAlert className="h-5 w-5 text-gray-500" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">
                    2FA is {twoFactorEnabled ? 'Enabled' : 'Disabled'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {twoFactorEnabled
                      ? 'Your account has an extra layer of protection'
                      : 'Enable 2FA for enhanced account security'
                    }
                  </p>
                </div>
              </div>
              <Badge variant={twoFactorEnabled ? 'default' : 'secondary'} className={
                twoFactorEnabled
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                  : ''
              }>
                {twoFactorEnabled ? 'Active' : 'Inactive'}
              </Badge>
            </div>

            {/* How it works explanation */}
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-3">
              <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1.5">How PIN-based 2FA Works</h4>
              <ul className="space-y-1 text-xs text-blue-600 dark:text-blue-400">
                <li className="flex items-start gap-1.5">
                  <span className="font-bold shrink-0">1.</span>
                  Set a 4-digit PIN as your second authentication factor
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="font-bold shrink-0">2.</span>
                  On future logins, you&apos;ll enter your PIN after your password
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="font-bold shrink-0">3.</span>
                  Even if your password is compromised, your account stays protected
                </li>
              </ul>
            </div>

            {/* Enable/Disable button */}
            {twoFactorEnabled ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Your account is protected with 2FA. A PIN is required after password login.</span>
                </div>
                <Button
                  variant="outline"
                  className="w-full text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950"
                  onClick={handleDisable2fa}
                  disabled={toggling2fa}
                >
                  {toggling2fa ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Disabling...</>
                  ) : (
                    <><ShieldAlert className="h-4 w-4 mr-2" />Disable 2FA</>
                  )}
                </Button>
              </div>
            ) : (
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => setShow2faDialog(true)}
              >
                <Fingerprint className="h-4 w-4 mr-2" />
                Enable 2FA
              </Button>
            )}

            {/* Security Features List */}
            <div className="pt-2 border-t">
              <h4 className="text-xs font-medium text-muted-foreground mb-2">Active Protections</h4>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Bcrypt Hashing', active: true },
                  { label: 'JWT Auth (24h)', active: true },
                  { label: 'Account Lockout', active: true },
                  { label: 'Rate Limiting', active: true },
                  { label: 'Audit Logging', active: true },
                  { label: 'Tenant Isolation', active: true },
                  { label: 'PIN-based 2FA', active: twoFactorEnabled },
                  { label: 'CSRF Protection', active: true },
                ].map((feature) => (
                  <div key={feature.label} className="flex items-center gap-1.5 text-xs">
                    <CheckCircle2 className={`h-3 w-3 ${feature.active ? 'text-emerald-600' : 'text-gray-300 dark:text-gray-600'}`} />
                    <span className={feature.active ? '' : 'text-muted-foreground'}>{feature.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Account Info + Active Sessions Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Account Security
            </CardTitle>
            <CardDescription>Your current security settings and login info</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b">
                <div className="flex items-center gap-2 text-sm">
                  <MonitorSmartphone className="h-4 w-4 text-muted-foreground" />
                  Last Login
                </div>
                <span className="text-sm font-medium">
                  {userInfo?.lastLoginAt
                    ? new Date(userInfo.lastLoginAt).toLocaleString()
                    : 'N/A'
                  }
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  Last Login IP
                </div>
                <span className="text-sm font-mono">{userInfo?.lastLoginIp || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Password Changed
                </div>
                <span className="text-sm font-medium">
                  {userInfo?.passwordChangedAt
                    ? formatTimeAgo(userInfo.passwordChangedAt)
                    : 'Never'
                  }
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <div className="flex items-center gap-2 text-sm">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  Account Role
                </div>
                <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${
                  currentUser?.role === 'CompanyAdmin' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                  currentUser?.role === 'BranchManager' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                  'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                }`}>
                  {currentUser?.role}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <div className="flex items-center gap-2 text-sm">
                  <Fingerprint className="h-4 w-4 text-muted-foreground" />
                  Two-Factor Auth
                </div>
                <span className={`text-sm font-medium ${
                  twoFactorEnabled ? 'text-emerald-600' : 'text-orange-600'
                }`}>
                  {twoFactorEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2 text-sm">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  Failed Attempts
                </div>
                <span className={`text-sm font-medium ${
                  (userInfo?.failedLoginAttempts ?? 0) > 0 ? 'text-orange-600' : 'text-emerald-600'
                }`}>
                  {userInfo?.failedLoginAttempts ?? 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Sessions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="h-4 w-4 text-emerald-600" />
                  Active Sessions
                </CardTitle>
                <CardDescription>Devices and browsers where you&apos;re currently logged in</CardDescription>
              </div>
              {sessions.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRevokeAllSessions}
                  disabled={revokingSessions}
                  className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950"
                >
                  {revokingSessions ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                  )}
                  Revoke Others
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {sessionsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Globe className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No active sessions found</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {sessions.map((session) => {
                  const parsed = parseDeviceInfo(session.deviceInfo)
                  return (
                    <div
                      key={session.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                        session.isCurrent
                          ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20'
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${
                        session.isCurrent
                          ? 'bg-emerald-100 dark:bg-emerald-900/30'
                          : 'bg-gray-100 dark:bg-gray-900/30'
                      }`}>
                        <MonitorSmartphone className={`h-4 w-4 ${
                          session.isCurrent ? 'text-emerald-600' : 'text-gray-500'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {parsed.browser} on {parsed.os}
                          </span>
                          {session.isCurrent && (
                            <Badge className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">
                              Current
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {session.ipAddress}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTimeAgo(session.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity Log */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-600" />
                Activity Log
              </CardTitle>
              <CardDescription>Recent security events and account activity</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportActivity}>
              <Download className="h-4 w-4 mr-1.5" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {activityLog.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No activity recorded yet</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {activityLog.map((entry, i) => (
                <div key={i} className={`flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors ${
                  entry.severity === 'critical' ? 'bg-red-50 dark:bg-red-950/20' :
                  entry.severity === 'warning' ? 'bg-orange-50 dark:bg-orange-950/20' : ''
                }`}>
                  <div className="mt-0.5">
                    {actionIcons[entry.action] || <Activity className="h-3.5 w-3.5 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{getActionLabel(entry.action)}</span>
                      {entry.severity === 'warning' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">Warning</span>
                      )}
                      {entry.severity === 'critical' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Critical</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {entry.details || 'No details'}
                      {entry.userEmail && entry.userEmail !== currentUser?.email && (
                        <span className="ml-1">by {entry.userEmail}</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-muted-foreground">{formatTimeAgo(entry.timestamp)}</p>
                    {entry.ipAddress && entry.ipAddress !== 'unknown' && (
                      <p className="text-[10px] text-muted-foreground font-mono">{entry.ipAddress}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2FA Setup Dialog */}
      <Dialog open={show2faDialog} onOpenChange={setShow2faDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Fingerprint className="h-5 w-5 text-emerald-600" />
              Enable Two-Factor Authentication
            </DialogTitle>
            <DialogDescription>
              Set a 4-digit PIN as your second authentication factor
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Info banner */}
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-3">
              <p className="text-xs text-blue-700 dark:text-blue-400">
                When 2FA is enabled, you&apos;ll need to enter this PIN after your password on future logins. 
                Make sure to remember it — you won&apos;t be able to log in without it.
              </p>
            </div>

            {/* PIN input */}
            <div className="space-y-2">
              <Label htmlFor="2fa-pin">Enter 4-Digit PIN</Label>
              <Input
                id="2fa-pin"
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="• • • •"
                value={twoFaPin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 4)
                  setTwoFaPin(val)
                }}
                className="text-center text-2xl tracking-[0.5em] font-mono h-14"
              />
              {twoFaPin.length > 0 && twoFaPin.length < 4 && (
                <p className="text-[10px] text-orange-500">{4 - twoFaPin.length} more digit(s) needed</p>
              )}
            </div>

            {/* Confirm PIN */}
            <div className="space-y-2">
              <Label htmlFor="2fa-confirm-pin">Confirm PIN</Label>
              <Input
                id="2fa-confirm-pin"
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="• • • •"
                value={twoFaConfirmPin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 4)
                  setTwoFaConfirmPin(val)
                }}
                className="text-center text-2xl tracking-[0.5em] font-mono h-14"
              />
              {twoFaConfirmPin.length > 0 && twoFaPin !== twoFaConfirmPin && (
                <p className="text-[10px] text-destructive">PINs don&apos;t match</p>
              )}
              {twoFaPin.length === 4 && twoFaConfirmPin.length === 4 && twoFaPin === twoFaConfirmPin && (
                <p className="text-[10px] text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> PINs match
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setShow2faDialog(false); setTwoFaPin(''); setTwoFaConfirmPin('') }}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleEnable2fa}
              disabled={toggling2fa || twoFaPin.length !== 4 || twoFaPin !== twoFaConfirmPin}
            >
              {toggling2fa ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enabling...</>
              ) : (
                <><Fingerprint className="h-4 w-4 mr-2" />Enable 2FA</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
