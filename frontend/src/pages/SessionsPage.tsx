import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useApp, type AcademicSession } from '@/context/AppContext'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import {
  CalendarDays,
  Plus,
  Star,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Calendar,
  Users,
  ShieldAlert,
} from 'lucide-react'
import { formatDate, getTodayDateString, toInputDateString } from '@/lib/utils'

export const SessionsPage: React.FC = () => {
  const queryClient = useQueryClient()
  const { refetchMeta } = useApp()

  // Dialog & Modal states
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingSession, setEditingSession] = useState<AcademicSession | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AcademicSession | null>(null)
  const [blockedDeleteSession, setBlockedDeleteSession] = useState<AcademicSession | null>(null)
  const [toastMsg, setToastMsg] = useState('')

  // Form states
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isCurrent, setIsCurrent] = useState(false)
  const [formError, setFormError] = useState('')

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 4500)
  }

  // Fetch all sessions with record counts
  const { data: sessions = [], isLoading } = useQuery<AcademicSession[]>({
    queryKey: ['sessions'],
    queryFn: () => api.get('/sessions'),
  })

  // Create / Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingSession) {
        return api.put(`/sessions/${editingSession.id}`, data)
      } else {
        return api.post('/sessions', data)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      refetchMeta()
      closeDialog()
      showToast(
        editingSession
          ? `Academic session '${name}' updated successfully.`
          : `New academic session '${name}' created successfully.`
      )
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to save session')
    },
  })

  // Set Current mutation
  const setCurrentMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.patch(`/sessions/${id}/set-current`, {})
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      refetchMeta()
      showToast(`Active session switched to '${data.displayName || data.name}'.`)
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to set current session')
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/sessions/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      refetchMeta()
      setDeleteTarget(null)
      showToast('Academic session permanently deleted.')
    },
    onError: (err: any) => {
      setDeleteTarget(null)
      showToast(err.message || 'Failed to delete session')
    },
  })

  const openCreateDialog = () => {
    setEditingSession(null)
    setName('')
    setDisplayName('')
    setStartDate('')
    setEndDate('')
    setIsCurrent(false)
    setFormError('')
    setIsDialogOpen(true)
  }

  const openEditDialog = (s: AcademicSession) => {
    setEditingSession(s)
    setName(s.name)
    setDisplayName(s.displayName)
    setStartDate(toInputDateString(s.startDate))
    setEndDate(toInputDateString(s.endDate))
    setIsCurrent(s.isCurrent)
    setFormError('')
    setIsDialogOpen(true)
  }

  const closeDialog = () => {
    setIsDialogOpen(false)
    setEditingSession(null)
    setFormError('')
  }

  // --- Real-time Date Overlap & Validity Validation ---
  const validationResult = React.useMemo(() => {
    if (!startDate || !endDate) return null

    // 1. Start date must be strictly before End date
    if (startDate >= endDate) {
      return {
        isValid: false,
        message: 'Start Date must be strictly before End Date.',
      }
    }

    // 2. Strict Overlap check against existing sessions (excluding editingSession if editing)
    for (const s of sessions) {
      if (editingSession && s.id === editingSession.id) continue

      const sStart = s.startDate ? s.startDate.split('T')[0] : ''
      const sEnd = s.endDate ? s.endDate.split('T')[0] : ''

      // Two ranges [A, B] and [C, D] overlap if A <= D and B >= C
      if (startDate <= sEnd && endDate >= sStart) {
        return {
          isValid: false,
          message: `Date overlap error: The selected range (${formatDate(startDate)} to ${formatDate(endDate)}) overlaps with existing session '${s.displayName || s.name}' (${formatDate(sStart)} to ${formatDate(sEnd)}). Academic sessions cannot share or overlap dates.`,
          overlappingSession: s,
        }
      }
    }

    return { isValid: true, message: '' }
  }, [startDate, endDate, sessions, editingSession])

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setFormError('Session code is required (e.g. 2026-27)')
      return
    }

    if (!startDate || !endDate) {
      setFormError('Both Start Date and End Date are required.')
      return
    }

    if (validationResult && !validationResult.isValid) {
      setFormError(validationResult.message)
      return
    }

    saveMutation.mutate({
      name: name.trim(),
      displayName: displayName.trim() || `Academic Year ${name.trim()}`,
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      isCurrent,
    })
  }

  // Handle Delete button click with strict data validation
  const handleDeleteClick = (s: AcademicSession) => {
    if (s.isCurrent) {
      showToast('Cannot delete the currently active session. Switch active session first.')
      return
    }

    const admissionsCount = s._count?.admissions || 0
    const feePlansCount = s._count?.feePlans || 0
    const paymentsCount = s._count?.payments || 0
    const hasData = admissionsCount > 0 || feePlansCount > 0 || paymentsCount > 0

    if (hasData) {
      setBlockedDeleteSession(s)
    } else {
      setDeleteTarget(s)
    }
  }

  const currentSession = sessions.find((s) => s.isCurrent)
  const currentSessionAdmissions = currentSession?._count?.admissions || 0

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 p-4 bg-foreground text-background rounded-xl shadow-xl flex items-center gap-2 text-sm font-medium animate-in fade-in slide-in-from-bottom-4 border">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {toastMsg}
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-emerald-600" />
            Academic Session Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage academic batches (2026–27, 2027–28). Historical records and audit ledgers are permanently preserved.
          </p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2 shadow-sm">
          <Plus className="w-4 h-4" />
          Create New Session
        </Button>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total Configured Sessions */}
        <Card className="p-3 bg-card border shadow-sm">
          <div className="text-[11px] font-semibold text-muted-foreground flex items-center justify-between">
            <span>Configured Academic Years</span>
            <Calendar className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground mt-1">{sessions.length} Batches</div>
          <p className="text-[10px] text-muted-foreground mt-0.5">All configured sessions</p>
        </Card>

        {/* Current Active Session */}
        <Card className="p-3 bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/40 shadow-sm">
          <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
            <span>Current Active Session</span>
            <Star className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1 truncate">
            {currentSession ? currentSession.displayName || currentSession.name : 'None Selected'}
          </div>
          <p className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">
            Default operational academic year
          </p>
        </Card>

        {/* Students Enrolled in Active Session */}
        <Card className="p-3 bg-card border shadow-sm">
          <div className="text-[11px] font-semibold text-muted-foreground flex items-center justify-between">
            <span>Active Session Enrollments</span>
            <Users className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-foreground mt-1">
            {currentSessionAdmissions} Students
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Enrolled in active session</p>
        </Card>
      </div>

      {/* Main Sessions Table Card */}
      <Card className="shadow-sm overflow-hidden">
        <CardHeader className="py-3.5 px-4 bg-muted/20 border-b flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <span>Configured Academic Sessions</span>
            <Badge variant="outline" className="text-xs font-normal">
              {sessions.length} Recorded
            </Badge>
          </CardTitle>
          <div className="text-xs text-muted-foreground">
            Strict overlap prevention enabled
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Loading academic sessions...</p>
          ) : sessions.length === 0 ? (
            <div className="py-12 text-center border-dashed m-4 rounded-xl border">
              <CalendarDays className="w-12 h-12 text-muted-foreground mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold text-foreground">No academic sessions found</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Create your first academic session (e.g., 2026–27) to begin tracking admissions and fees.
              </p>
              <Button onClick={openCreateDialog} size="sm" className="mt-3 gap-1.5 text-xs">
                <Plus className="w-3.5 h-3.5" />
                Create Session
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="w-full">
                <TableHeader className="bg-[#28375C] text-white">
                  <TableRow className="border-b border-[#1b2640] hover:bg-[#28375C] bg-[#28375C]">
                    <TableHead className="whitespace-nowrap text-white">Session Code</TableHead>
                    <TableHead className="min-w-[180px] text-white">Display Title</TableHead>
                    <TableHead className="whitespace-nowrap text-white">Start Date</TableHead>
                    <TableHead className="whitespace-nowrap text-white">End Date</TableHead>
                    <TableHead className="whitespace-nowrap text-center text-white">Linked Records</TableHead>
                    <TableHead className="whitespace-nowrap text-center text-white">Status</TableHead>
                    <TableHead className="text-right whitespace-nowrap pr-4 text-white font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((s) => {
                    const admissionsCount = s._count?.admissions || 0
                    const feePlansCount = s._count?.feePlans || 0
                    const paymentsCount = s._count?.payments || 0
                    const hasData = admissionsCount > 0 || feePlansCount > 0 || paymentsCount > 0

                    return (
                      <TableRow key={s.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="font-mono font-bold text-foreground whitespace-nowrap">
                          {s.name}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {s.displayName}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap font-medium text-muted-foreground">
                          {formatDate(s.startDate)}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap font-medium text-muted-foreground">
                          {formatDate(s.endDate)}
                        </TableCell>
                        <TableCell className="text-center whitespace-nowrap">
                          {hasData ? (
                            <Badge variant="outline" className="text-xs font-mono bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 border-blue-200">
                              {admissionsCount} Students
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground font-mono">0 records (Empty)</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center whitespace-nowrap">
                          {s.isCurrent ? (
                            <Badge variant="success" className="gap-1 shadow-sm font-semibold">
                              <Star className="w-3 h-3 fill-current" />
                              Current Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs font-normal">
                              Archive / Past
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap pr-4">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Set as Current Action */}
                            {!s.isCurrent && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentMutation.mutate(s.id)}
                                disabled={setCurrentMutation.isPending}
                                className="h-7 px-2 text-xs gap-1 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                title="Set as default current active session"
                              >
                                <Star className="w-3 h-3" />
                                <span>Set Active</span>
                              </Button>
                            )}

                            {/* Edit Action */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(s)}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                              title="Edit Academic Session"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>

                            {/* Delete Action (Strict Data Protection) */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(s)}
                              disabled={s.isCurrent}
                              className={`h-7 w-7 p-0 ${
                                s.isCurrent
                                  ? 'opacity-30 cursor-not-allowed'
                                  : hasData
                                  ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                                  : 'text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                              }`}
                              title={
                                s.isCurrent
                                  ? 'Active session cannot be deleted'
                                  : hasData
                                  ? 'Protected session: Contains active student & fee records'
                                  : 'Delete empty session'
                              }
                            >
                              {hasData ? (
                                <Lock className="w-3.5 h-3.5" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog for Add / Edit Session */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-primary" />
                {editingSession ? 'Edit Academic Session' : 'Create New Academic Session'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4 text-xs">
              {/* Form API Error */}
              {formError && (
                <div className="p-3 bg-destructive/10 text-destructive text-xs rounded-md flex items-start gap-2 border border-destructive/20">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Real-time Overlap Warning Message */}
              {validationResult && !validationResult.isValid && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-md border border-rose-200 dark:border-rose-900/50 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-xs">Invalid Session Dates</p>
                    <p className="text-[11px] leading-relaxed">{validationResult.message}</p>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Session Code (e.g. 2027-28) *
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="2027-28"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Display Label</label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Academic Year 2027–2028"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground">Start Date *</label>
                    <button
                      type="button"
                      onClick={() => setStartDate(getTodayDateString())}
                      className="text-[10px] text-primary hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                    >
                      Today
                    </button>
                  </div>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                  {startDate && (
                    <span className="text-[10px] text-muted-foreground block">
                      {formatDate(startDate)}
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">End Date *</label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                  {endDate && (
                    <span className="text-[10px] text-muted-foreground block">
                      {formatDate(endDate)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isCurrent"
                  checked={isCurrent}
                  onChange={(e) => setIsCurrent(e.target.checked)}
                  className="rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                />
                <label htmlFor="isCurrent" className="text-xs text-foreground cursor-pointer select-none">
                  Set this as the current active academic session
                </label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog} size="sm">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveMutation.isPending || Boolean(validationResult && !validationResult.isValid)}
                size="sm"
              >
                {saveMutation.isPending
                  ? 'Saving...'
                  : editingSession
                  ? 'Update Session'
                  : 'Create Session'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog (For Empty Sessions) */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Delete Academic Session?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs space-y-2">
              <p>
                Are you sure you want to permanently delete academic session{' '}
                <strong className="text-foreground">"{deleteTarget?.displayName || deleteTarget?.name}"</strong>?
              </p>
              <p className="text-emerald-600 font-medium">
                ✓ Verified: This session contains 0 student enrollments and 0 fee records, so it is safe to remove.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Blocked Deletion Alert Dialog (When Session Has Data) */}
      <AlertDialog
        open={Boolean(blockedDeleteSession)}
        onOpenChange={() => setBlockedDeleteSession(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-amber-600 flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Session Protected From Deletion
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs space-y-2.5">
              <p>
                Academic session{' '}
                <strong className="text-foreground">
                  "{blockedDeleteSession?.displayName || blockedDeleteSession?.name}"
                </strong>{' '}
                cannot be deleted because it contains active linked records:
              </p>
              <div className="p-3 bg-muted/40 rounded-lg border space-y-1 font-mono text-[11px]">
                <p>• Student Admissions: <strong>{blockedDeleteSession?._count?.admissions || 0}</strong></p>
                <p>• Fee Plans: <strong>{blockedDeleteSession?._count?.feePlans || 0}</strong></p>
                <p>• Payment Receipts: <strong>{blockedDeleteSession?._count?.payments || 0}</strong></p>
              </div>
              <p className="text-muted-foreground text-[11px]">
                Historical academic sessions must be preserved to guarantee financial audit integrity and permanent student educational records.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setBlockedDeleteSession(null)}>
              Understood
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default SessionsPage
