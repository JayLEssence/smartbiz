'use client'

import { useState } from 'react'
import { useAppStore, type CompanyInfo } from '@/stores/app-store'
import { useLanguage } from '@/lib/i18n/language-context'
import { Store, Building2, User, Mail, Lock, Phone, MapPin, Loader2, ArrowRight, CheckCircle2, Users, Hash, ShieldCheck, FileText, ShoppingCart, Package, BarChart3 } from 'lucide-react'
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

interface SessionData {
  user: {
    id: string
    email: string
    name: string
    role: string
    branchId: string
    companyId: string
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
    }
  }
  token: string
}

export function AuthPage() {
  const { t } = useLanguage()
  const { setUser, setCurrentBranchId, setCompany, setAuthenticated, setBranches } = useAppStore()

  // Login state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  // Join state (employee self-registration)
  const [joinName, setJoinName] = useState('')
  const [joinEmail, setJoinEmail] = useState('')
  const [joinPassword, setJoinPassword] = useState('')
  const [joinConfirmPassword, setJoinConfirmPassword] = useState('')
  const [joinBranchCode, setJoinBranchCode] = useState('')
  const [joinLoading, setJoinLoading] = useState(false)

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

  const [activeTab, setActiveTab] = useState('login')
  const [tosOpen, setTosOpen] = useState(false)

  const industries = [
    { value: 'Retail', label: t('auth.retail') },
    { value: 'Wholesale', label: t('auth.wholesale') },
    { value: 'Restaurant', label: t('auth.restaurant') },
    { value: 'Services', label: t('auth.services') },
    { value: 'Other', label: t('auth.other') },
  ]

  const saveSessionAndLogin = (data: SessionData) => {
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

    localStorage.setItem('smartbiz_session', JSON.stringify(data))
  }

  const fetchBranches = async (companyId: string) => {
    try {
      const res = await fetch(`/api/branches?companyId=${companyId}`)
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
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!loginEmail || !loginPassword) {
      toast.error(t('auth.enterEmailPassword'))
      return
    }

    setLoginLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      })
      const json = await res.json()

      if (!json.success) {
        toast.error(json.error || 'Login failed')
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

    if (joinPassword.length < 6) {
      toast.error(t('auth.passwordMinLength'))
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

    if (regPassword.length < 6) {
      toast.error(t('auth.passwordMinLength'))
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-emerald-950/20 dark:via-background dark:to-teal-950/20 p-4">
      <div className="w-full max-w-md">
        {/* Logo & Branding */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 mb-4">
            <Store className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">SmartBiz</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('auth.tagline')}</p>
        </div>

        <Card className="border-0 shadow-xl shadow-black/5">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <CardHeader className="pb-0">
              <TabsList className="w-full">
                <TabsTrigger value="login" className="flex-1">{t('auth.signIn')}</TabsTrigger>
                <TabsTrigger value="join" className="flex-1">{t('auth.join')}</TabsTrigger>
                <TabsTrigger value="register" className="flex-1">{t('auth.register')}</TabsTrigger>
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
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">{t('auth.password')}</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type="password"
                        placeholder={t('auth.passwordPlaceholder')}
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="pl-9"
                        disabled={loginLoading}
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
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
                            type="password"
                            placeholder={t('auth.minChars')}
                            value={joinPassword}
                            onChange={(e) => setJoinPassword(e.target.value)}
                            className="pl-9"
                            disabled={joinLoading}
                          />
                        </div>
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
                          />
                        </div>
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
                            type="password"
                            placeholder={t('auth.minChars')}
                            value={regPassword}
                            onChange={(e) => setRegPassword(e.target.value)}
                            className="pl-9"
                            disabled={regLoading}
                          />
                        </div>
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
                          />
                        </div>
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

        {/* Footer */}
        <div className="text-center mt-6 space-y-2">
          <p className="text-xs text-muted-foreground">
            {t('auth.termsNotice')}
          </p>
          <button
            type="button"
            onClick={() => setTosOpen(true)}
            className="text-xs text-emerald-600 hover:text-emerald-700 underline underline-offset-2"
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
            {/* Demo Accounts Section */}
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
