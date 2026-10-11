import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useApp } from '@/context/AppContext'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { CreditCard, IndianRupee, Printer, CheckCircle2, AlertCircle } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

export const CollectFeesPage: React.FC = () => {
  const queryClient = useQueryClient()
  const { selectedBranchId, currentBranch } = useApp()

  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentMode, setPaymentMode] = useState('UPI')
  const [receiptNumber, setReceiptNumber] = useState(`REC-${Date.now().toString().slice(-6)}`)
  const [notes, setNotes] = useState('')
  const [lastReceipt, setLastReceipt] = useState<any>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const { data: students = [], isLoading: isLoadingStudents } = useQuery({
    queryKey: ['students-for-fees', selectedBranchId],
    queryFn: () =>
      api.get('/students', {
        branchId: selectedBranchId !== 'ALL' ? selectedBranchId : undefined,
      }),
  })

  const selectedStudent = students.find((s: any) => s.id === selectedStudentId)

  const paymentMutation = useMutation({
    mutationFn: (data: any) => api.post('/students/payments', data),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      queryClient.invalidateQueries({ queryKey: ['financial-stats'] })
      setLastReceipt({
        ...res,
        studentName: selectedStudent?.fullName,
        rollNumber: selectedStudent?.rollNumber,
        standard: selectedStudent?.standard,
      })
      setAmount('')
      setNotes('')
      setReceiptNumber(`REC-${Date.now().toString().slice(-6)}`)
      setErrorMsg('')
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to record payment')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStudentId) {
      setErrorMsg('Please select a student')
      return
    }
    const numAmount = Number(amount)
    if (!numAmount || numAmount <= 0) {
      setErrorMsg('Please enter a valid amount')
      return
    }

    paymentMutation.mutate({
      studentId: selectedStudentId,
      amount: numAmount,
      paymentMode,
      receiptNumber,
      notes: notes.trim() || undefined,
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-primary" />
          Collect Fees & Issue Receipt
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Record student installment payments and immediately print official fee receipts.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Form */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Payment Collection Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {errorMsg}
                </div>
              )}

              {/* Student Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Select Student *</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
                  required
                >
                  <option value="">-- Choose Student --</option>
                  {students.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.rollNumber}) — Due: ₹{s.pendingFees}
                    </option>
                  ))}
                </select>
              </div>

              {selectedStudent && (
                <div className="p-3 bg-muted/40 rounded-lg border grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground block">Agreed Total:</span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(selectedStudent.totalFees)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Already Paid:</span>
                    <span className="font-semibold text-emerald-600">
                      {formatCurrency(selectedStudent.paidFees || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Balance Due:</span>
                    <span className="font-semibold text-rose-600">
                      {formatCurrency(selectedStudent.pendingFees || 0)}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Amount Received (₹) *</label>
                  <Input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 5000"
                    min={1}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Payment Mode *</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
                  >
                    <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                    <option value="CASH">Cash</option>
                    <option value="BANK_TRANSFER">NEFT / RTGS / IMPS</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Receipt Number *</label>
                  <Input
                    value={receiptNumber}
                    onChange={(e) => setReceiptNumber(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Payment Notes / Txn ID</label>
                  <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="UTR number or note"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={paymentMutation.isPending || !selectedStudentId}
                className="w-full mt-2"
                size="lg"
              >
                {paymentMutation.isPending ? 'Processing Payment...' : 'Record Payment & Generate Receipt'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Generated Receipt Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <span>Receipt Preview</span>
              {lastReceipt && (
                <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1.5">
                  <Printer className="w-3.5 h-3.5" />
                  Print
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lastReceipt ? (
              <div className="border p-4 rounded-lg bg-card text-xs space-y-3 font-mono print:border-none">
                <div className="text-center border-b pb-2">
                  <h3 className="font-bold text-sm text-foreground">SUTAWANE CLASSES</h3>
                  <p className="text-[10px] text-muted-foreground">Official Fee Receipt</p>
                </div>
                <div className="flex justify-between">
                  <span>Receipt #:</span>
                  <span className="font-bold">{lastReceipt.receiptNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Student:</span>
                  <span className="font-semibold">{lastReceipt.studentName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Roll No:</span>
                  <span>{lastReceipt.rollNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Class:</span>
                  <span>{lastReceipt.standard}</span>
                </div>
                <div className="flex justify-between">
                  <span>Mode:</span>
                  <span>{lastReceipt.paymentMode}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-bold text-sm text-emerald-600">
                  <span>Amount Paid:</span>
                  <span>₹{lastReceipt.amount}</span>
                </div>
                <div className="border-t pt-2 text-[10px] text-muted-foreground text-center">
                  Thank you! Computer generated receipt.
                </div>
              </div>
            ) : (
              <div className="py-12 text-center border rounded-lg border-dashed">
                <Printer className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-40" />
                <p className="text-xs text-muted-foreground">
                  Record a payment to view and print the receipt here.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
