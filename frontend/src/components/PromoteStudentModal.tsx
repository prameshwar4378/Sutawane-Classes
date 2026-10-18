import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useApp } from '@/context/AppContext'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Sparkles,
  ArrowRight,
  GraduationCap,
  Building2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  IndianRupee,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface PromoteStudentModalProps {
  isOpen: boolean
  onClose: () => void
  studentId: string
  studentName: string
  currentAdmission: any
  onSuccess: (msg: string) => void
}

export const PromoteStudentModal: React.FC<PromoteStudentModalProps> = ({
  isOpen,
  onClose,
  studentId,
  studentName,
  currentAdmission,
  onSuccess,
}) => {
  const queryClient = useQueryClient()
  const { branches, sessions, courses, activeCourses } = useApp()

  // Form states
  const [targetSessionId, setTargetSessionId] = useState('')
  const [targetBranchId, setTargetBranchId] = useState('')
  const [targetStandard, setTargetStandard] = useState('')
  const [newRollNumber, setNewRollNumber] = useState('')
  const [newTotalFees, setNewTotalFees] = useState('30000')
  const [carryForwardDue, setCarryForwardDue] = useState(true)
  const [dueNotes, setDueNotes] = useState('')
  const [formError, setFormError] = useState('')

  // Auto-select next session when modal opens
  useEffect(() => {
    if (isOpen && sessions.length > 0) {
      // Find a session different from current admission session
      const currentSessionId = currentAdmission?.session?.id
      const nextSession = sessions.find((s) => s.id !== currentSessionId) || sessions[0]
      if (nextSession) {
        setTargetSessionId(nextSession.id)
      }
      if (currentAdmission?.branch?.id) {
        setTargetBranchId(currentAdmission.branch.id)
      }
    }
  }, [isOpen, sessions, currentAdmission])

  // Fetch promotion preview from backend
  const { data: preview, isLoading: isLoadingPreview } = useQuery({
    queryKey: ['promotion-preview', studentId, targetSessionId],
    queryFn: () =>
      api.get(`/students/${studentId}/promotion-preview`, {
        targetSessionId: targetSessionId || undefined,
      }),
    enabled: Boolean(isOpen && studentId),
  })

  // Pre-fill form when preview arrives
  useEffect(() => {
    if (preview) {
      if (preview.suggestedStandard) {
        setTargetStandard(preview.suggestedStandard)
      }
      if (preview.suggestedRoll) {
        setNewRollNumber(preview.suggestedRoll)
      }
      if (preview.suggestedFees) {
        setNewTotalFees(String(preview.suggestedFees))
      }
      if (preview.currentPendingDue > 0) {
        setDueNotes(
          `Carried forward due from ${currentAdmission?.session?.name || 'previous session'} (${currentAdmission?.standard || ''})`
        )
      }
    }
  }, [preview, currentAdmission])

  // Mutation to execute promotion
  const promoteMutation = useMutation({
    mutationFn: (data: any) => api.post(`/students/${studentId}/promote`, data),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['student-profile', studentId] })
      queryClient.invalidateQueries({ queryKey: ['students'] })
      queryClient.invalidateQueries({ queryKey: ['financial-stats'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      onSuccess(
        res.message ||
          `Successfully promoted ${studentName} to ${targetStandard} for next session!`
      )
      onClose()
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to promote student.')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    if (!targetSessionId) {
      setFormError('Please select a target academic session.')
      return
    }

    if (!targetStandard.trim()) {
      setFormError('Please specify the standard/class for the next session.')
      return
    }

    if (!newRollNumber.trim()) {
      setFormError('Please enter a roll number for the new session.')
      return
    }

    const fees = Number(newTotalFees)
    if (isNaN(fees) || fees < 0) {
      setFormError('Please provide a valid total fee commitment.')
      return
    }

    promoteMutation.mutate({
      targetSessionId,
      targetBranchId: targetBranchId || currentAdmission?.branchId,
      targetStandard: targetStandard.trim(),
      newRollNumber: newRollNumber.trim(),
      newTotalFees: fees,
      carryForwardDue,
      dueNotes: dueNotes.trim() || undefined,
    })
  }

  const isAlreadyPromoted = preview?.isAlreadyPromoted || false
  const currentPendingDue = preview?.currentPendingDue || 0

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Promote Student to Next Academic Session
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs">
            {formError && (
              <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Current Session Summary Card */}
            <div className="bg-muted/40 border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between font-semibold text-sm text-foreground">
                <span className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-primary" />
                  {studentName}
                </span>
                <Badge variant="outline">
                  Roll: {currentAdmission?.rollNumber || '—'}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-muted-foreground pt-1 border-t text-[11px]">
                <div>
                  Current Session:{' '}
                  <span className="font-semibold text-foreground">
                    {currentAdmission?.session?.displayName || currentAdmission?.session?.name || '—'}
                  </span>
                </div>
                <div>
                  Current Class:{' '}
                  <span className="font-semibold text-foreground">
                    {currentAdmission?.standard || '—'}
                  </span>
                </div>
                <div>
                  Branch:{' '}
                  <span className="font-semibold text-foreground">
                    {currentAdmission?.branch?.name || '—'}
                  </span>
                </div>
                <div>
                  Current Dues:{' '}
                  <span
                    className={`font-semibold ${
                      currentPendingDue > 0 ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  >
                    {formatCurrency(currentPendingDue)}
                  </span>
                </div>
              </div>
            </div>

            {/* Target Session Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  Target Academic Session *
                </label>
                <select
                  value={targetSessionId}
                  onChange={(e) => setTargetSessionId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none"
                  required
                >
                  <option value="">Select Target Session</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.displayName || s.name} {s.isCurrent ? '(Current)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-primary" />
                  Target Branch *
                </label>
                <select
                  value={targetBranchId}
                  onChange={(e) => setTargetBranchId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none"
                  required
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Check already promoted warning */}
            {isAlreadyPromoted && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Student is already admitted in this session!</p>
                  <p className="text-[11px] mt-0.5">
                    {studentName} already has an active admission record for the selected academic session. Please pick a different session.
                  </p>
                </div>
              </div>
            )}

            {/* Target Standard and Roll Number */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">
                  Promoted Standard / Class *
                </label>
                <select
                  value={targetStandard}
                  onChange={(e) => {
                    const val = e.target.value
                    setTargetStandard(val)
                    const matched = courses.find((c) => c.name === val)
                    if (matched?.defaultFee) {
                      setNewTotalFees(String(matched.defaultFee))
                    }
                  }}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none"
                  required
                >
                  <option value="">-- Select Class / Course --</option>
                  {targetStandard && !courses.some((c) => c.name.toLowerCase() === targetStandard.toLowerCase()) && (
                    <option value={targetStandard}>{targetStandard} (Suggested)</option>
                  )}
                  {courses.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name} {c.code ? `(${c.code})` : ''} {c.defaultFee ? `· ₹${c.defaultFee.toLocaleString('en-IN')}` : ''} {!c.isActive ? '(Archived)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">
                  New Session Roll Number *
                </label>
                <Input
                  value={newRollNumber}
                  onChange={(e) => setNewRollNumber(e.target.value)}
                  placeholder="e.g. SC-101-N"
                  required
                />
              </div>
            </div>

            {/* New Session Total Fees */}
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground flex items-center justify-between">
                <span>Agreed Total Fees for New Session (₹) *</span>
                <span className="text-[11px] text-emerald-600 font-medium">
                  Flexible payment (any amount, anytime)
                </span>
              </label>
              <Input
                type="number"
                min="0"
                step="500"
                value={newTotalFees}
                onChange={(e) => setNewTotalFees(e.target.value)}
                placeholder="30000"
                required
              />
            </div>

            {/* Outstanding Balance Carry-Forward Section */}
            {currentPendingDue > 0 ? (
              <div className="p-3 border rounded-lg bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 font-semibold">
                    <IndianRupee className="w-4 h-4" />
                    <span>Unpaid Dues from Current Session: {formatCurrency(currentPendingDue)}</span>
                  </div>
                  <Badge variant="danger">Pending Balance</Badge>
                </div>

                <p className="text-[11px] text-muted-foreground">
                  By default, this unpaid balance is carried forward into a dedicated{' '}
                  <span className="font-semibold text-foreground">PreviousSessionDue</span> record.
                  It will not alter the new session's agreed fee structure.
                </p>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="carryForwardDue"
                    checked={carryForwardDue}
                    onChange={(e) => setCarryForwardDue(e.target.checked)}
                    className="w-4 h-4 rounded text-primary border-gray-300 focus:ring-primary cursor-pointer"
                  />
                  <label
                    htmlFor="carryForwardDue"
                    className="font-medium text-foreground cursor-pointer select-none"
                  >
                    Carry forward unpaid dues ({formatCurrency(currentPendingDue)}) to next session
                  </label>
                </div>

                {carryForwardDue && (
                  <div className="pt-1.5">
                    <Input
                      value={dueNotes}
                      onChange={(e) => setDueNotes(e.target.value)}
                      placeholder="Due reference / description..."
                      className="text-xs h-8 bg-background"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 border rounded-lg bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>Zero pending dues! Student has cleared all previous fee obligations.</span>
              </div>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={promoteMutation.isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isAlreadyPromoted || promoteMutation.isPending || isLoadingPreview}
              className="gap-2 bg-primary"
            >
              <Sparkles className="w-4 h-4" />
              {promoteMutation.isPending ? 'Promoting Student...' : 'Confirm Promotion'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
