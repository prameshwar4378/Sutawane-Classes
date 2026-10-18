import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  GraduationCap,
  Lock,
  User,
  Eye,
  EyeOff,
  AlertTriangle,
  ShieldCheck,
  Code2,
  KeyRound,
  Mail,
  Send,
  CheckCircle2,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react'

const AUTHORIZED_DEVELOPER_EMAIL = 'prameshwar4378@gmail.com'

export const LoginPage: React.FC = () => {
  const { login, sendDeveloperOtp, verifyDeveloperOtp, license } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  // Tab State: 'OWNER' or 'DEVELOPER'
  const [activeTab, setActiveTab] = useState<'OWNER' | 'DEVELOPER'>(
    searchParams.get('tab') === 'developer' ? 'DEVELOPER' : 'OWNER'
  )

  // Class Owner form state
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Developer OTP form state
  const [devEmail, setDevEmail] = useState(AUTHORIZED_DEVELOPER_EMAIL)
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  // General state
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const from = (location.state as any)?.from?.pathname || '/'

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  // Handle Class Owner Password Login
  const handleOwnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) {
      setErrorMsg('Please enter both username and password.')
      return
    }

    setErrorMsg('')
    setSuccessMsg('')
    setIsSubmitting(true)

    try {
      const res = await login(username.trim(), password)
      if (res.success) {
        navigate(from, { replace: true })
      } else {
        setErrorMsg(res.error || 'Authentication failed. Please check credentials.')
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred during login.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Developer Send OTP
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (devEmail.trim().toLowerCase() !== AUTHORIZED_DEVELOPER_EMAIL) {
      setErrorMsg(`Developer access is strictly restricted to ${AUTHORIZED_DEVELOPER_EMAIL} only.`)
      return
    }

    setErrorMsg('')
    setSuccessMsg('')
    setIsSubmitting(true)

    try {
      const res = await sendDeveloperOtp(devEmail.trim())
      if (res.success) {
        setOtpSent(true)
        setResendCooldown(45) // 45 seconds cooldown
        setSuccessMsg(res.message || `OTP sent to ${AUTHORIZED_DEVELOPER_EMAIL}!`)
      } else {
        setErrorMsg(res.error || 'Failed to send OTP email.')
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to dispatch OTP. Check internet connection.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Developer Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otpCode.trim() || otpCode.trim().length < 6) {
      setErrorMsg('Please enter the complete 6-digit OTP code.')
      return
    }

    setErrorMsg('')
    setSuccessMsg('')
    setIsSubmitting(true)

    try {
      const res = await verifyDeveloperOtp(devEmail.trim(), otpCode.trim())
      if (res.success) {
        navigate('/developer-portal', { replace: true })
      } else {
        setErrorMsg(res.error || 'Invalid or expired OTP code.')
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isLicenseIssue = license && (!license.isActive || license.isExpired)

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50/40 dark:from-slate-950 dark:via-background dark:to-slate-900 p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Brand Header */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 mb-1">
            <GraduationCap className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            SUTAWANE CLASSES
          </h1>
          <p className="text-xs text-muted-foreground font-medium">
            Desktop Management &amp; Coaching Operating System
          </p>
        </div>

        {/* Subscription Notice if Expired or Inactive */}
        {isLicenseIssue && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs space-y-1.5 shadow-xs dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-200">
            <div className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Subscription Notice</span>
            </div>
            <p className="leading-relaxed font-medium">
              Your software subscription plan is expired. Please call the support team to renew your subscription plan.
            </p>
            <div className="p-2 bg-white/80 dark:bg-black/30 rounded-md border border-amber-300/60 font-mono text-amber-950 dark:text-amber-200 font-semibold text-[11px]">
              {license.developerNote || 'Support Helpline: +91 7776824564 (Mr. Rameshwar Pawar)'}
            </div>
            <p className="text-[10px] text-muted-foreground pt-0.5">
              * Support &amp; developer team can log in via Developer OTP tab below to update or renew the subscription plan.
            </p>
          </div>
        )}

        {/* Main Authentication Card */}
        <Card className="shadow-xl border-border/80 overflow-hidden">
          {/* Role Tabs */}
          <div className="grid grid-cols-2 border-b bg-muted/40 text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setActiveTab('OWNER')
                setErrorMsg('')
                setSuccessMsg('')
              }}
              className={`py-3 px-4 flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
                activeTab === 'OWNER'
                  ? 'border-primary bg-background text-foreground shadow-xs'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Class Owner</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('DEVELOPER')
                setErrorMsg('')
                setSuccessMsg('')
              }}
              className={`py-3 px-4 flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
                activeTab === 'DEVELOPER'
                  ? 'border-primary bg-background text-foreground shadow-xs'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              <Code2 className="w-4 h-4 text-blue-600" />
              <span>Developer (OTP)</span>
            </button>
          </div>

          <CardHeader className="pb-3 text-center pt-5">
            <CardTitle className="text-base font-bold">
              {activeTab === 'OWNER' ? 'Class Owner Sign In' : 'Developer Email Authentication'}
            </CardTitle>
            <CardDescription className="text-xs">
              {activeTab === 'OWNER'
                ? 'Sign in with your institute owner credentials'
                : 'Secure 2-Factor OTP login for authorized developer'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Feedback Notifications */}
            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs flex items-start gap-2 animate-in fade-in dark:bg-red-950/50 dark:border-red-900 dark:text-red-200">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span className="font-medium leading-relaxed">{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-start gap-2 animate-in fade-in dark:bg-emerald-950/50 dark:border-emerald-900 dark:text-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="font-medium leading-relaxed">{successMsg}</span>
              </div>
            )}

            {/* TAB 1: CLASS OWNER LOGIN */}
            {activeTab === 'OWNER' ? (
              <form onSubmit={handleOwnerSubmit} className="space-y-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>Username</span>
                    <span className="text-[10px] text-muted-foreground">Class Owner</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground pointer-events-none" />
                    <Input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. sutawane"
                      className="pl-9 text-xs h-9"
                      autoFocus
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>Password</span>
                    <span className="text-[10px] text-muted-foreground">Case sensitive</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground pointer-events-none" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="pl-9 pr-9 text-xs h-9"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-9 text-xs font-bold gap-2 mt-2 shadow-sm"
                >
                  <KeyRound className="w-4 h-4" />
                  {isSubmitting ? 'Authenticating...' : 'Sign In as Class Owner'}
                </Button>

                {/* Quick Credentials Helper */}
                <div className="pt-2 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setUsername('sutawane')
                      setPassword('sutawane@123')
                      setErrorMsg('')
                    }}
                    className="w-full p-2 rounded-lg border bg-muted/40 hover:bg-muted text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">Auto-fill Default Owner:</span>
                      <Badge variant="outline" className="text-[10px] py-0 text-emerald-700 bg-emerald-50 border-emerald-300">
                        sutawane
                      </Badge>
                    </div>
                  </button>
                </div>
              </form>
            ) : (
              /* TAB 2: DEVELOPER EMAIL + OTP LOGIN */
              <div className="space-y-3.5">
                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-xs space-y-1 dark:bg-blue-950/40 dark:border-blue-900">
                  <div className="font-semibold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-blue-600" />
                    <span>Authorized Developer Email Only</span>
                  </div>
                  <p className="text-[11px] text-blue-800 dark:text-blue-200 leading-relaxed font-mono">
                    {AUTHORIZED_DEVELOPER_EMAIL}
                  </p>
                </div>

                {!otpSent ? (
                  /* Step 1: Request OTP */
                  <form onSubmit={handleSendOtp} className="space-y-3.5">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">
                        Developer Email Address
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground pointer-events-none" />
                        <Input
                          type="email"
                          value={devEmail}
                          onChange={(e) => setDevEmail(e.target.value)}
                          className="pl-9 text-xs h-9 font-mono"
                          required
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        * Software strictly accepts only <span className="font-mono font-semibold">{AUTHORIZED_DEVELOPER_EMAIL}</span>.
                      </p>
                    </div>

                    <Button
                      type="submit"
                      disabled={isSubmitting || devEmail.trim().toLowerCase() !== AUTHORIZED_DEVELOPER_EMAIL}
                      className="w-full h-9 text-xs font-bold gap-2 shadow-sm bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Send className="w-4 h-4" />
                      {isSubmitting ? 'Sending OTP to Email...' : 'Send Login OTP to Email'}
                    </Button>
                  </form>
                ) : (
                  /* Step 2: Enter & Verify OTP */
                  <form onSubmit={handleVerifyOtp} className="space-y-3.5 animate-in fade-in">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-foreground">
                          Enter 6-Digit OTP Code
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setOtpSent(false)
                            setOtpCode('')
                            setErrorMsg('')
                          }}
                          className="text-[11px] text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <ArrowLeft className="w-3 h-3" />
                          Change
                        </button>
                      </div>

                      <Input
                        type="text"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="••••••"
                        maxLength={6}
                        className="text-center font-mono font-extrabold text-xl tracking-[8px] h-11"
                        autoFocus
                        required
                      />
                      <p className="text-[10px] text-muted-foreground text-center">
                        Code sent to {AUTHORIZED_DEVELOPER_EMAIL} (valid for 10 minutes)
                      </p>
                    </div>

                    <Button
                      type="submit"
                      disabled={isSubmitting || otpCode.trim().length !== 6}
                      className="w-full h-9 text-xs font-bold gap-2 shadow-sm bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <KeyRound className="w-4 h-4" />
                      {isSubmitting ? 'Verifying OTP...' : 'Verify OTP & Enter Developer Portal'}
                    </Button>

                    {/* Resend OTP button */}
                    <div className="text-center pt-1">
                      {resendCooldown > 0 ? (
                        <span className="text-[11px] text-muted-foreground font-mono">
                          Resend OTP in {resendCooldown}s
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSendOtp()}
                          disabled={isSubmitting}
                          className="text-[11px] text-blue-600 hover:underline font-semibold flex items-center justify-center gap-1 mx-auto"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Resend OTP to Email
                        </button>
                      )}
                    </div>
                  </form>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer info */}
        <div className="text-center text-[11px] text-muted-foreground">
          Sutawane Classes Software &bull; Offline Persistent Core &bull; Secure 2FA Developer Gate
        </div>
      </div>
    </div>
  )
}
