import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useApp } from '@/context/AppContext'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
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
  CreditCard,
  IndianRupee,
  Printer,
  Search,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ClockAlert,
  User,
  History,
  Building2,
} from 'lucide-react'
import { formatCurrency, formatDate, formatDateLong } from '@/lib/utils'
import { FeeReceiptModal, type ReceiptData } from '@/components/FeeReceiptModal'
import { StudentSearchAutocomplete } from '@/components/StudentSearchAutocomplete'

export const CollectFeesPage: React.FC = () => {
  const queryClient = useQueryClient()
  const { selectedBranchId, setSelectedBranchId, branches, currentBranch } = useApp()

  // Active view tab: 'collect' | 'history'
  const [activeTab, setActiveTab] = useState<'collect' | 'history'>('collect')

  // Form states
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentMode, setPaymentMode] = useState('UPI')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [allocationMode, setAllocationMode] = useState<'FIFO' | 'CUSTOM'>('FIFO')

  // Modals & Feedback
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)
  const [duplicateWarning, setDuplicateWarning] = useState<any>(null)
  const [reversalTarget, setReversalTarget] = useState<any>(null)
  const [reversalReason, setReversalReason] = useState('')
  const [formError, setFormError] = useState('')
  const [toastMsg, setToastMsg] = useState('')

  // 1. Fetch Students List
  const { data: students = [], isLoading: isLoadingStudents } = useQuery({
    queryKey: ['students-for-fee-collection', selectedBranchId],
    queryFn: () =>
      api.get('/students', {
        branchId: selectedBranchId !== 'ALL' ? selectedBranchId : undefined,
      }),
  })

  // 2. Fetch Selected Student Details & Installments
  const { data: selectedProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['student-fee-profile', selectedStudentId],
    queryFn: () => api.get(`/students/${selectedStudentId}`),
    enabled: Boolean(selectedStudentId),
  })

  // 3. Fetch Recent Payments Register
  const { data: recentPayments = [], isLoading: isLoadingPayments } = useQuery({
    queryKey: ['recent-payments-register', selectedBranchId],
    queryFn: () =>
      api.get('/fees/payments', {
        branchId: selectedBranchId !== 'ALL' ? selectedBranchId : undefined,
      }),
  })

  // Record Payment Mutation
  const recordPaymentMutation = useMutation({
    mutationFn: (data: any) => api.post('/fees/payments', data),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      queryClient.invalidateQueries({ queryKey: ['financial-stats'] })
      queryClient.invalidateQueries({ queryKey: ['recent-payments-register'] })
      queryClient.invalidateQueries({ queryKey: ['student-fee-profile', selectedStudentId] })

      // Prepare receipt data
      const payment = res.payment
      setReceiptData({
        receiptNumber: payment.receiptNumber,
        paymentDate: payment.paymentDate,
        totalAmount: payment.totalAmount,
        paymentMode: payment.paymentMode,
        referenceNumber: payment.referenceNumber,
        notes: payment.notes,
        isReversed: false,
        studentName: res.studentName,
        studentCode: res.studentCode,
        rollNumber: res.rollNumber,
        standard: res.standard,
        branchName: currentBranch?.name,
        remainingBalance: res.remainingBalance,
      })

      // Reset form
      setAmount('')
      setReferenceNumber('')
      setNotes('')
      setFormError('')
      setDuplicateWarning(null)
      showToast('Payment recorded successfully & receipt generated!')
    },
    onError: (err: any) => {
      if (err?.data?.warning === 'POTENTIAL_DUPLICATE') {
        setDuplicateWarning({
          message: err.message,
          data: {
            studentId: selectedStudentId,
            amount: Number(amount),
            paymentMode,
            referenceNumber,
            notes,
            allowDuplicate: true,
          },
        })
      } else {
        setFormError(err.message || 'Failed to record payment')
      }
    },
  })

  // Reverse Payment Mutation
  const reverseMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/fees/payments/${id}/reverse`, { reversalReason: reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      queryClient.invalidateQueries({ queryKey: ['financial-stats'] })
      queryClient.invalidateQueries({ queryKey: ['recent-payments-register'] })
      queryClient.invalidateQueries({ queryKey: ['student-fee-profile'] })
      setReversalTarget(null)
      setReversalReason('')
      showToast('Payment reversed safely. Ledgers updated.')
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to reverse payment', true)
    },
  })

  const showToast = (msg: string, isErr = false) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 4000)
  }

  const selectedStudent = students.find((s: any) => s.id === selectedStudentId)
  const remainingDue = selectedProfile?.feeSummary?.totalPending ?? (selectedStudent?.pendingFees || 0)

  // Handle Form Submit
  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStudentId) {
      setFormError('Please select a student first')
      return
    }

    const numAmount = Number(amount)
    if (!numAmount || numAmount <= 0) {
      setFormError('Please enter a valid positive payment amount')
      return
    }

    if (numAmount > remainingDue) {
      setFormError(
        `Amount (₹${numAmount}) exceeds outstanding dues (₹${remainingDue}). Overpayment is prohibited.`
      )
      return
    }

    setFormError('')
    recordPaymentMutation.mutate({
      studentId: selectedStudentId,
      amount: numAmount,
      paymentMode,
      referenceNumber: referenceNumber.trim() || undefined,
      notes: notes.trim() || undefined,
    })
  }

  // Filter students for search bar
  const filteredStudents = students.filter((s: any) => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return true
    return (
      s.fullName?.toLowerCase().includes(q) ||
      s.rollNumber?.toLowerCase().includes(q) ||
      s.parentPhone?.includes(q) ||
      s.studentCode?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 p-4 bg-foreground text-background rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {toastMsg}
        </div>
      )}

      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-primary" />
            Installment Fee Collection & Receipts
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Collect fees, allocate to installments FIFO, generate receipts, and manage transaction history.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-muted p-1 rounded-lg border">
          <Button
            variant={activeTab === 'collect' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('collect')}
            className="text-xs h-8 gap-1.5"
          >
            <CreditCard className="w-3.5 h-3.5" />
            Collect Fee Form
          </Button>
          <Button
            variant={activeTab === 'history' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('history')}
            className="text-xs h-8 gap-1.5"
          >
            <History className="w-3.5 h-3.5" />
            Collections Register ({recentPayments.length})
          </Button>
        </div>
      </div>

      {activeTab === 'collect' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form (2 cols) */}
          <Card className="lg:col-span-2">
            <CardHeader className="py-3 px-4 bg-muted/20 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">
                  Fee Collection Transaction Entry
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Record installment payments with automatic FIFO allocation and receipt printing
                </p>
              </div>

              {/* In-page Branch Scope Switcher */}
              <div className="flex items-center gap-1.5 bg-background border rounded-md px-2.5 py-1 text-xs">
                <Building2 className="w-3.5 h-3.5 text-primary" />
                <span className="text-[11px] text-muted-foreground font-medium">Branch:</span>
                <select
                  value={selectedBranchId}
                  onChange={(e) => {
                    setSelectedBranchId(e.target.value)
                    setSelectedStudentId('')
                    setAmount('')
                  }}
                  className="bg-transparent font-semibold text-xs focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Branches</option>
                  {branches.filter((b) => b.isActive).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handlePaymentSubmit} className="space-y-4">
                {formError && (
                  <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* 1. Student Selection with Instant Autocomplete Search & Suggestions */}
                <StudentSearchAutocomplete
                  label="1. Select Student (Search by name, roll no, phone or course)"
                  required
                  branchId={selectedBranchId}
                  placeholder="Type student name, roll number, or phone..."
                  selectedStudent={selectedStudent || null}
                  onSelectStudent={(student) => {
                    setSelectedStudentId(student.id)
                    setFormError('')
                    if (student.pendingFees && student.pendingFees > 0) {
                      setAmount(String(student.pendingFees))
                    }
                  }}
                  onClearSelection={() => {
                    setSelectedStudentId('')
                    setAmount('')
                    setFormError('')
                  }}
                />

                {/* Selected Student Ledger Overview */}
                {selectedStudent && (
                  <div className="p-3 bg-muted/40 rounded-lg border grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Agreed Total:</span>
                      <span className="font-bold text-foreground">
                        {formatCurrency(selectedProfile?.feeSummary?.netPayable ?? selectedStudent.totalFees)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Already Paid:</span>
                      <span className="font-bold text-emerald-600">
                        {formatCurrency(selectedProfile?.feeSummary?.totalPaid ?? selectedStudent.paidFees)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Outstanding Due:</span>
                      <span className="font-bold text-rose-600 text-sm">
                        {formatCurrency(remainingDue)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Installments Breakdown for Selected Student */}
                {selectedProfile?.installments && selectedProfile.installments.length > 0 && (
                  <div className="border rounded-lg p-3 bg-background space-y-2 text-xs">
                    <span className="font-semibold text-muted-foreground block">
                      Scheduled Installments (Auto Allocated FIFO):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {selectedProfile.installments.map((inst: any) => (
                        <div
                          key={inst.id}
                          className="p-2 border rounded-md bg-muted/20 flex flex-col justify-between space-y-1"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-[11px] truncate">{inst.label}</span>
                            <Badge
                              variant={
                                inst.status === 'PAID'
                                  ? 'success'
                                  : inst.status === 'PARTIAL'
                                  ? 'warning'
                                  : inst.status === 'OVERDUE'
                                  ? 'danger'
                                  : 'outline'
                              }
                              className="text-[9px] px-1 py-0"
                            >
                              {inst.status}
                            </Badge>
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            Due: {formatDate(inst.dueDate)}
                          </div>
                          <div className="flex justify-between text-[11px]">
                            <span>Due: {formatCurrency(inst.amountDue)}</span>
                            <span className="font-semibold text-rose-600">
                              Bal: {formatCurrency(inst.balanceRemaining)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Amount and Mode */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                      <span>2. Amount Received (₹) *</span>
                      {remainingDue > 0 && (
                        <button
                          type="button"
                          onClick={() => setAmount(String(remainingDue))}
                          className="text-[11px] text-primary hover:underline font-normal"
                        >
                          Pay Full Balance (₹{remainingDue})
                        </button>
                      )}
                    </label>
                    <Input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="e.g. 10000"
                      min={1}
                      max={remainingDue || undefined}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      3. Payment Mode *
                    </label>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs font-medium focus:outline-none"
                    >
                      <option value="UPI">UPI (GPay, PhonePe, Paytm, QR)</option>
                      <option value="CASH">Cash in Hand</option>
                      <option value="BANK_TRANSFER">Bank Transfer (NEFT/IMPS/RTGS)</option>
                      <option value="CHEQUE">Bank Cheque</option>
                      <option value="OTHER">Other Mode</option>
                    </select>
                  </div>
                </div>

                {/* 3. Transaction Details & Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Transaction Ref / UTR / Cheque No. (Optional)
                    </label>
                    <Input
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      placeholder="e.g. UPI Ref 3291823901"
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Payment Notes / Remarks (Optional)
                    </label>
                    <Input
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. Part payment for Term 1"
                      className="text-xs"
                    />
                  </div>
                </div>

                {/* Submit Action */}
                <Button
                  type="submit"
                  disabled={recordPaymentMutation.isPending || !selectedStudentId || remainingDue <= 0}
                  className="w-full h-11 text-sm font-semibold mt-2 bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                >
                  <CreditCard className="w-4 h-4" />
                  {recordPaymentMutation.isPending
                    ? 'Recording Payment...'
                    : remainingDue <= 0 && selectedStudentId
                    ? 'Student Fees Already Settled'
                    : 'Confirm Payment & Print Receipt'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Quick Rules & Summary Card (1 col) */}
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-base font-semibold">Accounting Rules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-muted-foreground leading-relaxed">
              <div className="p-3 bg-muted/40 rounded-lg space-y-2 border">
                <div className="font-semibold text-foreground">Sequential Receipt Logic</div>
                <p>
                  Receipts are automatically numbered sequentially per branch and academic session (e.g.{' '}
                  <code className="text-primary font-mono font-bold">SC/2026-27/NGP/REC-00042</code>).
                </p>
              </div>

              <div className="p-3 bg-muted/40 rounded-lg space-y-2 border">
                <div className="font-semibold text-foreground">FIFO Installment Allocation</div>
                <p>
                  Payments are automatically credited to the earliest unpaid or partially paid installment
                  first.
                </p>
              </div>

              <div className="p-3 bg-muted/40 rounded-lg space-y-2 border">
                <div className="font-semibold text-foreground">Duplicate Detection</div>
                <p>
                  If a payment of identical amount and mode is recorded on the same date, the system asks for
                  explicit confirmation to prevent double charging.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* History & Collections Register Tab */
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-base font-semibold">
              Center Fee Collections Register ({recentPayments.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingPayments ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Loading transactions register...</p>
            ) : recentPayments.length === 0 ? (
              <div className="py-12 text-center border rounded-lg border-dashed">
                <History className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-sm font-semibold">No payment records found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Recorded fee collections will be listed here with receipts and reversal actions.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Receipt No.</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Ref / Notes</TableHead>
                    <TableHead>Amount (₹)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentPayments.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs font-bold text-foreground">
                        {p.receiptNumber}
                      </TableCell>
                      <TableCell className="text-xs">{formatDate(p.paymentDate)}</TableCell>
                      <TableCell className="font-semibold text-foreground">
                        {p.student?.fullName || '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-medium">
                        {p.branch?.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{p.paymentMode}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                        {p.referenceNumber || p.notes || '—'}
                      </TableCell>
                      <TableCell className="font-bold text-emerald-600">
                        {formatCurrency(p.totalAmount)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.isReversed ? 'destructive' : 'success'}>
                          {p.isReversed ? 'Reversed / Void' : 'Confirmed'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setReceiptData({
                              receiptNumber: p.receiptNumber,
                              paymentDate: p.paymentDate,
                              totalAmount: p.totalAmount,
                              paymentMode: p.paymentMode,
                              referenceNumber: p.referenceNumber,
                              notes: p.notes,
                              isReversed: p.isReversed,
                              reversalReason: p.reversalReason,
                              studentName: p.student?.fullName,
                              studentCode: p.student?.studentCode,
                              branchName: p.branch?.name,
                            })
                          }
                          className="h-8 gap-1 text-xs"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Receipt
                        </Button>
                        {!p.isReversed && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setReversalTarget(p)
                              setReversalReason('')
                            }}
                            className="h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs gap-1"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Reverse
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Duplicate Payment Warning Confirmation Dialog */}
      <AlertDialog
        open={Boolean(duplicateWarning)}
        onOpenChange={() => setDuplicateWarning(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-amber-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Potential Duplicate Payment Detected
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed">
              {duplicateWarning?.message}
              <br />
              <br />
              Are you sure this is a genuine second payment and not an accidental double submission?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (duplicateWarning?.data) {
                  recordPaymentMutation.mutate(duplicateWarning.data)
                }
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Confirm & Record Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment Reversal Dialog */}
      <AlertDialog
        open={Boolean(reversalTarget)}
        onOpenChange={() => setReversalTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <RotateCcw className="w-5 h-5" />
              Reverse Fee Payment (Audit Action)
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs space-y-2">
              <p>
                You are about to reverse payment receipt{' '}
                <strong>{reversalTarget?.receiptNumber}</strong> of{' '}
                <strong>{formatCurrency(reversalTarget?.totalAmount || 0)}</strong> for{' '}
                <strong>{reversalTarget?.student?.fullName}</strong>.
              </p>
              <p>
                This will automatically update the student's pending installment dues without deleting the
                audit record.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-2 space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Reason for Reversal (Required) *
            </label>
            <Input
              value={reversalReason}
              onChange={(e) => setReversalReason(e.target.value)}
              placeholder="e.g. Cheque bounced / Wrong payment mode entered / Refund"
              className="text-xs"
              required
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!reversalReason.trim() || reverseMutation.isPending}
              onClick={() =>
                reverseMutation.mutate({
                  id: reversalTarget.id,
                  reason: reversalReason.trim(),
                })
              }
              className="bg-destructive text-destructive-foreground"
            >
              Confirm Reversal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reusable Official Printable Receipt Modal */}
      <FeeReceiptModal
        receipt={receiptData}
        onClose={() => setReceiptData(null)}
      />
    </div>
  )
}
