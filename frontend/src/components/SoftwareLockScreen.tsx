import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Lock,
  ClockAlert,
  RefreshCw,
  LogOut,
  PhoneCall,
  ShieldCheck,
  Calendar,
} from 'lucide-react'

export const SoftwareLockScreen: React.FC = () => {
  const { license, refreshLicense, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-md p-4">
      <Card className="w-full max-w-lg border-amber-200 dark:border-amber-900 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        <div className="h-2 bg-amber-500 w-full" />
        <CardHeader className="text-center pb-2 pt-6">
          <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center mx-auto mb-3 shadow-md">
            <Lock className="w-8 h-8" />
          </div>
          <CardTitle className="text-xl font-bold text-foreground">
            Software Subscription Plan Expired
          </CardTitle>
          <CardDescription className="text-xs pt-1 leading-relaxed">
            Your software subscription plan has expired. Please call the support team to renew your subscription plan.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-2">
          {/* Status info box */}
          <div className="p-3.5 bg-muted/60 rounded-xl border text-xs space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Subscription Status:</span>
              <Badge variant="outline" className="text-xs font-bold gap-1 bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300">
                <ClockAlert className="w-3.5 h-3.5 text-amber-600" />
                Subscription Plan Expired
              </Badge>
            </div>

            {license?.expiryDate && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Plan Expiry Date:</span>
                <span className="font-semibold text-foreground flex items-center gap-1 font-mono">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  {new Date(license.expiryDate).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
            )}
          </div>

          {/* Support Helpline Callout */}
          <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl text-xs space-y-2 dark:bg-blue-950/40 dark:border-blue-900">
            <div className="font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5 text-sm">
              <PhoneCall className="w-4 h-4 text-blue-600" />
              <span>Call Support Team for Plan Renewal</span>
            </div>
            <p className="text-blue-800 dark:text-blue-200 font-medium leading-relaxed">
              Your software subscription plan is expired. Please call the support team to renew your subscription plan and resume seamless operations.
            </p>
            <div className="p-2.5 bg-white/80 dark:bg-black/30 rounded-lg border border-blue-200/80 dark:border-blue-900 font-mono text-blue-900 dark:text-blue-200 font-semibold text-xs">
              {license?.developerNote || 'Support Helpline: +91 7776824564 (Mr. Rameshwar Pawar)'}
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground text-center">
            Authorized support engineers and administrators can sign in below to update or renew the subscription plan.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshLicense()}
              className="flex-1 gap-1.5 text-xs h-9 font-semibold"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Check Status
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                logout()
                navigate('/login?tab=developer')
              }}
              className="flex-1 gap-1.5 text-xs h-9 font-bold bg-primary"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Support / Admin Login
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logout()}
              className="gap-1.5 text-xs h-9 text-muted-foreground"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
