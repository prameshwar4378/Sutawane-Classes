import React, { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useApp } from '@/context/AppContext'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  CreditCard,
  IndianRupee,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  User,
  Building2,
  Clock,
  Sparkles,
  Receipt,
} from 'lucide-react'
import {
  formatCurrency,
  numberToWordsINR,
  getTodayDateString,
  toInputDateString,
} from '@/lib/utils'
import type { ReceiptData } from '@/components/FeeReceiptModal'

interface CollectFeeModalProps {
  isOpen: boolean
  onClose: () => void
  studentId: string
  initialAdmissionId?: string
  initialPreviousDueId?: string
  initialAmount?: number | string
  onPaymentSuccess?: (receiptData: ReceiptData) => void
}

export const CollectFeeModal: React.FC<CollectFeeModalProps> = ({
  isOpen,
  onClose,
  studentId,
  initialAdmissionId,
  initialPreviousDueId,
  initialAmount,
  onPaymentSuccess,
}) => {
  const queryClient = useQueryClient()
  const { currentBranch, selectedSessionId } = useApp()

  // Target selection: 'ADMISSION' | 'PREVIOUS_DUE'
  const [targetType, setTargetType] = useState<'ADMISSION' | 'PREVIOUS_DUE'>('ADMISSION')
  const [selectedAdmissionId, setSelectedAdmissionId] = useState<string>('')
  const [selectedPreviousDueId, setSelectedPreviousDueId] = useState<string>('')

  // Form Fields
  const [paymentDate, setPaymentDate] = useState<string>(() => getTodayDateString())
  const [amount, setAmount] = useState<string>('')
  const [paymentMode, setPaymentMode] = useState<string>('UPI')
  const [referenceNumber, setReferenceNumber] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [nextDueDate, setNextDueDate] = useState<string>('')

  // Feedback states
  const [formError, setFormError] = useState<string>('')
  const [duplicateWarning, setDuplicateWarning] = useState<any>(null)

  // Fetch student detailed profile
  const { data: studentProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['student-fee-profile-modal', studentId, selectedAdmissionId, selectedSessionId],
    queryFn: () =>
      api.get(`/students/${studentId}`, {
        admissionId: selectedAdmissionId || undefined,
        sessionId: selectedSessionId !== 'ALL' && selectedSessionId ? selectedSessionId : undefined,
      }),
    enabled: Boolean(isOpen && studentId),
  })

  // Initialize or reset form state whenever modal opens or props change
  useEffect(() => {
    if (isOpen) {
      setPaymentDate(getTodayDateString())
      setReferenceNumber('')
      setNotes('')
      setFormError('')
      setDuplicateWarning(null)

      if (initialPreviousDueId) {
        setTargetType('PREVIOUS_DUE')
        setSelectedPreviousDueId(initialPreviousDueId)
      } else {
        setTargetType('ADMISSION')
        if (initialAdmissionId) {
          setSelectedAdmissionId(initialAdmissionId)
        }
      }

      if (initialAmount && Number(initialAmount) > 0) {
        setAmount(String(Number(initialAmount)))
      }
    }
  }, [isOpen, initialAdmissionId, initialPreviousDueId, initialAmount])

  // Sync admission & default amount once studentProfile loads
  useEffect(() => {
    if (isOpen && studentProfile) {
      if (targetType === 'ADMISSION' && !selectedAdmissionId) {
        if (studentProfile.currentAdmission?.id) {
          setSelectedAdmissionId(studentProfile.currentAdmission.id)
        }
      }

      // If amount not explicitly given via props, compute live pending balance
      if (!initialAmount || Number(initialAmount) <= 0) {
        let livePending = 0
        if (targetType === 'PREVIOUS_DUE' && selectedPreviousDueId) {
          const prevDue = (studentProfile.previousSessionDues || []).find(
            (d: any) => d.id === selectedPreviousDueId
          )
          livePending = prevDue ? prevDue.balanceRemaining : 0
        } else {
          const adm = selectedAdmissionId
            ? studentProfile.allAdmissions?.find((a: any) => a.id === selectedAdmissionId) || studentProfile.currentAdmission
            : studentProfile.currentAdmission
          livePending =
            adm?.pendingFees ??
            studentProfile.feeSummary?.overallPendingAmount ??
            studentProfile.feeSummary?.totalPending ??
            0
        }
        if (livePending > 0) {
          setAmount(String(livePending))
        }
      }

      // Sync Next Due Date suggestion
      if (studentProfile.nextDueDate) {
        setNextDueDate(toInputDateString(studentProfile.nextDueDate))
      } else if (studentProfile.dueDate) {
        setNextDueDate(toInputDateString(studentProfile.dueDate))
      } else {
        const d = new Date()
        d.setDate(d.getDate() + 30)
        setNextDueDate(toInputDateString(d))
      }
    }
  }, [isOpen, studentProfile, selectedAdmissionId, selectedPreviousDueId, targetType, initialAmount])

  // Target Admission or Due info
  const targetAdmission = useMemo(() => {
    if (!studentProfile) return null
    if (selectedAdmissionId) {
      return (
        studentProfile.allAdmissions?.find((a: any) => a.id === selectedAdmissionId) ||
        studentProfile.currentAdmission
      )
    }
    return studentProfile.currentAdmission
  }, [studentProfile, selectedAdmissionId])

  const targetPreviousDue = useMemo(() => {
    if (!studentProfile || targetType !== 'PREVIOUS_DUE' || !selectedPreviousDueId) return null
    return (studentProfile.previousSessionDues || []).find(
      (d: any) => d.id === selectedPreviousDueId
    )
  }, [studentProfile, targetType, selectedPreviousDueId])

  // Calculate live remaining due for selected target
  const remainingDue = useMemo(() => {
    if (targetType === 'PREVIOUS_DUE' && targetPreviousDue) {
      return targetPreviousDue.balanceRemaining || 0
    }
    if (targetAdmission) {
      return targetAdmission.pendingFees ?? 0
    }
    return (
      studentProfile?.feeSummary?.totalPending ??
      studentProfile?.feeSummary?.overallPendingAmount ??
      0
    )
  }, [targetType, targetPreviousDue, targetAdmission, studentProfile])

  // Payment Mutation
  const recordPaymentMutation = useMutation({
    mutationFn: (data: any) => api.post('/fees/payments', data),
    onSuccess: (res: any) => {
      const payment = res.payment
      const nextRemaining = Math.max(0, Math.round(res.remainingBalance ?? 0))

      const generatedReceipt: ReceiptData = {
        receiptNumber: payment.receiptNumber,
        paymentDate: payment.paymentDate,
        totalAmount: payment.totalAmount,
        paymentMode: payment.paymentMode,
        referenceNumber: payment.referenceNumber,
        notes: payment.notes,
        isReversed: false,
        studentName: res.studentName || studentProfile?.fullName,
        studentCode: res.studentCode || studentProfile?.studentCode,
        rollNumber: res.rollNumber || targetAdmission?.rollNumber,
        standard: res.standard || targetAdmission?.standard,
        branchName: currentBranch?.name || targetAdmission?.branchName,
        remainingBalance: nextRemaining,
        parentPhone: res.parentPhone || studentProfile?.parentPhone,
        studentPhone: res.studentPhone || studentProfile?.studentPhone,
      }

      // Invalidate relevant query caches
      queryClient.invalidateQueries({ queryKey: ['student-profile', studentId] })
      queryClient.invalidateQueries({ queryKey: ['student-fee-profile', studentId] })
      queryClient.invalidateQueries({ queryKey: ['student-fee-profile-modal', studentId] })
      queryClient.invalidateQueries({ queryKey: ['students'] })
      queryClient.invalidateQueries({ queryKey: ['financial-stats'] })
      queryClient.invalidateQueries({ queryKey: ['dues'] })
      queryClient.invalidateQueries({ queryKey: ['dues-register-all'] })
      queryClient.invalidateQueries({ queryKey: ['recent-payments-register'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] })

      onClose()

      if (onPaymentSuccess) {
        onPaymentSuccess(generatedReceipt)
      }
    },
    onError: (err: any) => {
      if (err?.data?.warning === 'POTENTIAL_DUPLICATE') {
        setDuplicateWarning({
          message: err.message,
          data: {
            studentId,
            admissionId: targetType === 'ADMISSION' ? selectedAdmissionId || undefined : undefined,
            previousDueId: targetType === 'PREVIOUS_DUE' ? selectedPreviousDueId || undefined : undefined,
            amount: Number(amount),
            paymentDate,
            paymentMode,
            referenceNumber,
            notes,
            nextDueDate: nextDueDate || undefined,
            allowDuplicate: true,
          },
        })
      } else {
        setFormError(err.message || 'Failed to record fee payment')
      }
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    const numAmount = Number(amount)
    if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
      setFormError('Please enter a valid payment amount greater than ₹0.')
      return
    }

    if (numAmount > remainingDue) {
      setFormError(`Entered amount (₹${numAmount.toLocaleString('en-IN')}) exceeds the remaining balance of ₹${remainingDue.toLocaleString('en-IN')}.`)
      return
    }

    recordPaymentMutation.mutate({
      studentId,
      admissionId: targetType === 'ADMISSION' ? selectedAdmissionId || undefined : undefined,
      previousDueId: targetType === 'PREVIOUS_DUE' ? selectedPreviousDueId || undefined : undefined,
      amount: numAmount,
      paymentDate: paymentDate || undefined,
      paymentMode,
      referenceNumber: referenceNumber.trim() || undefined,
      notes: notes.trim() || undefined,
      nextDueDate: nextDueDate || undefined,
    })
  }

  if (!isOpen) return null

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[92vh] overflow-y-auto p-5 sm:p-7 rounded-2xl border-emerald-500/30 shadow-2xl">
          <DialogHeader className="space-y-2 pb-3 border-b text-left">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 border border-emerald-300 dark:border-emerald-800 shadow-xs">
                <CreditCard className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                    Receive Fee Payment &amp; Generate Receipt
                  </DialogTitle>
                  <Badge variant="outline" className="text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-[11px] font-semibold">
                    Instant Ledger Update
                  </Badge>
                </div>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5 truncate">
                  Record official fee payment for{' '}
                  <strong className="text-foreground font-semibold">
                    {studentProfile?.fullName || 'Student'}
                  </strong>{' '}
                  ({studentProfile?.studentCode || '—'} | Roll: {targetAdmission?.rollNumber || studentProfile?.currentAdmission?.rollNumber || '—'})
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {isLoadingProfile ? (
            <div className="py-16 text-center space-y-2">
              <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-muted-foreground font-medium">Loading live student fee ledger...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
              {/* Validation / API Error Banner */}
              {formError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl flex items-start gap-2.5 text-xs animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span className="font-medium leading-relaxed">{formError}</span>
                </div>
              )}

              {/* Student Ledger Financial Summary Ribbon */}
              <div className="p-3 bg-muted/40 rounded-xl border grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs shadow-xs">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Agreed Fee:</span>
                  <span className="font-bold text-foreground text-sm">
                    {formatCurrency(studentProfile?.feeSummary?.netPayable ?? targetAdmission?.feePlan?.netPayable ?? 0)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Total Paid:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                    {formatCurrency(studentProfile?.feeSummary?.totalPaid ?? targetAdmission?.paidFees ?? 0)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Remaining Due:</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400 text-sm">
                    {formatCurrency(remainingDue)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Total Outstanding:</span>
                  <span className="font-bold text-amber-700 dark:text-amber-300 text-sm">
                    {formatCurrency(studentProfile?.feeSummary?.overallPendingAmount ?? remainingDue)}
                  </span>
                </div>
              </div>

              {/* Multi-Session / Previous Dues Target Selector */}
              {studentProfile &&
                ((studentProfile.allAdmissions && studentProfile.allAdmissions.length > 1) ||
                  (studentProfile.previousSessionDues && studentProfile.previousSessionDues.length > 0)) && (
                  <div className="p-3 bg-muted/20 border rounded-xl space-y-1.5 text-xs">
                    <label className="font-semibold text-foreground flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                      <span>Select Payment Target (Session / Carried Due):</span>
                    </label>
                    <select
                      value={
                        targetType === 'PREVIOUS_DUE'
                          ? `PREV_${selectedPreviousDueId}`
                          : selectedAdmissionId || studentProfile.currentAdmission?.id || ''
                      }
                      onChange={(e) => {
                        const val = e.target.value
                        if (val.startsWith('PREV_')) {
                          setTargetType('PREVIOUS_DUE')
                          const pId = val.replace('PREV_', '')
                          setSelectedPreviousDueId(pId)
                          const due = studentProfile.previousSessionDues.find((d: any) => d.id === pId)
                          if (due) setAmount(String(due.balanceRemaining))
                        } else {
                          setTargetType('ADMISSION')
                          setSelectedAdmissionId(val)
                          const adm = studentProfile.allAdmissions.find((a: any) => a.id === val)
                          if (adm && adm.pendingFees > 0) {
                            setAmount(String(adm.pendingFees))
                          }
                        }
                      }}
                      className="w-full h-9 rounded-lg border border-input bg-background px-3 text-xs font-medium focus:outline-none cursor-pointer"
                    >
                      <optgroup label="Academic Session Admissions">
                        {studentProfile.allAdmissions?.map((adm: any) => (
                          <option key={adm.id} value={adm.id}>
                            {adm.sessionName} — {adm.standard} ({adm.branchName}) | Due: {formatCurrency(adm.pendingFees)}
                          </option>
                        ))}
                      </optgroup>
                      {studentProfile.previousSessionDues?.filter((d: any) => d.balanceRemaining > 0).length > 0 && (
                        <optgroup label="Carried-Forward Previous Dues">
                          {studentProfile.previousSessionDues
                            .filter((d: any) => d.balanceRemaining > 0)
                            .map((d: any) => (
                              <option key={d.id} value={`PREV_${d.id}`}>
                                Prior Due: {d.originalSessionName || 'Previous'} — Due: {formatCurrency(d.balanceRemaining)}
                              </option>
                            ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                )}

              {/* Amount Received - Prominent Green Card */}
              <div className="p-4 rounded-xl border-2 border-emerald-500 bg-gradient-to-r from-emerald-50/80 via-teal-50/40 to-emerald-50/80 dark:from-emerald-950/40 dark:via-teal-950/20 dark:to-emerald-950/40 shadow-sm space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs sm:text-sm font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                    <IndianRupee className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
                    <span>Amount Received (₹) *</span>
                  </label>
                  {remainingDue > 0 && (
                    <button
                      type="button"
                      onClick={() => setAmount(String(remainingDue))}
                      className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1 rounded-md shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      Pay Full Due ({formatCurrency(remainingDue)})
                    </button>
                  )}
                </div>

                <div className="relative flex items-center">
                  <span className="absolute left-4 text-3xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400 select-none pointer-events-none">
                    ₹
                  </span>
                  <Input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    min={1}
                    max={remainingDue || undefined}
                    required
                    autoFocus
                    className="pl-12 pr-4 h-14 sm:h-16 text-2xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400 bg-background border-2 border-emerald-500 focus-visible:ring-4 focus-visible:ring-emerald-500/20 rounded-lg shadow-inner tracking-tight"
                  />
                </div>

                {Number(amount) > 0 && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-1 text-xs">
                    <span className="font-bold text-emerald-800 dark:text-emerald-300 capitalize truncate">
                      ₹ {numberToWordsINR(Number(amount))}
                    </span>
                    {remainingDue > 0 && (
                      <span className="font-semibold text-muted-foreground shrink-0">
                        Balance After Payment:{' '}
                        <strong className="text-foreground">
                          {remainingDue - Number(amount) <= 0
                            ? '₹0 (Fully Settled)'
                            : formatCurrency(remainingDue - Number(amount))}
                        </strong>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Payment Date & Payment Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground">
                      Payment Date *
                    </label>
                    <button
                      type="button"
                      onClick={() => setPaymentDate(getTodayDateString())}
                      className="text-[11px] text-primary hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Calendar className="w-3 h-3" />
                      Today
                    </button>
                  </div>
                  <Input
                    type="date"
                    value={paymentDate || getTodayDateString()}
                    onChange={(e) => setPaymentDate(e.target.value || getTodayDateString())}
                    required
                    className="text-xs h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Payment Mode *
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs font-medium focus:outline-none cursor-pointer"
                  >
                    <option value="UPI">UPI (GPay, PhonePe, Paytm, QR)</option>
                    <option value="CASH">Cash in Hand</option>
                    <option value="BANK_TRANSFER">Bank Transfer (NEFT/IMPS/RTGS)</option>
                    <option value="CHEQUE">Bank Cheque</option>
                    <option value="OTHER">Other Mode</option>
                  </select>
                </div>
              </div>

              {/* Transaction Ref & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Transaction Ref / UTR / Cheque No. (Optional)
                  </label>
                  <Input
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="e.g. UPI Ref 3291823901"
                    className="text-xs h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Payment Notes / Remarks (Optional)
                  </label>
                  <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Part payment, Advance, Final balance"
                    className="text-xs h-9"
                  />
                </div>
              </div>

              {/* Next Fee Due Date for Remaining Balance */}
              {remainingDue > (Number(amount) || 0) && (
                <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-blue-950 dark:text-blue-200 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>Next Fee Due Date for Remaining {formatCurrency(Math.max(0, remainingDue - (Number(amount) || 0)))}</span>
                    </label>
                    <span className="text-[10px] text-muted-foreground">(Optional deadline)</span>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <Input
                      type="date"
                      value={nextDueDate}
                      onChange={(e) => setNextDueDate(e.target.value)}
                      className="text-xs h-9 bg-background flex-1"
                    />
                    <div className="flex items-center gap-1 flex-wrap">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const d = new Date()
                          d.setDate(d.getDate() + 15)
                          setNextDueDate(toInputDateString(d))
                        }}
                        className="h-8 text-[11px] px-2"
                      >
                        +15d
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const d = new Date()
                          d.setDate(d.getDate() + 30)
                          setNextDueDate(toInputDateString(d))
                        }}
                        className="h-8 text-[11px] px-2"
                      >
                        +30d
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const now = new Date()
                          const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
                          setNextDueDate(toInputDateString(lastDay))
                        }}
                        className="h-8 text-[11px] px-2"
                      >
                        Month End
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* If full payment clearing fees notice */}
              {Number(amount) > 0 && remainingDue <= Number(amount) && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-xl flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <span>
                    This payment will clear all fees! The due date will automatically be set to blank (—) with zero overdue warnings.
                  </span>
                </div>
              )}

              {/* Dialog Actions Footer */}
              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-3 border-t mt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={recordPaymentMutation.isPending}
                  className="w-full sm:w-auto text-xs h-10"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={recordPaymentMutation.isPending || remainingDue <= 0 || !Number(amount)}
                  className="w-full sm:w-auto h-10 text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm"
                >
                  <Receipt className="w-4 h-4" />
                  {recordPaymentMutation.isPending
                    ? 'Recording Payment...'
                    : remainingDue <= 0
                    ? 'Fees Already Settled'
                    : 'Confirm Payment & Print Receipt'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Duplicate Payment Warning Confirmation Dialog */}
      {duplicateWarning && (
        <AlertDialog open={Boolean(duplicateWarning)} onOpenChange={() => setDuplicateWarning(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="w-5 h-5" />
                Potential Duplicate Payment Detected
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p>{duplicateWarning.message}</p>
                  <p className="font-semibold text-foreground">
                    Do you still wish to record this payment as a separate valid transaction?
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDuplicateWarning(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  recordPaymentMutation.mutate(duplicateWarning.data)
                  setDuplicateWarning(null)
                }}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                Yes, Record Duplicate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  )
}
