'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, CheckCircle2, KeyRound, ArrowLeft, AlertCircle } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/language-context'
import { checkPasswordStrength } from '@/lib/auth'

interface ForgotPasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Step = 'email' | 'reset' | 'success'

export function ForgotPasswordDialog({ open, onOpenChange }: ForgotPasswordDialogProps) {
  const { t } = useLanguage()

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [displayToken, setDisplayToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const passwordStrength = newPassword ? checkPasswordStrength(newPassword) : null
  const passwordsMatch = newPassword === confirmPassword

  const reset = () => {
    setStep('email')
    setEmail('')
    setResetToken('')
    setDisplayToken('')
    setNewPassword('')
    setConfirmPassword('')
    setLoading(false)
    setError(null)
  }

  const handleSendCode = async () => {
    if (!email.trim()) {
      setError(t('auth.fillRequired'))
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error || t('auth.forgotPasswordRateLimited'))
        return
      }
      setDisplayToken(data.data.resetToken)
      setStep('reset')
    } catch {
      setError(t('auth.networkError'))
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async () => {
    if (!resetToken.trim() || !newPassword || !confirmPassword) {
      setError(t('auth.fillRequired'))
      return
    }
    if (newPassword !== confirmPassword) {
      setError(t('auth.passwordsNoMatch'))
      return
    }
    if (passwordStrength && passwordStrength.score < 2) {
      setError(`Password too weak: ${passwordStrength.feedback.join(', ')}`)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/reset-password/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token: resetToken, password: newPassword }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error || t('auth.forgotPasswordInvalidToken'))
        return
      }
      setStep('success')
    } catch {
      setError(t('auth.networkError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val) reset()
      onOpenChange(val)
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-emerald-600" />
            {t('auth.forgotPasswordTitle')}
          </DialogTitle>
          <DialogDescription>
            {step === 'email' && t('auth.forgotPasswordStep1')}
            {step === 'reset' && t('auth.forgotPasswordStep2')}
            {step === 'success' && t('auth.forgotPasswordSuccess')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1: Email */}
          {step === 'email' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="reset-email">{t('auth.email')}</Label>
                <Input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('auth.emailPlaceholder')}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendCode() }}
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 text-sm text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                onClick={handleSendCode}
                disabled={loading || !email.trim()}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('auth.forgotPasswordSending')}</>
                ) : (
                  t('auth.forgotPasswordSendCode')
                )}
              </Button>
            </>
          )}

          {/* Step 2: Token + New Password */}
          {step === 'reset' && (
            <>
              {displayToken && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  <p className="text-xs text-muted-foreground mb-1">{t('auth.forgotPasswordTokenDisplay')}</p>
                  <p className="font-mono font-bold text-emerald-700 dark:text-emerald-400 break-all text-sm">{displayToken}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="reset-code">{t('auth.forgotPasswordResetCode')}</Label>
                <Input
                  id="reset-code"
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  placeholder={t('auth.forgotPasswordResetCodePlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password">{t('auth.forgotPasswordNewPassword')}</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('auth.forgotPasswordNewPassword')}
                />
                {passwordStrength && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full ${
                            i <= passwordStrength.score ? passwordStrength.color : 'bg-muted'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {passwordStrength.label}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">{t('auth.forgotPasswordConfirmPassword')}</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('auth.forgotPasswordConfirmPassword')}
                />
                {confirmPassword && !passwordsMatch && (
                  <p className="text-xs text-red-500">{t('auth.passwordsNoMatch')}</p>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 text-sm text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                onClick={handleResetPassword}
                disabled={loading || !resetToken.trim() || !newPassword || !confirmPassword || !passwordsMatch}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('auth.forgotPasswordResetting')}</>
                ) : (
                  t('auth.forgotPasswordResetButton')
                )}
              </Button>
            </>
          )}

          {/* Step 3: Success */}
          {step === 'success' && (
            <>
              <div className="flex flex-col items-center gap-3 py-4">
                <CheckCircle2 className="h-12 w-12 text-emerald-600" />
                <p className="text-sm text-center text-muted-foreground">{t('auth.forgotPasswordSuccess')}</p>
              </div>

              <Button
                onClick={() => {
                  reset()
                  onOpenChange(false)
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('auth.forgotPasswordGoBack')}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
