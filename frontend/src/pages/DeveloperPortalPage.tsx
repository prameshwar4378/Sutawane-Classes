import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ShieldAlert,
  KeyRound,
  Calendar,
  Power,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  User,
  Clock,
  ClockAlert,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react'

interface UserRecord {
  id: string
  username: string
  name: string
  role: 'CLASS_OWNER' | 'DEVELOPER'
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export const DeveloperPortalPage: React.FC = () => {
  const queryClient = useQueryClient()
  const { refreshLicense, user: currentDev } = useAuth()

  const [notification, setNotification] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  // State for user password reset dialog
  const [passwordModalUser, setPasswordModalUser] = useState<UserRecord | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // License editing state
  const [expiryInput, setExpiryInput] = useState('')
  const [developerNoteInput, setDeveloperNoteInput] = useState('')

  const notify = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 6000)
  }

  // Fetch Users
  const { data: usersData, isLoading: usersLoading, refetch: refetchUsers } = useQuery<{
    success: boolean
    users: UserRecord[]
  }>({
    queryKey: ['developer-users'],
    queryFn: () => api.get('/auth/developer/users'),
  })

  // Fetch License Info
  const { data: licenseData, isLoading: licenseLoading, refetch: refetchLicense } = useQuery({
    queryKey: ['license-status-dev'],
    queryFn: async () => {
      const res = await api.get('/auth/license-status')
      if (res?.license) {
        if (!expiryInput) {
          const d = new Date(res.license.expiryDate)
          setExpiryInput(d.toISOString().split('T')[0])
        }
        if (!developerNoteInput) {
          setDeveloperNoteInput(res.license.developerNote || '')
        }
      }
      return res.license
    },
  })

  // Mutation: Update License
  const updateLicenseMutation = useMutation({
    mutationFn: (updates: { isActive?: boolean; expiryDate?: string; developerNote?: string }) =>
      api.post('/auth/developer/update-license', updates),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['license-status-dev'] })
      refreshLicense()
      notify('success', res.message || 'License parameters updated successfully!')
    },
    onError: (err: any) => {
      notify('error', err.message || 'Failed to update license parameters.')
    },
  })

  // Mutation: Update User Password
  const updatePasswordMutation = useMutation({
    mutationFn: (data: { userId: string; newPassword: string }) =>
      api.post('/auth/developer/update-user-password', data),
    onSuccess: (res: any) => {
      setPasswordModalUser(null)
      setNewPassword('')
      queryClient.invalidateQueries({ queryKey: ['developer-users'] })
      notify('success', res.message || 'User password updated successfully!')
    },
    onError: (err: any) => {
      notify('error', err.message || 'Failed to update user password.')
    },
  })

  // Preset quick date extender
  const handleExtendExpiry = (monthsToAdd: number) => {
    const baseDate = new Date()
    baseDate.setMonth(baseDate.getMonth() + monthsToAdd)
    const formatted = baseDate.toISOString().split('T')[0]
    setExpiryInput(formatted)
    updateLicenseMutation.mutate({ expiryDate: baseDate.toISOString() })
  }

  const handleSetLifetime = () => {
    const lifetime = new Date('2099-12-31T23:59:59.000Z')
    setExpiryInput('2099-12-31')
    updateLicenseMutation.mutate({ expiryDate: lifetime.toISOString() })
  }

  const license = licenseData
  const users = usersData?.users || []

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300 gap-1 text-xs">
              <ShieldAlert className="w-3.5 h-3.5 text-blue-600" />
              Developer Administration Control
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1">
            Developer License &amp; User Access Portal
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage Class Owner credentials, software expiry date, and toggle instant software activation/deactivation.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            refetchLicense()
            refetchUsers()
          }}
          className="gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Status
        </Button>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-3 border shadow-xs ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span className="font-semibold">{notification.message}</span>
        </div>
      )}

      {/* Primary Control Cards: Software Activation & Expiry Management */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Software Activation / Deactivation */}
        <Card className="border-border shadow-sm flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Power className="w-5 h-5 text-primary" />
                Software Subscription Access Control
              </CardTitle>
              {license?.isActive ? (
                <Badge variant="success" className="gap-1 font-semibold text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Subscription Active
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 font-semibold text-xs bg-amber-50 text-amber-800 border-amber-300">
                  <ClockAlert className="w-3.5 h-3.5 text-amber-600" />
                  Subscription Inactive
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs">
              Manage client subscription plan access status.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                license?.isActive
                  ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50/60 border-amber-200 text-amber-900'
              }`}
            >
              <div className="font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>
                  Current Status:{' '}
                  {license?.isActive
                    ? 'Active (Client has full software access)'
                    : 'Inactive (Client sees subscription renewal notice)'}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed">
                {license?.isActive
                  ? 'The subscription is currently active. The coaching institute has full access to all features.'
                  : 'The subscription is currently paused. When the client accesses the system, a polite prompt asks them to call the support team for renewal.'}
              </p>
            </div>

            <Button
              variant={license?.isActive ? 'destructive' : 'default'}
              onClick={() => updateLicenseMutation.mutate({ isActive: !license?.isActive })}
              disabled={updateLicenseMutation.isPending || licenseLoading}
              className="w-full gap-2 font-bold text-xs h-9"
            >
              <Power className="w-4 h-4" />
              {license?.isActive ? 'Pause / Deactivate Subscription Plan' : 'Activate Subscription Plan'}
            </Button>
          </CardContent>
        </Card>

        {/* Card 2: Software Expiry Date Management */}
        <Card className="border-border shadow-sm flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-600" />
                Software Expiry Date Management
              </CardTitle>
              {license?.isExpired ? (
                <Badge variant="danger" className="gap-1 font-semibold text-xs">
                  <Clock className="w-3.5 h-3.5" />
                  Expired
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 font-semibold text-xs border-emerald-300 text-emerald-700 bg-emerald-50">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  {license?.daysRemaining} Days Left
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs">
              Configure subscription / license expiration date for this client.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex justify-between">
                <span>Select Expiry Date</span>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {license?.expiryDate
                    ? new Date(license.expiryDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—'}
                </span>
              </label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={expiryInput}
                  onChange={(e) => setExpiryInput(e.target.value)}
                  className="text-xs h-9"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    if (expiryInput) {
                      updateLicenseMutation.mutate({
                        expiryDate: new Date(expiryInput).toISOString(),
                      })
                    }
                  }}
                  disabled={updateLicenseMutation.isPending || !expiryInput}
                  className="font-bold text-xs h-9 px-4 shrink-0"
                >
                  Save Date
                </Button>
              </div>
            </div>

            {/* Quick Extension Buttons */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-medium text-muted-foreground">Quick Extend Expiry:</span>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExtendExpiry(1)}
                  className="h-7 px-2 text-[11px]"
                >
                  +1 Month
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExtendExpiry(3)}
                  className="h-7 px-2 text-[11px]"
                >
                  +3 Months
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExtendExpiry(6)}
                  className="h-7 px-2 text-[11px]"
                >
                  +6 Months
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExtendExpiry(12)}
                  className="h-7 px-2 text-[11px] font-semibold text-primary"
                >
                  +1 Year
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExtendExpiry(36)}
                  className="h-7 px-2 text-[11px]"
                >
                  +3 Years
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSetLifetime}
                  className="h-7 px-2 text-[11px] gap-1 font-semibold"
                >
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  Lifetime (2099)
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Support Helpline & Contact Details Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            Support Helpline &amp; Renewal Contact Notice
          </CardTitle>
          <CardDescription className="text-xs">
            This contact number and message is displayed to the client when their software subscription plan expires.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              type="text"
              value={developerNoteInput}
              onChange={(e) => setDeveloperNoteInput(e.target.value)}
              placeholder="e.g. Support Helpline: +91 7776824564 (Mr. Rameshwar Pawar)"
              className="text-xs h-9 flex-1"
            />
            <Button
              size="sm"
              onClick={() => updateLicenseMutation.mutate({ developerNote: developerNoteInput })}
              disabled={updateLicenseMutation.isPending}
              className="h-9 px-4 text-xs font-semibold shrink-0"
            >
              Update Helpline
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* User Accounts & Password Management */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                User Accounts &amp; Password Management
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Manage Class Owner credentials, reset lost passwords, and inspect active roles.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="py-8 text-center text-xs text-muted-foreground">Loading accounts...</div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User Display Name</TableHead>
                    <TableHead>Username (Login ID)</TableHead>
                    <TableHead>Assigned Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-semibold text-xs text-foreground">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                            {u.name.charAt(0)}
                          </div>
                          <span>{u.name}</span>
                          {u.id === currentDev?.id && (
                            <Badge variant="outline" className="text-[10px] py-0">You</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-foreground">
                        {u.username}
                      </TableCell>
                      <TableCell>
                        {u.role === 'DEVELOPER' ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] gap-1">
                            <ShieldAlert className="w-3 h-3" />
                            Developer (Super Admin)
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            Class Owner (Full Software Access)
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.isActive ? (
                          <Badge variant="success" className="text-[10px] py-0">Active</Badge>
                        ) : (
                          <Badge variant="danger" className="text-[10px] py-0">Disabled</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPasswordModalUser(u)
                            setNewPassword('')
                          }}
                          className="h-7 px-2.5 text-xs gap-1 font-medium"
                        >
                          <KeyRound className="w-3 h-3 text-primary" />
                          Change Password
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: Change Password */}
      <Dialog
        open={!!passwordModalUser}
        onOpenChange={(open) => !open && setPasswordModalUser(null)}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <KeyRound className="w-5 h-5 text-primary" />
              Change Password for {passwordModalUser?.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Assign a new login password for username: <span className="font-mono font-bold">{passwordModalUser?.username}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">New Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground pointer-events-none" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter at least 6 characters"
                  className="pl-9 pr-9 text-xs h-9"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              The user can immediately log in with this new password. No email confirmation required.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPasswordModalUser(null)}
              disabled={updatePasswordMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (passwordModalUser && newPassword.length >= 6) {
                  updatePasswordMutation.mutate({
                    userId: passwordModalUser.id,
                    newPassword,
                  })
                } else {
                  notify('error', 'Password must be at least 6 characters.')
                }
              }}
              disabled={updatePasswordMutation.isPending || newPassword.length < 6}
              className="gap-1 font-semibold"
            >
              <KeyRound className="w-3.5 h-3.5" />
              {updatePasswordMutation.isPending ? 'Updating...' : 'Set New Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
