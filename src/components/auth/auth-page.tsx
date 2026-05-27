'use client'

import { useState, useCallback, useEffect } from 'react'
import { useAppStore, type CompanyInfo } from '@/stores/app-store'
import { useLanguage } from '@/lib/i18n/language-context'
import { Store, Building2, User, Mail, Lock, Phone, MapPin, Loader2, ArrowRight, CheckCircle2, Users, Hash, ShieldCheck, ShoppingCart, Package, BarChart3, Eye, EyeOff, Shield, AlertTriangle, ChevronDown, Wifi, Bot, Smartphone, Sparkles } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// Password strength checker (matching backend logic)
function checkPasswordStrength(password: string): { score: number; label: string; color: string; feedback: string[] } {
  const feedback: string[] = []
  let score = 0

  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++

  if (password.length < 8) feedback.push('8+ characters')
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) feedback.push('Mix cases')
  if (!/\d/.test(password)) feedback.push('Add numbers')
  if (!/[^a-zA-Z0-9]/.test(password)) feedback.push('Add symbols')

  const labels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong']
  const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500', 'bg-emerald-600']
  const textColors = ['text-red-500', 'text-orange-500', 'text-yellow-500', 'text-emerald-500', 'text-emerald-600']

  return {
    score: password.length === 0 ? -1 : Math.min(score, 4),
    label: labels[Math.min(Math.max(score, 0), 4)],
    color: colors[Math.min(Math.max(score, 0), 4)],
    feedback,
    _textColors: textColors,
  }
}

function PasswordStrengthBar({ password }: { password: string }) {
  const strength = checkPasswordStrength(password)
  if (strength.score < 0) return null

  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i <= strength.score ? strength.color : 'bg-muted'
            }`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-medium ${
          strength.score <= 1 ? 'text-red-500' :
          strength.score === 2 ? 'text-orange-500' :
          strength.score === 3 ? 'text-emerald-500' :
          'text-emerald-600'
        }`}>
          {strength.label}
        </span>
        {strength.feedback.length > 0 && strength.score < 3 && (
          <span className="text-[10px] text-muted-foreground">
            Need: {strength.feedback.join(' · ')}
          </span>
        )}
      </div>
    </div>
  )
}

interface SessionData {
  user: {
    id: string
    email: string
    name: string
    role: string
    branchId: string
    companyId: string
    twoFactorEnabled?: boolean
    mustChangePassword?: boolean
    branch: {
      id: string
      name: string
      code: string
      isHeadOffice: boolean
    }
    company: {
      id: string
      name: string
      industry: string | null
      plan: string
      email: string | null
      phone: string | null
      address: string | null
      logoUrl: string | null
      isActive: boolean
      currency?: string
      currencySymbol?: string
      country?: string
      exchangeRate?: number
    }
  }
  token: string
  refreshToken?: string
}

