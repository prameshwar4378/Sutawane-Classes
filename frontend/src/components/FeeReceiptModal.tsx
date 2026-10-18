import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Printer, GraduationCap, Scissors } from 'lucide-react'
import { formatCurrency, formatDateLong, numberToWordsINR } from '@/lib/utils'
import { useApp } from '@/context/AppContext'
import { WhatsAppIcon, openWhatsApp, buildReceiptWhatsAppMessage } from '@/lib/whatsapp'

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
  parentPhone?: string | null
  studentPhone?: string | null
  allocations?: Array<{
    allocatedAmount: number
    installmentLabel?: string
  }>
}

interface FeeReceiptModalProps {
  receipt: ReceiptData | null
  onClose: () => void
}

/**
 * Single Receipt Slip Component (used for on-screen modal preview)
 */
interface ReceiptSlipProps {
  copyType: 'STUDENT COPY' | 'OFFICE COPY'
  copyBadge: string
  receipt: ReceiptData
  instituteName: string
  tagline: string
  address: string
  phone: string
  email: string
  receiptFooter: string
  logoUrl: string | null
}

const ReceiptSlip: React.FC<ReceiptSlipProps> = ({
  copyType,
  receipt,
  instituteName,
  tagline,
  address,
  phone,
  email,
  receiptFooter,
  logoUrl,
}) => {
  return (
    <div className="border-2 border-[#28375C] rounded-lg p-5 sm:p-6 bg-white text-slate-900 shadow-sm space-y-3.5 select-text">
      {/* Reversed Watermark Notice */}
      {receipt.isReversed && (
        <div className="bg-rose-100 text-rose-800 border-2 border-rose-300 px-3 py-1.5 rounded text-center font-bold text-xs uppercase tracking-wider">
          ⚠️ THIS RECEIPT HAS BEEN VOIDED / REVERSED ({receipt.reversalReason || 'Transaction reversed'})
        </div>
      )}

      {/* Header: Institute Identity & Receipt Copy Badge */}
      <div className="flex items-start justify-between border-b-2 border-[#28375C] pb-3">
        <div className="flex items-center gap-3.5">
          {logoUrl ? (
            <div className="w-14 h-14 rounded-md bg-white border border-slate-200 flex items-center justify-center p-1 flex-shrink-0 shadow-xs">
              <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
            </div>
          ) : (
            <div className="w-13 h-13 rounded-md bg-[#28375C] text-white flex items-center justify-center font-bold flex-shrink-0 shadow-xs">
              <GraduationCap className="w-7 h-7" />
            </div>
          )}
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-tight leading-tight uppercase text-[#28375C]">
              {instituteName}
            </h2>
            <p className="text-xs font-semibold text-slate-600 leading-tight mt-0.5">
              {tagline}
            </p>
            <p className="text-[11px] text-slate-500 leading-tight mt-1">
              {address} {phone ? `• Tel: ${phone}` : ''} {email ? `• ${email}` : ''}
            </p>
          </div>
        </div>

        <div className="text-right flex flex-col items-end flex-shrink-0">
          <span className="inline-block px-3 py-1 bg-[#28375C] text-white font-extrabold text-[10px] uppercase tracking-widest rounded shadow-xs">
            {copyType}
          </span>
          <div className="mt-1.5 font-mono text-xs leading-tight">
            <span className="text-slate-500 text-[10px] font-sans font-medium">Receipt No: </span>
            <strong className="text-slate-950 font-bold">{receipt.receiptNumber}</strong>
          </div>
          <div className="text-[11px] text-slate-600 leading-tight mt-0.5">
            Date: <span className="font-semibold text-slate-900">{formatDateLong(receipt.paymentDate)}</span>
          </div>
        </div>
      </div>

      {/* Student & Session Information Meta Grid (Spacious, Roomy, No Truncate) */}
      <div className="grid grid-cols-12 gap-3 py-2.5 px-3.5 bg-slate-50 border border-slate-200 rounded-md text-xs">
        <div className="col-span-12 sm:col-span-5">
          <span className="text-[9.5px] text-slate-500 block uppercase font-bold tracking-wider">Student Name</span>
          <strong className="text-slate-950 text-sm sm:text-base font-black block leading-snug break-words mt-0.5">
            {receipt.studentName}
          </strong>
        </div>
        <div className="col-span-4 sm:col-span-2">
          <span className="text-[9.5px] text-slate-500 block uppercase font-bold tracking-wider">Roll No / ID</span>
          <span className="font-mono font-bold text-slate-900 block text-xs sm:text-sm mt-0.5">
            {receipt.rollNumber || receipt.studentCode || '—'}
          </span>
        </div>
        <div className="col-span-4 sm:col-span-2">
          <span className="text-[9.5px] text-slate-500 block uppercase font-bold tracking-wider">Class / Course</span>
          <span className="font-bold text-slate-900 block text-xs sm:text-sm mt-0.5">{receipt.standard || 'Class 10'}</span>
        </div>
        <div className="col-span-4 sm:col-span-3">
          <span className="text-[9.5px] text-slate-500 block uppercase font-bold tracking-wider">Branch & Session</span>
          <span className="font-bold text-slate-900 block text-xs sm:text-sm leading-tight break-words mt-0.5">
            {receipt.branchName ? `${receipt.branchName} • ` : ''}
            {receipt.sessionName || '2026–27'}
          </span>
        </div>
      </div>

      {/* Payment Particulars Table */}
      <div className="border border-slate-300 rounded-md overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#28375C] text-white font-bold uppercase text-[10px] tracking-wider">
            <tr>
              <th className="py-2 px-3.5">Fee Particulars / Description</th>
              <th className="py-2 px-3.5 text-right w-44">Amount Received (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {receipt.allocations && receipt.allocations.length > 0 ? (
              receipt.allocations.map((a, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="py-2 px-3.5 font-medium text-slate-800">{a.installmentLabel || 'Tuition & Coaching Fee'}</td>
                  <td className="py-2 px-3.5 text-right font-bold text-slate-900">{formatCurrency(a.allocatedAmount)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="py-2 px-3.5 font-medium text-slate-800">Tuition & Coaching Fee Payment</td>
                <td className="py-2 px-3.5 text-right font-bold text-slate-900">{formatCurrency(receipt.totalAmount)}</td>
              </tr>
            )}
            <tr className="bg-slate-100 font-bold border-t-2 border-[#28375C]">
              <td className="py-2.5 px-3.5 uppercase text-[#28375C] tracking-wide font-extrabold text-xs">
                Total Amount Collected
              </td>
              <td className="py-2.5 px-3.5 text-right font-black text-[#28375C] text-base">
                {formatCurrency(receipt.totalAmount)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Amount in Words, Mode & Remaining Balance */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-md gap-2">
        <div className="flex-1 pr-2">
          <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">In Words: </span>
          <span className="font-bold italic text-slate-900 block sm:inline">{numberToWordsINR(receipt.totalAmount)}</span>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <div>
            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Mode: </span>
            <strong className="text-slate-900 font-bold">{receipt.paymentMode}</strong>
            {receipt.referenceNumber && (
              <span className="text-slate-600 font-mono text-[10px] ml-1 font-normal">({receipt.referenceNumber})</span>
            )}
          </div>
          {receipt.remainingBalance !== undefined && (
            <div className="border-l pl-3 border-slate-300">
              <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Remaining Balance: </span>
              <strong className={receipt.remainingBalance > 0 ? 'text-rose-700 font-extrabold' : 'text-emerald-700 font-extrabold'}>
                {receipt.remainingBalance === 0 ? 'Nil (Settled)' : formatCurrency(receipt.remainingBalance)}
              </strong>
            </div>
          )}
        </div>
      </div>

      {/* Optional Note */}
      {receipt.notes && (
        <div className="text-[11px] text-slate-600 px-1">
          <span className="font-bold text-slate-700">Note: </span>
          <span>{receipt.notes}</span>
        </div>
      )}

      {/* Stamp & Authorized Signatory Strip */}
      <div className="pt-2 flex justify-between items-end text-xs text-slate-600 border-t border-slate-200">
        <div className="flex items-end gap-3.5">
          {/* Physical Stamp Box */}
          <div className="w-28 h-12 border border-dashed border-slate-400 rounded flex items-center justify-center text-[9px] text-slate-400 font-bold uppercase tracking-wider bg-slate-50 flex-shrink-0">
            [ Official Stamp ]
          </div>
          <div>
            <p className="font-semibold text-slate-700 text-[10.5px]">{receiptFooter}</p>
            <p className="text-slate-400 text-[9.5px] mt-0.5">Computer generated official receipt • Valid without stamp</p>
          </div>
        </div>
        <div className="text-center flex-shrink-0">
          <div className="h-6"></div>
          <div className="w-36 border-b-2 border-slate-800 mb-1"></div>
          <p className="font-extrabold text-slate-900 uppercase tracking-wider text-[9.5px]">Authorized Signatory</p>
        </div>
      </div>
    </div>
  )
}

/**
 * Builds clean self-contained HTML for a single slip for zero-error print rendering
 */
function buildReceiptSlipHTML(params: {
  copyType: 'STUDENT COPY' | 'OFFICE COPY'
  receipt: ReceiptData
  instituteName: string
  tagline: string
  address: string
  phone: string
  email: string
  receiptFooter: string
  logoUrl: string | null
}): string {
  const {
    copyType,
    receipt,
    instituteName,
    tagline,
    address,
    phone,
    email,
    receiptFooter,
    logoUrl,
  } = params

  const dateFormatted = formatDateLong(receipt.paymentDate)
  const amountInWords = numberToWordsINR(receipt.totalAmount)
  const amountFormatted = `₹${Math.round(receipt.totalAmount).toLocaleString('en-IN')}`
  const remainingFormatted =
    receipt.remainingBalance !== undefined
      ? receipt.remainingBalance === 0
        ? 'Nil (Settled)'
        : `₹${Math.round(receipt.remainingBalance).toLocaleString('en-IN')}`
      : null

  const allocationRows =
    receipt.allocations && receipt.allocations.length > 0
      ? receipt.allocations
          .map(
            (a) => `
        <tr>
          <td style="padding: 6px 12px; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #1e293b;">${a.installmentLabel || 'Tuition & Coaching Fee'}</td>
          <td style="padding: 6px 12px; text-align: right; border-bottom: 1px solid #e2e8f0; font-weight: 700; font-size: 11.5px; color: #0f172a;">₹${Math.round(a.allocatedAmount).toLocaleString('en-IN')}</td>
        </tr>
      `
          )
          .join('')
      : `
        <tr>
          <td style="padding: 6px 12px; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #1e293b;">Tuition & Coaching Fee Payment</td>
          <td style="padding: 6px 12px; text-align: right; border-bottom: 1px solid #e2e8f0; font-weight: 700; font-size: 11.5px; color: #0f172a;">${amountFormatted}</td>
        </tr>
      `

  return `
    <div class="receipt-slip" style="border: 2px solid #28375C; border-radius: 8px; padding: 12px 18px; background: #ffffff; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; box-sizing: border-box; page-break-inside: avoid; display: flex; flex-direction: column; justify-content: space-between; min-height: 126mm; height: 128mm; max-height: 130mm;">
      <!-- Top Group: Header, Meta Grid, Particulars Table, Payment Meta -->
      <div>
        ${
          receipt.isReversed
            ? `
          <div style="background: #fee2e2; color: #991b1b; border: 1.5px solid #f87171; padding: 4px 8px; text-align: center; font-weight: 800; font-size: 10.5px; border-radius: 4px; margin-bottom: 6px; letter-spacing: 0.04em;">
            ⚠️ THIS RECEIPT HAS BEEN VOIDED / REVERSED (${receipt.reversalReason || 'Transaction reversed'})
          </div>
        `
            : ''
        }

        <!-- Header: Institute Info & Receipt Number -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #28375C; padding-bottom: 6px; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            ${
              logoUrl
                ? `
              <div style="width: 50px; height: 50px; border: 1px solid #cbd5e1; border-radius: 6px; display: flex; align-items: center; justify-content: center; padding: 2px; flex-shrink: 0; background: #ffffff;">
                <img src="${logoUrl}" alt="Logo" style="width: 100%; height: 100%; object-fit: contain;" />
              </div>
            `
                : `
              <div style="width: 44px; height: 44px; background: #28375C; color: #ffffff; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px; flex-shrink: 0;">
                🎓
              </div>
            `
            }
            <div>
              <h2 style="margin: 0; font-size: 17px; font-weight: 900; letter-spacing: 0.01em; text-transform: uppercase; color: #28375C; line-height: 1.2;">
                ${instituteName}
              </h2>
              <p style="margin: 2px 0 0; font-size: 10px; font-weight: 600; color: #475569; line-height: 1.2;">
                ${tagline}
              </p>
              <p style="margin: 2px 0 0; font-size: 9px; color: #64748b; line-height: 1.2;">
                ${address} ${phone ? `• Tel: ${phone}` : ''} ${email ? `• ${email}` : ''}
              </p>
            </div>
          </div>

          <div style="text-align: right; flex-shrink: 0;">
            <span style="display: inline-block; padding: 3px 10px; background: #28375C; color: #ffffff; font-weight: 800; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.08em; border-radius: 4px;">
              ${copyType}
            </span>
            <div style="margin-top: 4px; font-family: monospace; font-size: 11.5px; line-height: 1.2;">
              <span style="color: #64748b; font-size: 9.5px; font-family: sans-serif;">Receipt No: </span>
              <strong style="color: #0f172a; font-weight: 800;">${receipt.receiptNumber}</strong>
            </div>
            <div style="font-size: 10px; color: #475569; line-height: 1.2; margin-top: 2px;">
              Date: <strong style="color: #0f172a;">${dateFormatted}</strong>
            </div>
          </div>
        </div>

        <!-- Student & Course Meta Grid (Full Name visible, No Truncate) -->
        <div style="display: grid; grid-template-columns: 2.3fr 1fr 1.2fr 1.6fr; gap: 10px; padding: 6px 12px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 10.5px; margin-bottom: 8px;">
          <div>
            <span style="font-size: 8.5px; color: #64748b; display: block; text-transform: uppercase; font-weight: 700; letter-spacing: 0.04em;">Student Name</span>
            <strong style="color: #0f172a; font-size: 12.5px; font-weight: 900; display: block; line-height: 1.25; word-break: break-word;">${receipt.studentName}</strong>
          </div>
          <div>
            <span style="font-size: 8.5px; color: #64748b; display: block; text-transform: uppercase; font-weight: 700; letter-spacing: 0.04em;">Roll No / ID</span>
            <span style="font-family: monospace; font-weight: 700; color: #1e293b; display: block; font-size: 11px;">
              ${receipt.rollNumber || receipt.studentCode || '—'}
            </span>
          </div>
          <div>
            <span style="font-size: 8.5px; color: #64748b; display: block; text-transform: uppercase; font-weight: 700; letter-spacing: 0.04em;">Class / Course</span>
            <span style="font-weight: 700; color: #1e293b; display: block; font-size: 11px;">${receipt.standard || 'Class 10'}</span>
          </div>
          <div>
            <span style="font-size: 8.5px; color: #64748b; display: block; text-transform: uppercase; font-weight: 700; letter-spacing: 0.04em;">Branch & Session</span>
            <span style="font-weight: 700; color: #1e293b; display: block; font-size: 10.5px; line-height: 1.25;">
              ${receipt.branchName ? `${receipt.branchName} • ` : ''}${receipt.sessionName || '2026–27'}
            </span>
          </div>
        </div>

        <!-- Particulars Table -->
        <table style="width: 100%; border-collapse: collapse; font-size: 10.5px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; margin-bottom: 8px;">
          <thead>
            <tr style="background: #28375C; color: #ffffff; font-weight: 700; text-transform: uppercase; font-size: 9px; letter-spacing: 0.05em;">
              <th style="padding: 5px 12px; text-align: left;">Fee Particulars / Description</th>
              <th style="padding: 5px 12px; text-align: right; width: 145px;">Amount Received</th>
            </tr>
          </thead>
          <tbody>
            ${allocationRows}
            <tr style="background: #f1f5f9; font-weight: 800; font-size: 11px; border-top: 2px solid #28375C;">
              <td style="padding: 6px 12px; text-transform: uppercase; color: #28375C; font-weight: 800; letter-spacing: 0.03em;">Total Amount Collected</td>
              <td style="padding: 6px 12px; text-align: right; font-weight: 900; color: #28375C; font-size: 13px;">${amountFormatted}</td>
            </tr>
          </tbody>
        </table>

        <!-- Amount in Words & Mode -->
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10px; padding: 6px 12px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; margin-bottom: 6px;">
          <div style="flex: 1; padding-right: 10px;">
            <span style="color: #64748b; font-size: 9px; text-transform: uppercase; font-weight: 700;">In Words: </span>
            <span style="font-weight: 700; font-style: italic; color: #0f172a; font-size: 10.5px;">${amountInWords}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 12px; flex-shrink: 0;">
            <div>
              <span style="color: #64748b; font-size: 9px; text-transform: uppercase; font-weight: 700;">Mode: </span>
              <strong style="color: #0f172a;">${receipt.paymentMode}</strong>
              ${receipt.referenceNumber ? `<span style="color: #64748b; font-family: monospace; font-size: 9px; margin-left: 2px;">(${receipt.referenceNumber})</span>` : ''}
            </div>
            ${
              remainingFormatted
                ? `
              <div style="border-left: 1px solid #cbd5e1; padding-left: 10px;">
                <span style="color: #64748b; font-size: 9px; text-transform: uppercase; font-weight: 700;">Remaining: </span>
                <strong style="color: ${receipt.remainingBalance && receipt.remainingBalance > 0 ? '#dc2626' : '#059669'}; font-weight: 800;">
                  ${remainingFormatted}
                </strong>
              </div>
            `
                : ''
            }
          </div>
        </div>

        ${
          receipt.notes
            ? `
          <div style="font-size: 9.5px; color: #475569; padding: 0 4px; margin-bottom: 4px;">
            <strong style="color: #334155;">Note: </strong>
            <span>${receipt.notes}</span>
          </div>
        `
            : ''
        }
      </div>

      <!-- Bottom Group: Stamp & Signature Strip -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #cbd5e1; padding-top: 6px;">
        <div style="display: flex; align-items: flex-end; gap: 12px;">
          <!-- Physical Stamp Box Placeholder -->
          <div style="width: 105px; height: 42px; border: 1px dashed #94a3b8; border-radius: 4px; display: flex; align-items: center; justify-content: center; background: #fafafa; color: #94a3b8; font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; text-align: center; flex-shrink: 0;">
            [ Official Stamp ]
          </div>
          <div>
            <p style="margin: 0; font-weight: 600; color: #475569; font-size: 9px; line-height: 1.3;">${receiptFooter}</p>
            <p style="margin: 2px 0 0; color: #94a3b8; font-size: 8px;">Computer generated official receipt • Valid without stamp</p>
          </div>
        </div>

        <div style="text-align: center; flex-shrink: 0;">
          <div style="height: 28px;"></div>
          <div style="width: 140px; border-bottom: 1.5px solid #1e293b; margin-bottom: 3px;"></div>
          <p style="margin: 0; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; font-size: 9px; color: #0f172a;">Authorized Signatory</p>
        </div>
      </div>
    </div>
  `
}

export const FeeReceiptModal: React.FC<FeeReceiptModalProps> = ({ receipt, onClose }) => {
  const { settings, activeLogoUrl, branches } = useApp()
  const [viewMode, setViewMode] = useState<'A4_DUAL' | 'STUDENT_ONLY' | 'OFFICE_ONLY'>('A4_DUAL')

  if (!receipt) return null

  // Resolve branch details if receipt belongs to a specific branch
  const receiptBranch = branches.find((b) => b.name === receipt.branchName || b.code === receipt.branchCode)

  const instituteName = (settings?.institute_name || 'Sutawane Classes').toUpperCase()
  const tagline = settings?.tagline || 'Excellence in Coaching & Board Exam Preparations'
  const address = receiptBranch?.address || settings?.address || 'Main Campus, Maharashtra'
  const phone = receiptBranch?.phone || settings?.phone || '+91 98765 43210'
  const email = settings?.email || 'contact@sutawaneclasses.com'
  const receiptFooter = settings?.receipt_footer || 'Fees once paid are non-refundable. Retain this slip for future verification.'
  const logoUrl = receiptBranch?.logoUrl || activeLogoUrl || settings?.logo_url || null

  const handlePrint = () => {
    const studentSlipHTML = buildReceiptSlipHTML({
      copyType: 'STUDENT COPY',
      receipt,
      instituteName,
      tagline,
      address,
      phone,
      email,
      receiptFooter,
      logoUrl,
    })

    const officeSlipHTML = buildReceiptSlipHTML({
      copyType: 'OFFICE COPY',
      receipt,
      instituteName,
      tagline,
      address,
      phone,
      email,
      receiptFooter,
      logoUrl,
    })

    const cutLineHTML = `
      <div class="receipt-cut-line" style="display: flex; align-items: center; justify-content: center; position: relative; margin: 4mm 0; border-top: 1.5px dashed #64748b; height: 6mm;">
        <span style="position: absolute; background: #ffffff; padding: 0 14px; font-size: 8.5px; font-family: monospace; text-transform: uppercase; letter-spacing: 0.12em; color: #475569; font-weight: 700;">
          ✂ CUT OR FOLD ALONG DOTTED LINE FOR STUDENT / OFFICE COPY ✂
        </span>
      </div>
    `

    const printDocumentHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Receipt_${receipt.receiptNumber}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 8mm 10mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            background: #ffffff;
            color: #000000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          }
          .receipt-sheet {
            width: 100%;
            max-width: 190mm;
            margin: 0 auto;
            box-sizing: border-box;
          }
        </style>
      </head>
      <body>
        <div class="receipt-sheet">
          ${viewMode === 'A4_DUAL' || viewMode === 'STUDENT_ONLY' ? studentSlipHTML : ''}
          ${viewMode === 'A4_DUAL' ? cutLineHTML : ''}
          ${viewMode === 'A4_DUAL' || viewMode === 'OFFICE_ONLY' ? officeSlipHTML : ''}
        </div>
      </body>
      </html>
    `

    // Create an isolated hidden iframe for printing
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    iframe.style.visibility = 'hidden'
    document.body.appendChild(iframe)

    const iframeDoc = iframe.contentWindow?.document
    if (!iframeDoc) {
      document.body.classList.add('printing-receipt')
      window.print()
      setTimeout(() => document.body.classList.remove('printing-receipt'), 1000)
      return
    }

    iframeDoc.open()
    iframeDoc.write(printDocumentHTML)
    iframeDoc.close()

    iframe.contentWindow?.focus()
    setTimeout(() => {
      iframe.contentWindow?.print()
      setTimeout(() => {
        try {
          document.body.removeChild(iframe)
        } catch {}
      }, 1500)
    }, 250)
  }

  const handleSendWhatsApp = () => {
    let targetPhone = receipt.parentPhone || receipt.studentPhone || ''
    if (!targetPhone || targetPhone.replace(/\D/g, '').length < 10) {
      const entered = window.prompt(
        'Enter parent 10-digit WhatsApp number to send receipt:',
        ''
      )
      if (!entered || !entered.trim()) return
      targetPhone = entered.trim()
    }

    const message = buildReceiptWhatsAppMessage({
      instituteName,
      studentName: receipt.studentName,
      studentCode: receipt.studentCode,
      rollNumber: receipt.rollNumber,
      standard: receipt.standard,
      receiptNumber: receipt.receiptNumber,
      totalAmount: receipt.totalAmount,
      paymentDate: receipt.paymentDate,
      paymentMode: receipt.paymentMode,
      referenceNumber: receipt.referenceNumber,
      remainingBalance: receipt.remainingBalance,
      branchName: receipt.branchName,
      helpline: phone,
    })

    openWhatsApp(targetPhone, message)
  }

  return (
    <Dialog open={Boolean(receipt)} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[92vh] p-0 flex flex-col overflow-hidden bg-background">
        {/* Modal Top Control Bar */}
        <DialogHeader className="p-3.5 bg-muted/40 border-b flex flex-row items-center justify-between no-print flex-shrink-0">
          <div>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Printer className="w-4 h-4 text-primary" />
              Official Fee Receipt
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">
              Receipt No: {receipt.receiptNumber} • {receipt.studentName}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* WhatsApp Send Button */}
            <Button
              type="button"
              onClick={handleSendWhatsApp}
              size="sm"
              className="gap-1.5 h-8 bg-[#25D366] hover:bg-[#20ba59] text-white font-medium"
              title="Send receipt details to parent via WhatsApp"
            >
              <WhatsAppIcon className="w-4 h-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </Button>

            {/* View Mode Toggle */}
            <div className="hidden sm:flex items-center bg-background border rounded-md p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('A4_DUAL')}
                className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                  viewMode === 'A4_DUAL' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                A4 Dual Copy
              </button>
              <button
                type="button"
                onClick={() => setViewMode('STUDENT_ONLY')}
                className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                  viewMode === 'STUDENT_ONLY' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Student Copy
              </button>
              <button
                type="button"
                onClick={() => setViewMode('OFFICE_ONLY')}
                className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                  viewMode === 'OFFICE_ONLY' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Office Copy
              </button>
            </div>

            <Button onClick={handlePrint} size="sm" className="gap-1.5 h-8 bg-primary">
              <Printer className="w-3.5 h-3.5" />
              Print A4 Receipt
            </Button>
          </div>
        </DialogHeader>

        {/* Modal Scrollable Preview & Print Container */}
        <div className="overflow-y-auto p-4 sm:p-6 bg-neutral-100 dark:bg-neutral-900/50 flex-1">
          {/* Complete A4 Sheet Container */}
          <div
            id="printable-receipt-container"
            className="max-w-[210mm] mx-auto bg-white text-slate-900 p-5 sm:p-7 rounded-lg shadow-sm border border-slate-200 space-y-4"
          >
            {/* Copy 1: Student Copy */}
            {(viewMode === 'A4_DUAL' || viewMode === 'STUDENT_ONLY') && (
              <div className="receipt-section">
                <ReceiptSlip
                  copyType="STUDENT COPY"
                  copyBadge="ORIGINAL"
                  receipt={receipt}
                  instituteName={instituteName}
                  tagline={tagline}
                  address={address}
                  phone={phone}
                  email={email}
                  receiptFooter={receiptFooter}
                  logoUrl={logoUrl}
                />
              </div>
            )}

            {/* Perforation / Scissor Cut Divider */}
            {viewMode === 'A4_DUAL' && (
              <div className="receipt-cut-line relative flex items-center justify-center my-4 py-1.5 border-t-2 border-dashed border-slate-400 text-slate-500">
                <div className="absolute bg-white px-4 flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-600">
                  <Scissors className="w-3.5 h-3.5 transform -rotate-90 text-slate-500" />
                  <span>Cut or fold along dotted line for student / office copy</span>
                  <Scissors className="w-3.5 h-3.5 transform rotate-90 text-slate-500" />
                </div>
              </div>
            )}

            {/* Copy 2: Office Copy */}
            {(viewMode === 'A4_DUAL' || viewMode === 'OFFICE_ONLY') && (
              <div className="receipt-section">
                <ReceiptSlip
                  copyType="OFFICE COPY"
                  copyBadge="OFFICE RECORD"
                  receipt={receipt}
                  instituteName={instituteName}
                  tagline={tagline}
                  address={address}
                  phone={phone}
                  email={email}
                  receiptFooter={receiptFooter}
                  logoUrl={logoUrl}
                />
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Controls */}
        <DialogFooter className="p-3 bg-muted/30 border-t flex sm:justify-between no-print flex-shrink-0">
          <p className="text-xs text-muted-foreground self-center hidden sm:block">
            Both copies are calibrated to print gracefully on a single A4 sheet without crowding or spilling over.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
            <Button
              type="button"
              onClick={handleSendWhatsApp}
              size="sm"
              className="gap-1.5 bg-[#25D366] hover:bg-[#20ba59] text-white font-medium"
            >
              <WhatsAppIcon className="w-4 h-4" />
              Send on WhatsApp
            </Button>
            <Button onClick={handlePrint} size="sm" className="gap-1.5 bg-primary">
              <Printer className="w-3.5 h-3.5" />
              Print Dual-Copy Slip
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default FeeReceiptModal
