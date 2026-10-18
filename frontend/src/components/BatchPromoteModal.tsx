import React, { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
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
  Users,
  Calendar,
  Building2,
  AlertTriangle,
  CheckCircle2,
  GraduationCap,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface BatchPromoteModalProps {
  isOpen: boolean
  onClose: () => void
  selectedStudents: Array<{
    id: string
    fullName: string
    rollNumber: string
    standard: string
    branchName?: string
    pendingFees?: number
  }>
  onSuccess: (msg: string) => void
}

export const BatchPromoteModal: React.FC<BatchPromoteModalProps> = ({
  isOpen,
  onClose,
  selectedStudents,
  onSuccess,
}) => {
  const queryClient = useQueryClient()
  const { branches, sessions, selectedSessionId, courses, activeCourses } = useApp()

  const [targetSessionId, setTargetSessionId] = useState('')
  const [targetBranchId, setTargetBranchId] = useState('KEEP')
  const [targetStandard, setTargetStandard] = useState('')
  const [defaultTotalFees, setDefaultTotalFees] = useState('30000')
  const [carryForwardDues, setCarryForwardDues] = useState(true)
  const [formError, setFormError] = useState('')
  const [resultSummary, setResultSummary] = useState<any>(null)

  useEffect(() => {
    if (isOpen) {
      if (sessions.length > 0) {
        // Pick next session that is not the current filter session
        const next = sessions.find((s) => s.id !== selectedSessionId) || sessions[0]
        if (next) {
          setTargetSessionId(next.id)
        }
      }

      const defaultCourse = activeCourses[0] || courses[0]
      if (defaultCourse && !targetStandard) {
        setTargetStandard(defaultCourse.name)
        if (defaultCourse.defaultFee) {
          setDefaultTotalFees(String(defaultCourse.defaultFee))
        }
      }

      setResultSummary(null)
      setFormError('')
    }
  }, [isOpen, sessions, selectedSessionId, activeCourses, courses])

  const batchPromoteMutation = useMutation({
    mutationFn: (data: any) => api.post('/students/batch-promote', data),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      queryClient.invalidateQueries({ queryKey: ['financial-stats'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setResultSummary(res)
      onSuccess(
        res.message ||
          `Successfully promoted ${res.promotedCount || selectedStudents.length} students to next session!`
      )
    },
    onError: (err: any) => {
      setFormError(err.message || 'Batch promotion failed.')
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
      setFormError('Please provide target standard/class.')
      return
    }

    const fees = Number(defaultTotalFees)
    if (isNaN(fees) || fees < 0) {
      setFormError('Please provide a valid default fee amount.')
      return
    }

    batchPromoteMutation.mutate({
      studentIds: selectedStudents.map((s) => s.id),
      targetSessionId,
      targetBranchId: targetBranchId === 'KEEP' ? undefined : targetBranchId,
      targetStandard: targetStandard.trim(),
      defaultTotalFees: fees,
      carryForwardDues,
    })
  }

  const totalDuesAcrossSelected = selectedStudents.reduce(
    (sum, s) => sum + (s.pendingFees || 0),
    0
  )

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Batch Promote Students ({selectedStudents.length} Selected)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs">
            {formError && (
              <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {resultSummary && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 rounded-lg space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Promotion Completed!
                </div>
                <p>
                  Promoted {resultSummary.promotedCount} out of {selectedStudents.length} students.
                </p>
                {resultSummary.skippedCount > 0 && (
                  <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                    Skipped {resultSummary.skippedCount} students (already enrolled in target session).
                  </div>
                )}
                <div className="pt-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={onClose}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    Done & Close
                  </Button>
                </div>
              </div>
            )}

            {!resultSummary && (
              <>
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
                      Target Branch
                    </label>
                    <select
                      value={targetBranchId}
                      onChange={(e) => setTargetBranchId(e.target.value)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none"
                    >
                      <option value="KEEP">Keep Respective Student Branches</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          Transfer All to {b.name} ({b.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Target Standard and Default Fee */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5 text-primary" />
                      Promoted Standard / Class *
                    </label>
                    <select
                      value={targetStandard}
                      onChange={(e) => {
                        const val = e.target.value
                        setTargetStandard(val)
                        const matched = courses.find((c) => c.name === val)
                        if (matched?.defaultFee) {
                          setDefaultTotalFees(String(matched.defaultFee))
                        }
                      }}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none"
                      required
                    >
                      <option value="">-- Select Class / Course --</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name} {c.code ? `(${c.code})` : ''} {c.defaultFee ? `· ₹${c.defaultFee.toLocaleString('en-IN')}` : ''} {!c.isActive ? '(Archived)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">
                      Default Total Fees for New Session (₹)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="500"
                      value={defaultTotalFees}
                      onChange={(e) => setDefaultTotalFees(e.target.value)}
                      placeholder="30000"
                      required
                    />
                  </div>
                </div>

                {/* Carry Forward Unpaid Balances Option */}
                <div className="p-3 border rounded-lg bg-muted/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">Unpaid Balances Carry Forward</span>
                    <Badge variant={totalDuesAcrossSelected > 0 ? 'warning' : 'outline'}>
                      Total Dues: {formatCurrency(totalDuesAcrossSelected)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="batchCarryForward"
                      checked={carryForwardDues}
                      onChange={(e) => setCarryForwardDues(e.target.checked)}
                      className="w-4 h-4 rounded text-primary border-gray-300 focus:ring-primary cursor-pointer"
                    />
                    <label
                      htmlFor="batchCarryForward"
                      className="font-medium text-foreground cursor-pointer select-none text-[11px]"
                    >
                      Automatically record previous session outstanding dues in PreviousSessionDue ledger
                    </label>
                  </div>
                </div>

                {/* Selected Students Preview Table */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground flex items-center justify-between">
                    <span>Students Included in Batch ({selectedStudents.length})</span>
                    <span className="text-[11px]">Unique roll numbers will be preserved/generated</span>
                  </label>
                  <div className="max-h-40 overflow-y-auto border rounded-md divide-y bg-background">
                    {selectedStudents.map((s) => (
                      <div
                        key={s.id}
                        className="p-2 flex items-center justify-between text-[11px] hover:bg-muted/30"
                      >
                        <div>
                          <span className="font-semibold text-foreground">{s.fullName}</span>
                          <span className="text-muted-foreground font-mono ml-2">({s.rollNumber})</span>
                          <span className="text-muted-foreground ml-2">| {s.standard}</span>
                        </div>
                        <div>
                          {s.pendingFees && s.pendingFees > 0 ? (
                            <span className="text-rose-600 font-medium">
                              Due: {formatCurrency(s.pendingFees)}
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-medium">Clear</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {!resultSummary && (
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={batchPromoteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={batchPromoteMutation.isPending || selectedStudents.length === 0}
                className="gap-2 bg-primary"
              >
                <Sparkles className="w-4 h-4" />
                {batchPromoteMutation.isPending
                  ? `Promoting ${selectedStudents.length} Students...`
                  : `Promote ${selectedStudents.length} Students`}
              </Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}