export function AuthPage() {
  const { t } = useLanguage()
  const { setUser, setCurrentBranchId, setCompany, setAuthenticated, setBranches, setAuthToken } = useAppStore()

  // Login state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [loginAttemptsLeft, setLoginAttemptsLeft] = useState<number | null>(null)

  // Join state
  const [joinName, setJoinName] = useState('')
  const [joinEmail, setJoinEmail] = useState('')
  const [joinPassword, setJoinPassword] = useState('')
  const [joinConfirmPassword, setJoinConfirmPassword] = useState('')
  const [joinBranchCode, setJoinBranchCode] = useState('')
  const [joinLoading, setJoinLoading] = useState(false)
  const [showJoinPassword, setShowJoinPassword] = useState(false)

  // Register state
  const [regCompanyName, setRegCompanyName] = useState('')
  const [regIndustry, setRegIndustry] = useState('')
  const [regCompanyEmail, setRegCompanyEmail] = useState('')
  const [regCompanyPhone, setRegCompanyPhone] = useState('')
  const [regCompanyAddress, setRegCompanyAddress] = useState('')
  const [regAdminName, setRegAdminName] = useState('')
  const [regAdminEmail, setRegAdminEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirmPassword, setRegConfirmPassword] = useState('')
  const [regLoading, setRegLoading] = useState(false)
  const [showRegPassword, setShowRegPassword] = useState(false)

  const [activeTab, setActiveTab] = useState('login')
  const [tosOpen, setTosOpen] = useState(false)
  const [whyExpanded, setWhyExpanded] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const industries = [
    { value: 'Retail', label: t('auth.retail') },
    { value: 'Wholesale', label: t('auth.wholesale') },
    { value: 'Restaurant', label: t('auth.restaurant') },
    { value: 'Services', label: t('auth.services') },
    { value: 'Other', label: t('auth.other') },
  ]

  const saveSessionAndLogin = useCallback((data: SessionData) => {
    const user = data.user
    const companyInfo: CompanyInfo = {
      id: user.company.id,
      name: user.company.name,
      industry: user.company.industry,
      email: user.company.email,
      phone: user.company.phone,
      plan: user.company.plan,
      isActive: user.company.isActive,
      currency: user.company.currency ?? 'TZS',
      currencySymbol: user.company.currencySymbol ?? 'TSh',
      country: user.company.country ?? 'Tanzania',
      exchangeRate: user.company.exchangeRate ?? 2570,
    }

    setUser({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      branchId: user.branchId,
      companyId: user.companyId,
      twoFactorEnabled: user.twoFactorEnabled,
      mustChangePassword: user.mustChangePassword,
      branch: {
        id: user.branch.id,
        name: user.branch.name,
        code: user.branch.code,
        isHeadOffice: user.branch.isHeadOffice,
        isActive: true,
      },
      company: companyInfo,
    })
    setCurrentBranchId(user.branchId)
    setCompany(companyInfo)
    setAuthenticated(true)
    setAuthToken(data.token)

    localStorage.setItem('smartbiz_session', JSON.stringify(data))
  }, [setUser, setCurrentBranchId, setCompany, setAuthenticated, setAuthToken])

  const fetchBranches = useCallback(async (companyId: string) => {
    try {
      const token = JSON.parse(localStorage.getItem('smartbiz_session') || '{}')?.token
      const res = await fetch(`/api/branches?companyId=${companyId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      const json = await res.json()
      if (json.success && json.data) {
        const branches = json.data.map((b: { id: string; name: string; code: string; isHeadOffice: boolean; isActive: boolean }) => ({
          id: b.id,
          name: b.name,
          code: b.code,
          isHeadOffice: b.isHeadOffice,
          isActive: b.isActive,
        }))
        setBranches(branches)
      }
    } catch {
      // ignore
    }
  }, [setBranches])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!loginEmail || !loginPassword) {
      toast.error(t('auth.enterEmailPassword'))
      return
    }

    setLoginLoading(true)
    setLoginAttemptsLeft(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      })
      const json = await res.json()

      if (!json.success) {
        // Check if there are attempts left info
        if (json.error?.includes('attempts remaining')) {
          const match = json.error.match(/(\d+) attempts remaining/)
          if (match) setLoginAttemptsLeft(parseInt(match[1]))
        }
        if (res.status === 423) {
          toast.error('Account locked. Too many failed attempts. Try again in 15 minutes.', { duration: 8000 })
        } else {
          toast.error(json.error || 'Login failed')
        }
        return
      }

      saveSessionAndLogin(json.data)
      await fetchBranches(json.data.user.companyId)
      toast.success(`${t('auth.welcomeBack')}, ${json.data.user.name}!`)
    } catch {
      toast.error(t('auth.networkError'))
    } finally {
      setLoginLoading(false)
    }
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!joinName || !joinEmail || !joinPassword || !joinBranchCode) {
      toast.error(t('auth.joinFillRequired'))
      return
    }

    if (joinPassword !== joinConfirmPassword) {
      toast.error(t('auth.passwordsNoMatch'))
      return
    }

    const strength = checkPasswordStrength(joinPassword)
    if (strength.score < 2) {
      toast.error('Password is too weak. Please use a stronger password.')
      return
    }

    setJoinLoading(true)
    try {
      const res = await fetch('/api/auth/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: joinName.trim(),
          email: joinEmail.trim(),
          password: joinPassword,
          branchCode: joinBranchCode.trim().toUpperCase(),
        }),
      })
      const json = await res.json()

      if (!json.success) {
        toast.error(json.error || 'Join failed')
        return
      }

      saveSessionAndLogin(json.data)
      await fetchBranches(json.data.user.companyId)
      toast.success(t('auth.joinSuccess'))
    } catch {
      toast.error(t('auth.networkError'))
    } finally {
      setJoinLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!regCompanyName || !regAdminName || !regAdminEmail || !regPassword) {
      toast.error(t('auth.fillRequired'))
      return
    }

    if (regPassword !== regConfirmPassword) {
      toast.error(t('auth.passwordsNoMatch'))
      return
    }

    const strength = checkPasswordStrength(regPassword)
    if (strength.score < 2) {
      toast.error('Password is too weak. Please use a stronger password.')
      return
    }

    setRegLoading(true)
    try {
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regCompanyName,
          industry: regIndustry || undefined,
          email: regCompanyEmail || undefined,
          phone: regCompanyPhone || undefined,
          address: regCompanyAddress || undefined,
          adminName: regAdminName,
          adminEmail: regAdminEmail,
          adminPassword: regPassword,
        }),
      })
      const json = await res.json()

      if (!json.success) {
        toast.error(json.error || 'Registration failed')
        return
      }

      // Auto-login after registration
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: regAdminEmail, password: regPassword }),
      })
      const loginJson = await loginRes.json()

      if (loginJson.success) {
        saveSessionAndLogin(loginJson.data)
        await fetchBranches(loginJson.data.user.companyId)
        toast.success(t('auth.registrationSuccess'))
      } else {
        toast.success(t('auth.registrationLogin'))
        setActiveTab('login')
        setLoginEmail(regAdminEmail)
      }
    } catch {
      toast.error(t('auth.networkError'))
    } finally {
      setRegLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-teal-50/30 to-emerald-100/50 dark:from-emerald-950/20 dark:via-background dark:to-teal-950/20 p-4 animate-auth-gradient relative overflow-hidden">
      {/* Subtle background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-emerald-200/20 dark:bg-emerald-800/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-teal-200/20 dark:bg-teal-800/10 blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo & Branding */}
        <div className={`flex flex-col items-center mb-8 transition-opacity duration-600 ${mounted ? 'animate-auth-fade-in' : 'opacity-0'}`}>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 mb-4 relative">
            <Store className="h-7 w-7" />
            <div className="absolute inset-0 rounded-2xl shadow-[0_0_16px_rgba(5,150,105,0.3)]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">SmartBiz</h1>
          <p className="text-sm text-muted-foreground mt-1 animate-auth-tagline-glow">{t('auth.tagline')}</p>
        </div>

        <Card className={`border-0 shadow-xl shadow-black/5 transition-all duration-300 hover:shadow-2xl hover:shadow-black/[0.08] hover:-translate-y-0.5 ${mounted ? 'animate-auth-slide-up' : 'opacity-0'}`}>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <CardHeader className="pb-0">
              <TabsList className="w-full relative">
                <TabsTrigger value="login" className="flex-1 relative z-10 transition-all duration-200 data-[state=active]:shadow-sm">{t('auth.signIn')}</TabsTrigger>
                <TabsTrigger value="join" className="flex-1 relative z-10 transition-all duration-200 data-[state=active]:shadow-sm">{t('auth.join')}</TabsTrigger>
                <TabsTrigger value="register" className="flex-1 relative z-10 transition-all duration-200 data-[state=active]:shadow-sm">{t('auth.register')}</TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent className="pt-4">
              {/* Login Tab */}
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">{t('auth.email')}</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder={t('auth.emailPlaceholder')}
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="pl-9"
                        disabled={loginLoading}
                        autoComplete="email"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">{t('auth.password')}</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type={showLoginPassword ? 'text' : 'password'}
                        placeholder={t('auth.passwordPlaceholder')}
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="pl-9 pr-10"
                        disabled={loginLoading}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {loginAttemptsLeft !== null && loginAttemptsLeft > 0 && loginAttemptsLeft <= 3 && (
                    <div className="flex items-center gap-2 rounded-lg bg-orange-50 dark:bg-orange-950/30 p-2.5">
                      <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0" />
                      <p className="text-xs text-orange-700 dark:text-orange-400">
                        {loginAttemptsLeft} attempts remaining before account lockout
                      </p>
                    </div>
                  )}

                  {/* Forgot Password Link */}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => toast.info(t('auth.forgotPasswordToast'))}
                      className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors"
                    >
                      {t('auth.forgotPassword')}
                    </button>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white animate-auth-pulse-once"
                    disabled={loginLoading}
                  >
                    {loginLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t('auth.signingIn')}
                      </>
                    ) : (
                      <>
                        {t('auth.signIn')}
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>

                  {/* Quick Tips */}
                  <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3 mt-4 space-y-2">
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">{t('auth.quickTips')}</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="flex flex-col items-center text-center gap-1 py-1">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
                          <ShoppingCart className="h-3.5 w-3.5 text-emerald-600" />
                        </div>
                        <span className="text-[10px] text-muted-foreground leading-tight">{t('auth.tipPOS')}</span>
                      </div>
                      <div className="flex flex-col items-center text-center gap-1 py-1">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
                          <Package className="h-3.5 w-3.5 text-emerald-600" />
                        </div>
                        <span className="text-[10px] text-muted-foreground leading-tight">{t('auth.tipInventory')}</span>
                      </div>
                      <div className="flex flex-col items-center text-center gap-1 py-1">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
                          <BarChart3 className="h-3.5 w-3.5 text-emerald-600" />
                        </div>
                        <span className="text-[10px] text-muted-foreground leading-tight">{t('auth.tipAnalytics')}</span>
                      </div>
                    </div>
                  </div>
                </form>
              </TabsContent>

              {/* Join Tab - Employee Self-Registration */}
              <TabsContent value="join">
                <form onSubmit={handleJoin} className="space-y-4">
                  {/* Explanation */}
                  <div className="flex items-start gap-2 rounded-lg bg-teal-50 dark:bg-teal-950/30 p-3">
                    <Users className="h-4 w-4 text-teal-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-teal-700 dark:text-teal-400">
                      {t('auth.joinExplanation')}
                    </p>
                  </div>

                  {/* Branch Code */}
                  <div className="space-y-2">
                    <Label htmlFor="join-branch-code">
                      {t('auth.branchCode')} <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="join-branch-code"
                        placeholder={t('auth.branchCodePlaceholder')}
                        value={joinBranchCode}
                        onChange={(e) => setJoinBranchCode(e.target.value.toUpperCase())}
                        className="pl-9 font-mono uppercase"
                        disabled={joinLoading}
                        maxLength={20}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('auth.branchCodeHelp')}
                    </p>
                  </div>

                  {/* Personal Info Section */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                      <User className="h-4 w-4" />
                      {t('auth.yourDetails')}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="join-name">
                        {t('auth.fullName')} <span className="text-destructive">*</span>
                      </Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="join-name"
                          placeholder={t('auth.fullNamePlaceholder')}
                          value={joinName}
                          onChange={(e) => setJoinName(e.target.value)}
                          className="pl-9"
                          disabled={joinLoading}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="join-email">
                        {t('auth.email')} <span className="text-destructive">*</span>
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="join-email"
                          type="email"
                          placeholder={t('auth.emailPlaceholder')}
                          value={joinEmail}
                          onChange={(e) => setJoinEmail(e.target.value)}
                          className="pl-9"
                          disabled={joinLoading}
                          autoComplete="email"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="join-password">
                          {t('auth.password')} <span className="text-destructive">*</span>
                        </Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="join-password"
                            type={showJoinPassword ? 'text' : 'password'}
                            placeholder={t('auth.minChars')}
                            value={joinPassword}
                            onChange={(e) => setJoinPassword(e.target.value)}
                            className="pl-9 pr-10"
                            disabled={joinLoading}
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowJoinPassword(!showJoinPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            tabIndex={-1}
                          >
                            {showJoinPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <PasswordStrengthBar password={joinPassword} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="join-confirm-password">
                          {t('auth.confirm')} <span className="text-destructive">*</span>
                        </Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="join-confirm-password"
                            type="password"
                            placeholder={t('auth.reenter')}
                            value={joinConfirmPassword}
                            onChange={(e) => setJoinConfirmPassword(e.target.value)}
                            className="pl-9"
                            disabled={joinLoading}
                            autoComplete="new-password"
                          />
                        </div>
                        {joinConfirmPassword && joinPassword && joinConfirmPassword !== joinPassword && (
                          <p className="text-[10px] text-destructive">Passwords don&apos;t match</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                    disabled={joinLoading}
                  >
                    {joinLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t('auth.joining')}
                      </>
                    ) : (
                      <>
                        {t('auth.joinTeam')}
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>

              {/* Register Tab */}
              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  {/* Explanation */}
                  <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      {t('auth.registerExplanation')}
                    </p>
                  </div>

                  {/* Company Info Section */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                      <Building2 className="h-4 w-4" />
                      {t('auth.companyDetails')}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reg-company-name">
                        {t('auth.companyName')} <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="reg-company-name"
                        placeholder={t('auth.companyNamePlaceholder')}
                        value={regCompanyName}
                        onChange={(e) => setRegCompanyName(e.target.value)}
                        disabled={regLoading}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="reg-industry">{t('auth.industry')}</Label>
                        <Select value={regIndustry} onValueChange={setRegIndustry}>
                          <SelectTrigger id="reg-industry">
                            <SelectValue placeholder={t('auth.selectIndustry')} />
                          </SelectTrigger>
                          <SelectContent>
                            {industries.map((ind) => (
                              <SelectItem key={ind.value} value={ind.value}>
                                {ind.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reg-company-phone">{t('auth.phone')}</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="reg-company-phone"
                            placeholder="+254 700..."
                            value={regCompanyPhone}
                            onChange={(e) => setRegCompanyPhone(e.target.value)}
                            className="pl-9"
                            disabled={regLoading}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reg-company-email">{t('auth.companyEmail')}</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="reg-company-email"
                          type="email"
                          placeholder={t('auth.companyEmailPlaceholder')}
                          value={regCompanyEmail}
                          onChange={(e) => setRegCompanyEmail(e.target.value)}
                          className="pl-9"
                          disabled={regLoading}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reg-company-address">{t('auth.address')}</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="reg-company-address"
                          placeholder={t('auth.addressPlaceholder')}
                          value={regCompanyAddress}
                          onChange={(e) => setRegCompanyAddress(e.target.value)}
                          className="pl-9"
                          disabled={regLoading}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Separator */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">{t('auth.adminAccount')}</span>
                    </div>
                  </div>

                  {/* Admin Info Section */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                      <User className="h-4 w-4" />
                      {t('auth.adminDetails')}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reg-admin-name">
                        {t('auth.fullName')} <span className="text-destructive">*</span>
                      </Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="reg-admin-name"
                          placeholder={t('auth.fullNamePlaceholder')}
                          value={regAdminName}
                          onChange={(e) => setRegAdminName(e.target.value)}
                          className="pl-9"
                          disabled={regLoading}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reg-admin-email">
                        {t('auth.adminEmail')} <span className="text-destructive">*</span>
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="reg-admin-email"
                          type="email"
                          placeholder={t('auth.adminEmailPlaceholder')}
                          value={regAdminEmail}
                          onChange={(e) => setRegAdminEmail(e.target.value)}
                          className="pl-9"
                          disabled={regLoading}
                          autoComplete="email"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="reg-password">
                          {t('auth.password')} <span className="text-destructive">*</span>
                        </Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="reg-password"
                            type={showRegPassword ? 'text' : 'password'}
                            placeholder={t('auth.minChars')}
                            value={regPassword}
                            onChange={(e) => setRegPassword(e.target.value)}
                            className="pl-9 pr-10"
                            disabled={regLoading}
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowRegPassword(!showRegPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            tabIndex={-1}
                          >
                            {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <PasswordStrengthBar password={regPassword} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reg-confirm-password">
                          {t('auth.confirm')} <span className="text-destructive">*</span>
                        </Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="reg-confirm-password"
                            type="password"
                            placeholder={t('auth.reenter')}
                            value={regConfirmPassword}
                            onChange={(e) => setRegConfirmPassword(e.target.value)}
                            className="pl-9"
                            disabled={regLoading}
                            autoComplete="new-password"
                          />
                        </div>
                        {regConfirmPassword && regPassword && regConfirmPassword !== regPassword && (
                          <p className="text-[10px] text-destructive">Passwords don&apos;t match</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={regLoading}
                  >
                    {regLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t('auth.creatingCompany')}
                      </>
                    ) : (
                      <>
                        {t('auth.registerCompany')}
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        {/* Security Badge */}
        <div className="flex items-center justify-center gap-2 mt-4">
          <Shield className="h-3.5 w-3.5 text-emerald-600" />
          <span className="text-[11px] text-muted-foreground">Bank-grade encryption · JWT authentication · Account lockout protection</span>
        </div>

        {/* Competitive Advantage Badges */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50">
            <Wifi className="h-2.5 w-2.5" />
            {t('auth.badgeOffline')}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50">
            <Bot className="h-2.5 w-2.5" />
            {t('auth.badgeAI')}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50">
            <Smartphone className="h-2.5 w-2.5" />
            {t('auth.badgeMobile')}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50">
            <Shield className="h-2.5 w-2.5" />
            {t('auth.badgeSecurity')}
          </span>
        </div>

        {/* Trust Indicators */}
        <div className="text-center mt-4 space-y-1.5">
          <p className="text-[11px] text-muted-foreground font-medium">{t('auth.trustedBy')}</p>
          <div className="flex items-center justify-center gap-1.5 text-base" aria-label="East Africa countries">
            <span title="Tanzania">🇹🇿</span>
            <span title="Kenya">🇰🇪</span>
            <span title="Uganda">🇺🇬</span>
            <span title="Rwanda">🇷🇼</span>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50">
            <Sparkles className="h-2.5 w-2.5" />
            {t('auth.freeForever')}
          </span>
        </div>

        {/* Why SmartBiz - Expandable */}
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setWhyExpanded(!whyExpanded)}
            className="flex items-center justify-center gap-1 mx-auto text-[11px] font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors"
          >
            {t('auth.whySmartBiz')}
            <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${whyExpanded ? 'rotate-180' : ''}`} />
          </button>
          {whyExpanded && (
            <div className="mt-2 rounded-lg bg-muted/50 dark:bg-muted/30 p-3 animate-auth-badge-fade">
              <ul className="space-y-1.5">
                <li className="flex items-start gap-2 text-[11px] text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{t('auth.vsSimpler')}</span>
                </li>
                <li className="flex items-start gap-2 text-[11px] text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{t('auth.vsAffordable')}</span>
                </li>
                <li className="flex items-start gap-2 text-[11px] text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{t('auth.vsAfrica')}</span>
                </li>
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            {t('auth.termsNotice')}
          </p>
          <button
            type="button"
            onClick={() => setTosOpen(true)}
            className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 underline underline-offset-2 transition-colors"
          >
            {t('auth.viewTerms')}
          </button>
        </div>
      </div>

      {/* Terms of Service Dialog */}
      <Dialog open={tosOpen} onOpenChange={setTosOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              {t('auth.termsOfService')}
            </DialogTitle>
            <DialogDescription>
              {t('auth.termsIntro')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <h4 className="text-sm font-semibold mb-1">{t('auth.termsAccount')}</h4>
              <p className="text-xs text-muted-foreground">{t('auth.termsAccountDesc')}</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-1">{t('auth.termsData')}</h4>
              <p className="text-xs text-muted-foreground">{t('auth.termsDataDesc')}</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-1">{t('auth.termsUsage')}</h4>
              <p className="text-xs text-muted-foreground">{t('auth.termsUsageDesc')}</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-1">{t('auth.termsAccess')}</h4>
              <p className="text-xs text-muted-foreground">{t('auth.termsAccessDesc')}</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-1">{t('auth.termsAvailability')}</h4>
              <p className="text-xs text-muted-foreground">{t('auth.termsAvailabilityDesc')}</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-1">{t('auth.termsChanges')}</h4>
              <p className="text-xs text-muted-foreground">{t('auth.termsChangesDesc')}</p>
            </div>

            {/* Security Information Section */}
            <div className="pt-2 border-t">
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-emerald-600" />
                Security & Privacy
              </h4>
              <div className="space-y-2">
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600 mt-0.5 shrink-0" />
                  <span>Passwords are encrypted with bcrypt (12 salt rounds) and never stored in plain text</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600 mt-0.5 shrink-0" />
                  <span>All API requests are authenticated with JWT tokens (24-hour expiry)</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600 mt-0.5 shrink-0" />
                  <span>Account lockout after 5 failed login attempts (15-minute cooldown)</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600 mt-0.5 shrink-0" />
                  <span>Rate limiting on all endpoints to prevent brute force attacks</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600 mt-0.5 shrink-0" />
                  <span>Complete audit logging of all sensitive operations</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600 mt-0.5 shrink-0" />
                  <span>Tenant isolation - your data is never shared between companies</span>
                </div>
              </div>
            </div>

            {/* Demo Accounts Section - moved from login page */}
            <div className="pt-2 border-t">
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <Store className="h-4 w-4 text-emerald-600" />
                {t('auth.termsDemo')}
              </h4>
              <p className="text-xs text-muted-foreground mb-2">{t('auth.termsDemoDesc')}</p>
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-2.5 space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono bg-white dark:bg-emerald-950/50 px-1.5 py-0.5 rounded border text-[11px]">admin@smartbiz.com</span>
                  <span>{t('auth.multiBranchCorp')}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono bg-white dark:bg-emerald-950/50 px-1.5 py-0.5 rounded border text-[11px]">mamajane@gmail.com</span>
                  <span>{t('auth.singleShop')}</span>
                </div>
                <p className="text-xs text-muted-foreground">{t('auth.passwordForDemo')} <span className="font-mono font-medium">demo</span></p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setTosOpen(false)} className="bg-emerald-600 hover:bg-emerald-700">
              {t('auth.termsClose')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
