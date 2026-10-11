import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Printer, GraduationCap, X, CheckCircle2 } from 'lucide-react'
import { formatCurrency, formatDate, formatDateLong, numberToWordsINR } from '@/lib/utils'

export interface ReceiptData {
  receiptNumber: string
  paymentDate: string
  totalAmount: number
  paymentMode: string
  referenceNumber?: string | null
  notes?: string | null
  isReversed?: boolean
  reversalReason?: string | null
  studentName: string
  studentCode?: string
  rollNumber?: string
  standard?: string
  branchName?: string
  branchCode?: string
  sessionName?: string
  remainingBalance?: number
  allocations?: Array<{
    allocatedAmount: number
    installmentLabel?: string
  }>
}

interface FeeReceiptModalProps {
  receipt: ReceiptData | null
  onClose: () => void
}

export const FeeReceiptModal: React.FC<FeeReceiptModalProps> = ({ receipt, onClose }) => {
  if (!receipt) return null

  const handlePrint = () => {
    window.print()
  }

  return (
    <Dialog open={Boolean(receipt)} onOpenChange={onClose}>
      <DialogContent className="max-w-xl p-0 overflow-hidden bg-background">
        <DialogHeader className="p-4 bg-muted/30 border-b flex flex-row items-center justify-between">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Printer className="w-4 h-4 text-primary" />
            Official Fee Receipt
          </DialogTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handlePrint} className="gap-1.5 h-8">
              <Printer className="w-3.5 h-3.5" />
              Print Receipt
            </Button>
          </div>
        </DialogHeader>

        {/* Printable Receipt Body */}
        <div id="printable-receipt" className="p-6 space-y-5 text-sm bg-card text-foreground print:p-0">
          {/* Watermark for reversed transactions */}
          {receipt.isReversed && (
            <div className="bg-destructive/10 text-destructive border border-destructive/20 p-2.5 rounded-lg text-center font-bold text-xs">
              ⚠️ THIS RECEIPT HAS BEEN VOIDED / REVERSED ({receipt.reversalReason || 'Transaction reversed'})
            </div>
          )}

          {/* Institute Header */}
          <div className="text-center border-b pb-4 space-y-1">
            <div className="flex items-center justify-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold shadow-sm">
                <GraduationCap className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-extrabold tracking-tight text-foreground">
                SUTAWANE CLASSES
              </h2>
            </div>
            <p className="text-xs text-muted-foreground font-medium">
              Excellence in Coaching & Board Exam Preparations
            </p>
            <p className="text-[11px] text-muted-foreground">
              {receipt.branchName || 'Central Branch'} | Helpline: +91 98765 43210
            </p>
          </div>

          {/* Receipt Meta (Number & Date) */}
          <div className="flex justify-between items-center text-xs bg-muted/40 p-2.5 rounded-md border">
            <div>
              <span className="text-muted-foreground">Receipt No: </span>
              <span className="font-mono font-bold text-foreground">{receipt.receiptNumber}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Date: </span>
              <span className="font-semibold text-foreground">{formatDateLong(receipt.paymentDate)}</span>
            </div>
          </div>

          {/* Student Bio Details Grid */}
          <div className="grid grid-cols-2 gap-2.5 text-xs border rounded-md p-3 bg-muted/20">
            <div>
              <span className="text-muted-foreground block text-[11px]">Student Name:</span>
              <span className="font-bold text-foreground text-sm">{receipt.studentName}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Student ID / Roll No:</span>
              <span className="font-mono font-semibold text-foreground">
                {receipt.rollNumber || receipt.studentCode || '—'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Class / Course:</span>
              <span className="font-medium text-foreground">{receipt.standard || 'Class 10'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Academic Session:</span>
              <span className="font-medium text-foreground">{receipt.sessionName || '2026–27'}</span>
            </div>
          </div>

          {/* Payment Breakdown Table */}
          <div className="border rounded-md overflow-hidden text-xs">
            <table className="w-full">
              <thead className="bg-muted text-muted-foreground border-b font-semibold">
                <tr>
                  <th className="p-2.5 text-left">Description / Installment Covered</th>
                  <th className="p-2.5 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {receipt.allocations && receipt.allocations.length > 0 ? (
                  receipt.allocations.map((a, idx) => (
                    <tr key={idx}>
                      <td className="p-2.5">{a.installmentLabel || `Installment Fee`}</td>
                      <td className="p-2.5 text-right font-semibold">{formatCurrency(a.allocatedAmount)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="p-2.5">Tuition & Coaching Fee Installment</td>
                    <td className="p-2.5 text-right font-semibold">{formatCurrency(receipt.totalAmount)}</td>
                  </tr>
                )}
                {/* Total Row */}
                <tr className="bg-muted/30 font-bold text-sm">
                  <td className="p-2.5 text-foreground">TOTAL AMOUNT RECEIVED</td>
                  <td className="p-2.5 text-right text-emerald-600 font-extrabold">
                    {formatCurrency(receipt.totalAmount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Amount in Words & Mode Details */}
          <div className="space-y-1.5 text-xs bg-muted/20 p-2.5 rounded-md border">
            <div>
              <span className="text-muted-foreground">Amount in Words: </span>
              <span className="font-semibold text-foreground italic">
                {numberToWordsINR(receipt.totalAmount)}
              </span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t text-[11px]">
              <div>
                <span className="text-muted-foreground">Payment Mode: </span>
                <span className="font-semibold text-foreground">{receipt.paymentMode}</span>
                {receipt.referenceNumber && (
                  <span className="text-muted-foreground font-mono ml-2">
                    (Ref/Txn: {receipt.referenceNumber})
                  </span>
                )}
              </div>
              {receipt.remainingBalance !== undefined && (
                <div>
                  <span className="text-muted-foreground">Remaining Dues: </span>
                  <span className="font-bold text-rose-600">{formatCurrency(receipt.remainingBalance)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {receipt.notes && (
            <div className="text-[11px] text-muted-foreground">
              <strong>Notes:</strong> {receipt.notes}
            </div>
          )}

          {/* Signatures & Terms */}
          <div className="pt-6 flex justify-between items-end border-t text-[11px] text-muted-foreground">
            <div>
              <p>• Fees once paid are non-refundable.</p>
              <p>• Retain this computer generated receipt for records.</p>
            </div>
            <div className="text-center space-y-6">
              <div className="w-36 border-b border-muted-foreground/60"></div>
              <p className="font-semibold text-foreground">Authorized Signature</p>
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 bg-muted/20 border-t flex sm:justify-between">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={handlePrint} className="gap-1.5">
            <Printer className="w-4 h-4" />
            Print Fee Slip
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
