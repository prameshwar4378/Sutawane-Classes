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
  Trash2,
  Database,
  GraduationCap,
  Receipt,
  BookOpen,
  CalendarDays,
  Building2,
  Activity,
  Check,
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

  // State for Database Purge Console (Developer Only)
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false)
  const [confirmPurgeText, setConfirmPurgeText] = useState('')
  const [purgeOptions, setPurgeOptions] = useState({
    purgeStudents: true,
    purgeFees: true,
    purgeExpenses: true,
    purgeCourses: false,
    purgeSessions: false,
    purgeBranches: false,
    purgeHealthLogs: true,
  })

  // Fetch Database Live Statistics for Purge Modal
  const { data: statsData, refetch: refetchStats } = useQuery({
    queryKey: ['developer-data-stats'],
    queryFn: () => api.get('/auth/developer/data-stats'),
    enabled: isPurgeModalOpen,
  })

  const stats = statsData?.stats || {}

  // Mutation: Purge Selected Data
  const purgeMutation = useMutation({
    mutationFn: (options: typeof purgeOptions) => api.post('/auth/developer/purge-data', options),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries()
      refetchStats()
      setIsPurgeModalOpen(false)
      setConfirmPurgeText('')
      notify('success', res.message || 'Selected records purged successfully.')
    },
    onError: (err: any) => {
      notify('error', err.message || 'Failed to purge database records.')
    },
  })

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

      {/* Danger Zone: Selective Database Wipe & Factory Reset (Developer Confidential) */}
      <Card className="border border-rose-500/50 bg-rose-50/20 dark:bg-rose-950/10 shadow-sm">
        <CardHeader className="py-4 border-b border-rose-200/60 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-rose-100 text-rose-800 border-rose-300 font-extrabold text-[10px] tracking-wider uppercase">
                  Confidential • Developer Only
                </Badge>
              </div>
              <CardTitle className="text-base font-bold text-rose-700 dark:text-rose-400 flex items-center gap-2 mt-1">
                <Trash2 className="w-4 h-4 text-rose-600" />
                Danger Zone: Database Records Purge &amp; Selective Factory Clean
              </CardTitle>
              <CardDescription className="text-xs text-rose-900/80 dark:text-rose-300/80 mt-0.5">
                Permanently purge specific database models (Students, Fees, Expenses, Classes, Sessions, Logs) or perform a full factory clean.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                refetchStats()
                setConfirmPurgeText('')
                setIsPurgeModalOpen(true)
              }}
              className="gap-1.5 text-xs font-bold shrink-0 bg-rose-600 hover:bg-rose-700 text-white shadow-xs h-9 px-4"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Configure &amp; Delete Records...
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-1">
              <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Always Preserved (Guaranteed):
              </span>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 leading-relaxed">
                User Accounts (Class Owner &amp; Developer), Login Passwords, Institute Master Logo, Primary Branch &amp; Core System Configuration are always safe.
              </p>
            </div>
            <div className="p-3 rounded-lg border border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 space-y-1">
              <span className="font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                Selective Record Deletion:
              </span>
              <p className="text-[11px] text-rose-700 dark:text-rose-400 leading-relaxed">
                Choose exactly what to delete—Students, Financial Transactions, Expenses, Courses, Sessions, Logs, or check all for a complete factory clean.
              </p>
            </div>
          </div>
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

      {/* Modal: Selective Database Purge & Factory Clean Console */}
      <Dialog open={isPurgeModalOpen} onOpenChange={setIsPurgeModalOpen}>
        <DialogContent className="sm:max-w-[640px] max-h-[92vh] flex flex-col p-0 border-rose-500/40">
          <DialogHeader className="p-4 sm:p-5 border-b bg-rose-50/40 dark:bg-rose-950/20 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-rose-100 text-rose-800 border-rose-300 text-[10px] font-extrabold uppercase">
                Confidential Action
              </Badge>
            </div>
            <DialogTitle className="text-base font-bold text-rose-700 dark:text-rose-400 flex items-center gap-2 mt-1">
              <Trash2 className="w-5 h-5 text-rose-600" />
              Selective Database Purge &amp; Factory Clean Console
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Mark which models and record categories to permanently delete. Unchecked categories will remain completely untouched.
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto p-4 sm:p-5 space-y-4 flex-1">
            {/* Preset quick selection pills */}
            <div className="flex flex-wrap items-center gap-1.5 p-2 bg-muted/40 rounded-lg border text-xs">
              <span className="text-[11px] font-bold text-muted-foreground mr-1">Quick Select:</span>
              <button
                type="button"
                onClick={() =>
                  setPurgeOptions({
                    purgeStudents: true,
                    purgeFees: true,
                    purgeExpenses: true,
                    purgeCourses: true,
                    purgeSessions: true,
                    purgeBranches: true,
                    purgeHealthLogs: true,
                  })
                }
                className="px-2.5 py-1 rounded bg-rose-100 text-rose-800 hover:bg-rose-200 text-[11px] font-bold cursor-pointer transition-colors"
              >
                Select All (Factory Clean)
              </button>
              <button
                type="button"
                onClick={() =>
                  setPurgeOptions({
                    purgeStudents: true,
                    purgeFees: true,
                    purgeExpenses: true,
                    purgeCourses: false,
                    purgeSessions: false,
                    purgeBranches: false,
                    purgeHealthLogs: true,
                  })
                }
                className="px-2.5 py-1 rounded bg-background border hover:bg-muted text-[11px] font-medium cursor-pointer transition-colors"
              >
                Students &amp; Financials
              </button>
              <button
                type="button"
                onClick={() =>
                  setPurgeOptions({
                    purgeStudents: false,
                    purgeFees: true,
                    purgeExpenses: true,
                    purgeCourses: false,
                    purgeSessions: false,
                    purgeBranches: false,
                    purgeHealthLogs: false,
                  })
                }
                className="px-2.5 py-1 rounded bg-background border hover:bg-muted text-[11px] font-medium cursor-pointer transition-colors"
              >
                Financials Only (Fees + Expenses)
              </button>
              <button
                type="button"
                onClick={() =>
                  setPurgeOptions({
                    purgeStudents: false,
                    purgeFees: false,
                    purgeExpenses: false,
                    purgeCourses: false,
                    purgeSessions: false,
                    purgeBranches: false,
                    purgeHealthLogs: false,
                  })
                }
                className="px-2.5 py-1 rounded bg-background border hover:bg-muted text-[11px] font-medium cursor-pointer transition-colors"
              >
                Clear All
              </button>
            </div>

            {/* Checklist of Models & Record Types */}
            <div className="space-y-2">
              {/* Option 1: Students & Admissions */}
              <label
                className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                  purgeOptions.purgeStudents
                    ? 'border-rose-300 bg-rose-50/50 dark:bg-rose-950/20'
                    : 'border-border bg-card hover:bg-muted/30'
                }`}
              >
                <input
                  type="checkbox"
                  checked={purgeOptions.purgeStudents}
                  onChange={(e) =>
                    setPurgeOptions((prev) => ({ ...prev, purgeStudents: e.target.checked }))
                  }
                  className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 mt-0.5 cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5 text-primary" />
                      Student Profiles, Admissions &amp; Roll Numbers
                    </span>
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono">
                      {stats.studentsCount ?? 0} Students • {stats.admissionsCount ?? 0} Admissions
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    Deletes all student profiles, admission enrollments, roll numbers, student photo files, and previous session dues.
                  </p>
                </div>
              </label>

              {/* Option 2: Fee Collections & Receipts */}
              <label
                className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                  purgeOptions.purgeFees
                    ? 'border-rose-300 bg-rose-50/50 dark:bg-rose-950/20'
                    : 'border-border bg-card hover:bg-muted/30'
                }`}
              >
                <input
                  type="checkbox"
                  checked={purgeOptions.purgeFees}
                  onChange={(e) =>
                    setPurgeOptions((prev) => ({ ...prev, purgeFees: e.target.checked }))
                  }
                  className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 mt-0.5 cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                      Fee Collections, Payment Receipts &amp; Installments
                    </span>
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono">
                      {stats.paymentsCount ?? 0} Receipts / Payments
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    Deletes payment transactions, installment allocations, approved discounts, and resets receipt serial counters to zero.
                  </p>
                </div>
              </label>

              {/* Option 3: Operational Expenses */}
              <label
                className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                  purgeOptions.purgeExpenses
                    ? 'border-rose-300 bg-rose-50/50 dark:bg-rose-950/20'
                    : 'border-border bg-card hover:bg-muted/30'
                }`}
              >
                <input
                  type="checkbox"
                  checked={purgeOptions.purgeExpenses}
                  onChange={(e) =>
                    setPurgeOptions((prev) => ({ ...prev, purgeExpenses: e.target.checked }))
                  }
                  className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 mt-0.5 cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5 text-amber-600" />
                      Operational Expenses &amp; Bill Attachments
                    </span>
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono">
                      {stats.expensesCount ?? 0} Expense Vouchers
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    Deletes all institute expense vouchers, vendor bills, and uploaded attachment documents.
                  </p>
                </div>
              </label>

              {/* Option 4: Classes & Courses */}
              <label
                className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                  purgeOptions.purgeCourses
                    ? 'border-rose-300 bg-rose-50/50 dark:bg-rose-950/20'
                    : 'border-border bg-card hover:bg-muted/30'
                }`}
              >
                <input
                  type="checkbox"
                  checked={purgeOptions.purgeCourses}
                  onChange={(e) =>
                    setPurgeOptions((prev) => ({ ...prev, purgeCourses: e.target.checked }))
                  }
                  className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 mt-0.5 cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                      Classes &amp; Courses Curriculum
                    </span>
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono">
                      {stats.coursesCount ?? 0} Courses
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    Deletes defined courses/standards (e.g., Class 10, Class 12 Science, Foundation).
                  </p>
                </div>
              </label>

              {/* Option 5: Inactive Academic Sessions */}
              <label
                className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                  purgeOptions.purgeSessions
                    ? 'border-rose-300 bg-rose-50/50 dark:bg-rose-950/20'
                    : 'border-border bg-card hover:bg-muted/30'
                }`}
              >
                <input
                  type="checkbox"
                  checked={purgeOptions.purgeSessions}
                  onChange={(e) =>
                    setPurgeOptions((prev) => ({ ...prev, purgeSessions: e.target.checked }))
                  }
                  className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 mt-0.5 cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5 text-purple-600" />
                      Inactive / Archived Academic Sessions
                    </span>
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono">
                      {stats.sessionsCount ?? 0} Sessions Total
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    Purges archived or inactive academic sessions that have no active student admissions. Active session is preserved.
                  </p>
                </div>
              </label>

              {/* Option 6: Empty / Inactive Branches */}
              <label
                className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                  purgeOptions.purgeBranches
                    ? 'border-rose-300 bg-rose-50/50 dark:bg-rose-950/20'
                    : 'border-border bg-card hover:bg-muted/30'
                }`}
              >
                <input
                  type="checkbox"
                  checked={purgeOptions.purgeBranches}
                  onChange={(e) =>
                    setPurgeOptions((prev) => ({ ...prev, purgeBranches: e.target.checked }))
                  }
                  className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 mt-0.5 cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                      Empty / Inactive Branches
                    </span>
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono">
                      {stats.branchesCount ?? 0} Branches Total
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    Purges branch records that contain no active student admissions or expenses. Primary active branch is preserved.
                  </p>
                </div>
              </label>

              {/* Option 7: Health & Audit Logs */}
              <label
                className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                  purgeOptions.purgeHealthLogs
                    ? 'border-rose-300 bg-rose-50/50 dark:bg-rose-950/20'
                    : 'border-border bg-card hover:bg-muted/30'
                }`}
              >
                <input
                  type="checkbox"
                  checked={purgeOptions.purgeHealthLogs}
                  onChange={(e) =>
                    setPurgeOptions((prev) => ({ ...prev, purgeHealthLogs: e.target.checked }))
                  }
                  className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 mt-0.5 cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-teal-600" />
                      System Health &amp; Diagnostic Logs
                    </span>
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono">
                      {stats.healthLogsCount ?? 0} Logs
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    Clears server health checks, connection diagnostic history, and temporary upload caches.
                  </p>
                </div>
              </label>
            </div>

            {/* Preserved Safety Notice */}
            <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">
                <strong>Guaranteed Security:</strong> Class Owner &amp; Developer login credentials, passwords, and institute settings are NEVER deleted.
              </span>
            </div>

            {/* Confirmation Input */}
            <div className="p-3 bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 rounded-lg space-y-1.5 text-xs">
              <label className="font-bold text-rose-800 dark:text-rose-300 block">
                Type <span className="font-mono underline">DELETE</span> to confirm record purge:
              </label>
              <Input
                type="text"
                value={confirmPurgeText}
                onChange={(e) => setConfirmPurgeText(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="text-xs font-mono tracking-widest text-center uppercase bg-white dark:bg-slate-900 border-rose-300 font-bold"
              />
            </div>
          </div>

          <DialogFooter className="p-4 border-t bg-muted/30 flex sm:justify-between items-center gap-2 flex-shrink-0">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {Object.values(purgeOptions).filter(Boolean).length} of 7 categories marked
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPurgeModalOpen(false)}
                disabled={purgeMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={
                  confirmPurgeText.trim().toUpperCase() !== 'DELETE' ||
                  Object.values(purgeOptions).filter(Boolean).length === 0 ||
                  purgeMutation.isPending
                }
                onClick={() => purgeMutation.mutate(purgeOptions)}
                className="gap-1.5 font-bold bg-rose-600 hover:bg-rose-700 text-white"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {purgeMutation.isPending
                  ? 'Purging Records...'
                  : `Confirm & Purge (${Object.values(purgeOptions).filter(Boolean).length} Categories)`}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
