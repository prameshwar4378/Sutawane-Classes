import React, { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Printer,
  FileText,
  Download,
  GraduationCap,
  Layers,
  CheckCircle2,
  Calendar,
  Building2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Maximize2,
  Minimize2,
  X,
  ShieldCheck,
  PhoneCall,
  Clock,
  Sparkles,
} from 'lucide-react'
import { formatCurrency, formatDate, formatDateLong } from '@/lib/utils'
import { executePrintDocument, executePreviewPDF, executeSavePDF } from '@/lib/electronPrint'

export interface FinancialSummaryData {
  totalCollections: number
  collectionsCount: number
  totalExpenses: number
  expensesCount: number
  netMovement: number
  isProfit: boolean
  collectionsByMode?: Record<string, { count: number; amount: number }>
  expensesByCategory?: Record<string, { count: number; amount: number }>
}

export interface CollectionRecord {
  id: string
  receiptNumber: string
  paymentDate: string
  studentName: string
  rollNumber?: string
  standard?: string
  paymentMode: string
  referenceNumber?: string | null
  totalAmount: number
  parentPhone?: string | null
  branchName?: string | null
}

export interface ExpenseRecord {
  id: string
  referenceNumber?: string | null
  expenseDate: string
  description: string
  categoryName: string
  vendor?: string | null
  paidTo?: string | null
  paymentMode: string
  amount: number
  branchName?: string | null
}

interface OfficialFinancialReportModalProps {
  isOpen: boolean
  onClose: () => void
  summary: FinancialSummaryData
  collections: CollectionRecord[]
  expenses: ExpenseRecord[]
  periodLabel: string
  activeMode: 'DAILY' | 'MONTHLY' | 'CUSTOM'
  startDate?: string
  endDate?: string
  currentBranch?: { id: string; name: string; address?: string; phone?: string } | null
  currentSession?: { id: string; name: string } | null
  settings?: any
  activeLogoUrl?: string | null
}

type Orientation = 'PORTRAIT' | 'LANDSCAPE'
type ReportScope = 'ALL' | 'COLLECTIONS' | 'EXPENSES' | 'SUMMARY_ONLY'

export const OfficialFinancialReportModal: React.FC<OfficialFinancialReportModalProps> = ({
  isOpen,
  onClose,
  summary,
  collections,
  expenses,
  periodLabel,
  activeMode,
  startDate,
  endDate,
  currentBranch,
  currentSession,
  settings,
  activeLogoUrl,
}) => {
  const [orientation, setOrientation] = useState<Orientation>('PORTRAIT')
  const [scope, setScope] = useState<ReportScope>('ALL')
  const [isPrinting, setIsPrinting] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Institute Branding details
  const instituteName = (settings?.institute_name || currentBranch?.name || 'SUTAWANE CLASSES').toUpperCase()
  const tagline = settings?.tagline || 'Excellence in Coaching & Board Exam Preparations'
  const address = currentBranch?.address || settings?.address || 'Main Campus, Maharashtra'
  const phone = currentBranch?.phone || settings?.phone || '+91 7776824564'
  const helpline = '7776824564 (Mr. Rameshwar Pawar)'
  const email = settings?.email || 'contact@sutawaneclasses.com'
  const logoUrl = activeLogoUrl || settings?.logo_url || null

  const reportTitle =
    activeMode === 'DAILY'
      ? 'DAILY FINANCIAL STATEMENT & AUDIT REPORT'
      : activeMode === 'MONTHLY'
      ? 'MONTHLY FINANCIAL STATEMENT & AUDIT REPORT'
      : 'COMPREHENSIVE FINANCIAL STATEMENT & AUDIT REPORT'

  const branchScopeName = currentBranch ? currentBranch.name : 'All Branches (Consolidated)'
  const sessionScopeName = currentSession ? currentSession.name : 'All Academic Sessions'

  const generatedTimestamp = useMemo(() => {
    const now = new Date()
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(now)
  }, [])

  const auditId = useMemo(() => {
    const now = new Date()
    const dStr = now.toISOString().slice(0, 10).replace(/-/g, '')
    const tStr = String(now.getTime()).slice(-4)
    return `AUD-${dStr}-${tStr}`
  }, [])

  // Sort collections by date ascending, then receipt number
  const sortedCollections = useMemo(() => {
    return [...collections].sort((a, b) => {
      const dateA = new Date(a.paymentDate).getTime()
      const dateB = new Date(b.paymentDate).getTime()
      if (dateA !== dateB) return dateA - dateB
      return (a.receiptNumber || '').localeCompare(b.receiptNumber || '')
    })
  }, [collections])

  // Sort expenses by date ascending, then reference number
  const sortedExpenses = useMemo(() => {
    return [...expenses].sort((a, b) => {
      const dateA = new Date(a.expenseDate).getTime()
      const dateB = new Date(b.expenseDate).getTime()
      if (dateA !== dateB) return dateA - dateB
      return (a.referenceNumber || '').localeCompare(b.referenceNumber || '')
    })
  }, [expenses])

  // Calculate totals
  const totalCollectionsCalculated = useMemo(
    () => sortedCollections.reduce((sum, c) => sum + (c.totalAmount || 0), 0),
    [sortedCollections]
  )
  const totalExpensesCalculated = useMemo(
    () => sortedExpenses.reduce((sum, e) => sum + (e.amount || 0), 0),
    [sortedExpenses]
  )
  const netSurplusCalculated = totalCollectionsCalculated - totalExpensesCalculated
  const expenseRatio =
    totalCollectionsCalculated > 0
      ? ((totalExpensesCalculated / totalCollectionsCalculated) * 100).toFixed(1)
      : '0.0'

  // Generate HTML document for printing
  const generatePrintHTML = () => {
    const isLandscape = orientation === 'LANDSCAPE'
    const pageSizeCss = isLandscape ? 'A4 landscape' : 'A4 portrait'
    const maxDocWidth = isLandscape ? '277mm' : '194mm'

    // HTML for Collection rows
    const collectionRowsHTML = sortedCollections
      .map((c, idx) => {
        const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc'
        return `
          <tr style="background: ${rowBg}; border-bottom: 1px solid #e2e8f0; page-break-inside: avoid;">
            <td style="padding: 4.5px 6px; text-align: center; font-family: monospace; font-size: 8.5px; color: #64748b;">${idx + 1}</td>
            <td style="padding: 4.5px 6px; text-align: center; font-size: 8.5px; color: #334155; white-space: nowrap;">${formatDate(c.paymentDate)}</td>
            <td style="padding: 4.5px 6px; font-family: monospace; font-weight: 700; font-size: 9px; color: #1e293b; white-space: nowrap;">${c.receiptNumber || '—'}</td>
            <td style="padding: 4.5px 6px; font-weight: 700; font-size: 9px; color: #0f172a;">${c.studentName || '—'}</td>
            <td style="padding: 4.5px 6px; text-align: center; font-family: monospace; font-size: 8.5px; color: #475569;">${c.rollNumber || '—'}</td>
            <td style="padding: 4.5px 6px; font-size: 8.5px; color: #334155;">${c.standard || '—'}</td>
            <td style="padding: 4.5px 6px; text-align: center; font-size: 8.5px; font-weight: 600; color: #1e293b;">
              <span style="display: inline-block; padding: 1.5px 5px; border-radius: 3px; background: #e0f2fe; color: #0369a1; font-size: 8px; font-weight: 700;">
                ${c.paymentMode || 'CASH'}
              </span>
            </td>
            <td style="padding: 4.5px 6px; font-family: monospace; font-size: 8px; color: #64748b; white-space: nowrap;">${c.referenceNumber || '—'}</td>
            <td style="padding: 4.5px 6px; text-align: right; font-weight: 800; font-size: 9.5px; color: #047857; white-space: nowrap;">${formatCurrency(c.totalAmount)}</td>
          </tr>
        `
      })
      .join('')

    // HTML for Expense rows
    const expenseRowsHTML = sortedExpenses
      .map((e, idx) => {
        const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc'
        return `
          <tr style="background: ${rowBg}; border-bottom: 1px solid #e2e8f0; page-break-inside: avoid;">
            <td style="padding: 4.5px 6px; text-align: center; font-family: monospace; font-size: 8.5px; color: #64748b;">${idx + 1}</td>
            <td style="padding: 4.5px 6px; text-align: center; font-size: 8.5px; color: #334155; white-space: nowrap;">${formatDate(e.expenseDate)}</td>
            <td style="padding: 4.5px 6px; font-family: monospace; font-weight: 700; font-size: 9px; color: #1e293b; white-space: nowrap;">${e.referenceNumber || `VCH-${String(idx + 1).padStart(4, '0')}`}</td>
            <td style="padding: 4.5px 6px; font-size: 8.5px; font-weight: 600; color: #991b1b;">
              <span style="display: inline-block; padding: 1.5px 5px; border-radius: 3px; background: #fee2e2; color: #991b1b; font-size: 8px; font-weight: 700;">
                ${e.categoryName || 'General'}
              </span>
            </td>
            <td style="padding: 4.5px 6px; font-size: 8.5px; color: #0f172a;">${e.description || '—'}</td>
            <td style="padding: 4.5px 6px; font-size: 8.5px; color: #475569;">${e.vendor || e.paidTo || '—'}</td>
            <td style="padding: 4.5px 6px; text-align: center; font-size: 8px; font-weight: 600; color: #475569;">${e.paymentMode || 'CASH'}</td>
            <td style="padding: 4.5px 6px; text-align: right; font-weight: 800; font-size: 9.5px; color: #be123c; white-space: nowrap;">${formatCurrency(e.amount)}</td>
          </tr>
        `
      })
      .join('')

    // Mode breakdown badges HTML
    const collectionsByModeHTML = Object.entries(summary.collectionsByMode || {})
      .map(([mode, data]: [string, any]) => `
        <span style="display: inline-block; padding: 2px 6px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 4px; font-size: 8.5px; font-weight: 600; color: #065f46; margin: 2px;">
          ${mode}: <strong>${formatCurrency(data.amount)}</strong> (${data.count})
        </span>
      `)
      .join('')

    const expensesByCategoryHTML = Object.entries(summary.expensesByCategory || {})
      .map(([cat, data]: [string, any]) => `
        <span style="display: inline-block; padding: 2px 6px; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 4px; font-size: 8.5px; font-weight: 600; color: #9f1239; margin: 2px;">
          ${cat}: <strong>${formatCurrency(data.amount)}</strong>
        </span>
      `)
      .join('')

    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000'

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <base href="${origin}/">
        <title>${reportTitle} - ${periodLabel}</title>
        <style>
          @page {
            size: ${pageSizeCss};
            margin: 8mm 8mm 10mm 8mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            background: #ffffff;
            color: #0f172a;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            font-size: 9px;
            line-height: 1.35;
          }
          .report-sheet {
            width: 100%;
            max-width: ${maxDocWidth};
            margin: 0 auto;
            box-sizing: border-box;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          thead {
            display: table-header-group;
          }
          tfoot {
            display: table-footer-group;
          }
          tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .avoid-break {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .section-title {
            page-break-after: avoid;
            break-after: avoid;
          }
        </style>
      </head>
      <body>
        <div class="report-sheet">
          <!-- 1. OFFICIAL INSTITUTE HEADER / LETTERHEAD -->
          <div style="border-bottom: 2.5px solid #28375C; padding-bottom: 8px; margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
              <!-- Left: Institute Logo & Details -->
              <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                ${
                  logoUrl
                    ? `<img src="${logoUrl}" alt="Logo" style="width: 52px; height: 52px; object-fit: contain; border-radius: 6px;" />`
                    : `<div style="width: 48px; height: 48px; border-radius: 6px; background: #28375C; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 22px; flex-shrink: 0;">S</div>`
                }
                <div>
                  <h1 style="margin: 0; font-size: 19px; font-weight: 900; letter-spacing: 0.02em; text-transform: uppercase; color: #28375C; line-height: 1.15;">
                    ${instituteName}
                  </h1>
                  <p style="margin: 2px 0 0; font-size: 9.5px; font-weight: 700; color: #475569; letter-spacing: 0.01em;">
                    ${tagline}
                  </p>
                  <p style="margin: 2px 0 0; font-size: 8.5px; color: #64748b;">
                    ${address} • <strong>Tel/Helpline:</strong> ${phone} • <strong>Support:</strong> ${helpline} • <strong>Email:</strong> ${email}
                  </p>
                </div>
              </div>

              <!-- Right: Report Badge & Scope Metadata -->
              <div style="text-align: right; flex-shrink: 0;">
                <span style="display: inline-block; padding: 4px 10px; background: #28375C; color: #ffffff; font-weight: 800; font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; border-radius: 4px;">
                  ${reportTitle}
                </span>
                <div style="margin-top: 4px; font-size: 10px; font-weight: 800; color: #0f172a;">
                  ${periodLabel}
                </div>
                <div style="font-size: 8.5px; color: #475569; margin-top: 2px;">
                  Scope: <strong>${branchScopeName}</strong> • Session: <strong>${sessionScopeName}</strong>
                </div>
                <div style="font-size: 8px; color: #64748b; font-family: monospace; margin-top: 2px;">
                  Ref: ${auditId} • Generated: ${generatedTimestamp}
                </div>
              </div>
            </div>
          </div>

          <!-- 2. EXECUTIVE FINANCIAL PERFORMANCE SUMMARY (KPI BOXES) -->
          <div class="avoid-break" style="margin-bottom: 12px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
              <!-- Box 1: Fee Collections (Inflow) -->
              <div style="border: 1.5px solid #059669; border-radius: 6px; background: #f0fdf4; padding: 8px 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #bbf7d0; padding-bottom: 4px; margin-bottom: 4px;">
                  <span style="font-size: 8.5px; font-weight: 800; text-transform: uppercase; color: #065f46; letter-spacing: 0.04em;">
                    TOTAL COLLECTIONS (INFLOW)
                  </span>
                  <span style="font-size: 8px; font-weight: 700; color: #047857; background: #dcfce7; padding: 1px 4px; border-radius: 3px;">
                    ${sortedCollections.length} Receipts
                  </span>
                </div>
                <div style="font-size: 17px; font-weight: 900; color: #047857; margin-bottom: 2px;">
                  ${formatCurrency(totalCollectionsCalculated)}
                </div>
                <div style="font-size: 8px; color: #475569; margin-bottom: 4px;">
                  Verified student tuition and academic fee deposits
                </div>
                ${collectionsByModeHTML ? `<div style="border-top: 1px dashed #bbf7d0; padding-top: 4px; display: flex; flex-wrap: wrap; gap: 2px;">${collectionsByModeHTML}</div>` : ''}
              </div>

              <!-- Box 2: Operational Expenses (Outflow) -->
              <div style="border: 1.5px solid #e11d48; border-radius: 6px; background: #fff1f2; padding: 8px 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #fecdd3; padding-bottom: 4px; margin-bottom: 4px;">
                  <span style="font-size: 8.5px; font-weight: 800; text-transform: uppercase; color: #9f1239; letter-spacing: 0.04em;">
                    OPERATING EXPENSES (OUTFLOW)
                  </span>
                  <span style="font-size: 8px; font-weight: 700; color: #be123c; background: #ffe4e6; padding: 1px 4px; border-radius: 3px;">
                    ${sortedExpenses.length} Vouchers
                  </span>
                </div>
                <div style="font-size: 17px; font-weight: 900; color: #be123c; margin-bottom: 2px;">
                  ${formatCurrency(totalExpensesCalculated)}
                </div>
                <div style="font-size: 8px; color: #475569; margin-bottom: 4px;">
                  Rent, tutor salaries, bills, and operational maintenance
                </div>
                ${expensesByCategoryHTML ? `<div style="border-top: 1px dashed #fecdd3; padding-top: 4px; display: flex; flex-wrap: wrap; gap: 2px;">${expensesByCategoryHTML}</div>` : ''}
              </div>

              <!-- Box 3: Net Surplus / Deficit (Net Movement) -->
              <div style="border: 1.5px solid ${netSurplusCalculated >= 0 ? '#2563eb' : '#dc2626'}; border-radius: 6px; background: ${netSurplusCalculated >= 0 ? '#eff6ff' : '#fef2f2'}; padding: 8px 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid ${netSurplusCalculated >= 0 ? '#bfdbfe' : '#fecaca'}; padding-bottom: 4px; margin-bottom: 4px;">
                  <span style="font-size: 8.5px; font-weight: 800; text-transform: uppercase; color: ${netSurplusCalculated >= 0 ? '#1e40af' : '#991b1b'}; letter-spacing: 0.04em;">
                    ${netSurplusCalculated >= 0 ? 'NET SURPLUS / PROFIT' : 'NET OPERATIONAL DEFICIT'}
                  </span>
                  <span style="font-size: 8px; font-weight: 800; color: #ffffff; background: ${netSurplusCalculated >= 0 ? '#2563eb' : '#dc2626'}; padding: 1px 5px; border-radius: 3px;">
                    ${netSurplusCalculated >= 0 ? 'SURPLUS (+)' : 'DEFICIT (-)'}
                  </span>
                </div>
                <div style="font-size: 17px; font-weight: 900; color: ${netSurplusCalculated >= 0 ? '#1d4ed8' : '#b91c1c'}; margin-bottom: 2px;">
                  ${netSurplusCalculated >= 0 ? '+' : ''}${formatCurrency(netSurplusCalculated)}
                </div>
                <div style="font-size: 8px; color: #475569; margin-bottom: 4px;">
                  Gross Collections minus Center Operational Expenses
                </div>
                <div style="border-top: 1px dashed ${netSurplusCalculated >= 0 ? '#bfdbfe' : '#fecaca'}; padding-top: 4px; font-size: 8px; font-weight: 700; color: #475569;">
                  Expense Ratio: <strong>${expenseRatio}%</strong> of realized revenue
                </div>
              </div>
            </div>
          </div>

          <!-- 3. FINANCIAL MOVEMENT AUDIT SUMMARY TABLE -->
          <div class="avoid-break" style="margin-bottom: 12px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
            <div style="background: #f1f5f9; padding: 5px 10px; border-bottom: 1px solid #cbd5e1; font-weight: 800; font-size: 9px; color: #1e293b; display: flex; justify-content: space-between; align-items: center;">
              <span>FINANCIAL MOVEMENT AUDIT SUMMARY</span>
              <span style="font-family: monospace; font-size: 8px; color: #64748b;">SCOPE: ${branchScopeName.toUpperCase()}</span>
            </div>
            <table>
              <thead>
                <tr style="background: #28375C; color: #ffffff; font-size: 8.5px; font-weight: 700; text-transform: uppercase;">
                  <th style="padding: 5px 8px; text-align: left;">Category / Accounting Stream</th>
                  <th style="padding: 5px 8px; text-align: left;">Branch Scope</th>
                  <th style="padding: 5px 8px; text-align: center;">Movement Type</th>
                  <th style="padding: 5px 8px; text-align: center;">Transaction Volume</th>
                  <th style="padding: 5px 8px; text-align: right;">Total Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom: 1px solid #e2e8f0; font-size: 8.5px;">
                  <td style="padding: 5px 8px; font-weight: 700; color: #0f172a;">Student Tuition & Fee Collections</td>
                  <td style="padding: 5px 8px; color: #334155;">${branchScopeName}</td>
                  <td style="padding: 5px 8px; text-align: center;">
                    <span style="background: #dcfce7; color: #047857; font-weight: 800; padding: 1.5px 6px; border-radius: 3px; font-size: 8px;">
                      INFLOW (+)
                    </span>
                  </td>
                  <td style="padding: 5px 8px; text-align: center; font-weight: 600;">${sortedCollections.length} receipts</td>
                  <td style="padding: 5px 8px; text-align: right; font-weight: 800; color: #047857; font-size: 9.5px;">
                    ${formatCurrency(totalCollectionsCalculated)}
                  </td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0; font-size: 8.5px;">
                  <td style="padding: 5px 8px; font-weight: 700; color: #0f172a;">Operating Center Expenditures</td>
                  <td style="padding: 5px 8px; color: #334155;">${branchScopeName}</td>
                  <td style="padding: 5px 8px; text-align: center;">
                    <span style="background: #fee2e2; color: #b91c1c; font-weight: 800; padding: 1.5px 6px; border-radius: 3px; font-size: 8px;">
                      OUTFLOW (-)
                    </span>
                  </td>
                  <td style="padding: 5px 8px; text-align: center; font-weight: 600;">${sortedExpenses.length} vouchers</td>
                  <td style="padding: 5px 8px; text-align: right; font-weight: 800; color: #be123c; font-size: 9.5px;">
                    ${formatCurrency(totalExpensesCalculated)}
                  </td>
                </tr>
                <tr style="background: #f8fafc; font-weight: 900; font-size: 9px; border-top: 1.5px solid #28375C;">
                  <td colspan="4" style="padding: 6px 8px; text-transform: uppercase; color: #1e293b; letter-spacing: 0.03em;">
                    NET CASH & FINANCIAL BALANCE FOR SELECTED PERIOD
                  </td>
                  <td style="padding: 6px 8px; text-align: right; font-size: 11px; font-weight: 900; color: ${netSurplusCalculated >= 0 ? '#1d4ed8' : '#b91c1c'};">
                    ${netSurplusCalculated >= 0 ? '+' : ''}${formatCurrency(netSurplusCalculated)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- 4. PART I: DETAILED COLLECTIONS TRANSACTION REGISTER -->
          ${
            (scope === 'ALL' || scope === 'COLLECTIONS') && sortedCollections.length > 0
              ? `
              <div style="margin-bottom: 14px;">
                <div class="section-title" style="background: #28375C; color: #ffffff; padding: 5px 8px; font-weight: 800; font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; border-radius: 4px 4px 0 0; display: flex; justify-content: space-between; align-items: center;">
                  <span>PART I: STUDENT FEE COLLECTIONS REGISTER (INFLOW)</span>
                  <span style="font-size: 8px; font-weight: 600;">Total: ${sortedCollections.length} Confirmed Receipts</span>
                </div>
                <table style="border: 1px solid #cbd5e1; border-top: none;">
                  <thead>
                    <tr style="background: #f1f5f9; color: #1e293b; font-size: 8px; font-weight: 800; text-transform: uppercase; border-bottom: 1.5px solid #cbd5e1;">
                      <th style="padding: 4px 6px; width: 4%; text-align: center;">#</th>
                      <th style="padding: 4px 6px; width: 9%; text-align: center;">Date</th>
                      <th style="padding: 4px 6px; width: 14%; text-align: left;">Receipt No</th>
                      <th style="padding: 4px 6px; width: 23%; text-align: left;">Student Name</th>
                      <th style="padding: 4px 6px; width: 8%; text-align: center;">Roll No</th>
                      <th style="padding: 4px 6px; width: 11%; text-align: left;">Class / Course</th>
                      <th style="padding: 4px 6px; width: 9%; text-align: center;">Mode</th>
                      <th style="padding: 4px 6px; width: 10%; text-align: left;">Ref / Txn</th>
                      <th style="padding: 4px 6px; width: 12%; text-align: right;">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${collectionRowsHTML}
                    <!-- Subtotal Row -->
                    <tr style="background: #f1f5f9; font-weight: 900; font-size: 9px; border-top: 2px solid #28375C; page-break-inside: avoid;">
                      <td colspan="8" style="padding: 5px 8px; text-transform: uppercase; color: #1e293b;">
                        SUBTOTAL FEE COLLECTIONS (${sortedCollections.length} RECORDS)
                      </td>
                      <td style="padding: 5px 6px; text-align: right; font-weight: 900; color: #047857; font-size: 10px; white-space: nowrap;">
                        ${formatCurrency(totalCollectionsCalculated)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            `
              : ''
          }

          <!-- 5. PART II: DETAILED OPERATING EXPENSES REGISTER -->
          ${
            (scope === 'ALL' || scope === 'EXPENSES') && sortedExpenses.length > 0
              ? `
              <div style="margin-bottom: 14px;">
                <div class="section-title" style="background: #be123c; color: #ffffff; padding: 5px 8px; font-weight: 800; font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; border-radius: 4px 4px 0 0; display: flex; justify-content: space-between; align-items: center;">
                  <span>PART II: OPERATIONAL EXPENDITURES REGISTER (OUTFLOW)</span>
                  <span style="font-size: 8px; font-weight: 600;">Total: ${sortedExpenses.length} Expense Vouchers</span>
                </div>
                <table style="border: 1px solid #cbd5e1; border-top: none;">
                  <thead>
                    <tr style="background: #f1f5f9; color: #1e293b; font-size: 8px; font-weight: 800; text-transform: uppercase; border-bottom: 1.5px solid #cbd5e1;">
                      <th style="padding: 4px 6px; width: 4%; text-align: center;">#</th>
                      <th style="padding: 4px 6px; width: 9%; text-align: center;">Date</th>
                      <th style="padding: 4px 6px; width: 13%; text-align: left;">Voucher Ref</th>
                      <th style="padding: 4px 6px; width: 14%; text-align: left;">Category</th>
                      <th style="padding: 4px 6px; width: 26%; text-align: left;">Description / Purpose</th>
                      <th style="padding: 4px 6px; width: 14%; text-align: left;">Paid To / Vendor</th>
                      <th style="padding: 4px 6px; width: 8%; text-align: center;">Mode</th>
                      <th style="padding: 4px 6px; width: 12%; text-align: right;">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${expenseRowsHTML}
                    <!-- Subtotal Row -->
                    <tr style="background: #f1f5f9; font-weight: 900; font-size: 9px; border-top: 2px solid #be123c; page-break-inside: avoid;">
                      <td colspan="7" style="padding: 5px 8px; text-transform: uppercase; color: #1e293b;">
                        SUBTOTAL OPERATING EXPENSES (${sortedExpenses.length} RECORDS)
                      </td>
                      <td style="padding: 5px 6px; text-align: right; font-weight: 900; color: #be123c; font-size: 10px; white-space: nowrap;">
                        ${formatCurrency(totalExpensesCalculated)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            `
              : ''
          }

          <!-- 6. FINAL FINANCIAL RECONCILIATION SUMMARY STRIP -->
          ${
            scope === 'ALL'
              ? `
              <div class="avoid-break" style="margin-bottom: 14px; padding: 7px 12px; background: #f8fafc; border: 1.5px solid #28375C; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <span style="font-size: 8px; color: #64748b; text-transform: uppercase; font-weight: 700;">Financial Reconciliation:</span>
                  <span style="font-size: 9.5px; font-weight: 800; color: #0f172a; margin-left: 6px;">
                    Inflow: <strong style="color: #047857;">${formatCurrency(totalCollectionsCalculated)}</strong> • Outflow: <strong style="color: #be123c;">${formatCurrency(totalExpensesCalculated)}</strong>
                  </span>
                </div>
                <div style="text-align: right;">
                  <span style="font-size: 8px; color: #64748b; text-transform: uppercase; font-weight: 700;">Closing Net Balance:</span>
                  <span style="font-size: 11px; font-weight: 900; color: ${netSurplusCalculated >= 0 ? '#1d4ed8' : '#b91c1c'}; margin-left: 6px;">
                    ${netSurplusCalculated >= 0 ? '+' : ''}${formatCurrency(netSurplusCalculated)}
                  </span>
                </div>
              </div>
            `
              : ''
          }

          <!-- 7. AUDIT CERTIFICATION & SIGNATORY FOOTER -->
          <div class="avoid-break" style="margin-top: 14px; padding-top: 10px; border-top: 1.5px solid #cbd5e1;">
            <div style="font-size: 7.5px; color: #64748b; margin-bottom: 24px; font-style: italic; line-height: 1.3;">
              * Certification Declaration: This document is an authoritative financial movement statement generated by the Sutawane Classes Management System. All revenue collections and expense disbursements have been verified against daily cash registers, bank credit confirmations, and official vouchers.
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; align-items: flex-end; text-align: center;">
              <div>
                <div style="border-bottom: 1.5px solid #64748b; margin-bottom: 4px; height: 32px;"></div>
                <div style="font-size: 8.5px; font-weight: 800; text-transform: uppercase; color: #0f172a;">Prepared By</div>
                <div style="font-size: 7.5px; color: #64748b;">Accountant / Data Operator</div>
              </div>

              <div>
                <div style="border-bottom: 1.5px solid #64748b; margin-bottom: 4px; height: 32px;"></div>
                <div style="font-size: 8.5px; font-weight: 800; text-transform: uppercase; color: #0f172a;">Verified By</div>
                <div style="font-size: 7.5px; color: #64748b;">Internal Audit Officer</div>
              </div>

              <div>
                <div style="border-bottom: 1.5px solid #64748b; margin-bottom: 4px; height: 32px;"></div>
                <div style="font-size: 8.5px; font-weight: 800; text-transform: uppercase; color: #0f172a;">Authorized Signatory</div>
                <div style="font-size: 7.5px; color: #64748b;">Director / Principal</div>
              </div>

              <div style="border: 1px dashed #94a3b8; border-radius: 4px; padding: 6px; height: 46px; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                <span style="font-size: 7px; color: #94a3b8; text-transform: uppercase; font-weight: 700;">Official Stamp</span>
                <span style="font-size: 6.5px; color: #cbd5e1;">Institute Seal</span>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  }

  // Unified Printing & PDF Actions
  const handleExecutePrint = async () => {
    setIsPrinting(true)
    try {
      const printDoc = generatePrintHTML()
      await executePrintDocument({
        html: printDoc,
        title: `Financial_Statement_${auditId}`,
        landscape: orientation === 'LANDSCAPE',
        pageSize: 'A4',
        fallbackBodyClass: 'printing-report',
      })
    } finally {
      setIsPrinting(false)
    }
  }

  const handlePreviewPDF = async () => {
    setIsPreviewing(true)
    try {
      const printDoc = generatePrintHTML()
      await executePreviewPDF({
        html: printDoc,
        title: `Financial_Statement_${auditId}`,
        landscape: orientation === 'LANDSCAPE',
        pageSize: 'A4',
      })
    } finally {
      setIsPreviewing(false)
    }
  }

  const handleSavePDF = async () => {
    setIsSaving(true)
    try {
      const printDoc = generatePrintHTML()
      const cleanPeriod = (periodLabel || 'Report').replace(/[^a-zA-Z0-9_-]/g, '_')
      await executeSavePDF({
        html: printDoc,
        defaultFilename: `Financial_Statement_${auditId}_${cleanPeriod}.pdf`,
        landscape: orientation === 'LANDSCAPE',
        pageSize: 'A4',
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl h-[92vh] flex flex-col p-0 gap-0 overflow-hidden bg-slate-900 border-slate-800 text-slate-100">
        {/* Top Control Bar */}
        <div className="p-3.5 px-5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center font-bold">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-white flex items-center gap-2">
                Official A4 Financial Statement & Movement Report
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {auditId}
                </span>
              </DialogTitle>
              <p className="text-xs text-slate-400 mt-0.5">
                {periodLabel} • {branchScopeName}
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Orientation Switcher */}
            <div className="flex items-center bg-slate-800/90 rounded-lg p-0.5 border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setOrientation('PORTRAIT')}
                className={`px-2.5 py-1 rounded font-semibold transition-all ${
                  orientation === 'PORTRAIT'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Vertical portrait orientation (Standard A4)"
              >
                Vertical (Portrait A4)
              </button>
              <button
                type="button"
                onClick={() => setOrientation('LANDSCAPE')}
                className={`px-2.5 py-1 rounded font-semibold transition-all ${
                  orientation === 'LANDSCAPE'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Horizontal landscape orientation (Wider Columns)"
              >
                Horizontal (Landscape A4)
              </button>
            </div>

            {/* Scope Filter */}
            <div className="flex items-center bg-slate-800/90 rounded-lg px-2 py-1 border border-slate-700 text-xs">
              <span className="text-slate-400 mr-1.5 font-medium">Scope:</span>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as ReportScope)}
                className="bg-transparent border-0 text-white font-semibold focus:outline-none cursor-pointer text-xs"
              >
                <option value="ALL" className="bg-slate-900 text-white">Full Statement (All {sortedCollections.length + sortedExpenses.length})</option>
                <option value="COLLECTIONS" className="bg-slate-900 text-white">Collections Only ({sortedCollections.length})</option>
                <option value="EXPENSES" className="bg-slate-900 text-white">Expenses Only ({sortedExpenses.length})</option>
                <option value="SUMMARY_ONLY" className="bg-slate-900 text-white">Executive Summary Only (1 Page)</option>
              </select>
            </div>

            {/* Save PDF Action */}
            <Button
              type="button"
              onClick={handleSavePDF}
              disabled={isSaving}
              variant="outline"
              className="h-8 px-3 text-xs gap-1.5 border-slate-700 bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-700"
              title="Save report as A4 PDF document"
            >
              <Download className="w-3.5 h-3.5 text-slate-300" />
              {isSaving ? 'Saving...' : 'Save PDF'}
            </Button>

            {/* A4 PDF Preview Action */}
            <Button
              type="button"
              onClick={handlePreviewPDF}
              disabled={isPreviewing}
              variant="outline"
              className="h-8 px-3 text-xs gap-1.5 border-blue-500/40 bg-blue-950/60 text-blue-300 hover:bg-blue-900/60 hover:text-white"
              title="Open full interactive A4 PDF preview in Microsoft Edge / System PDF Viewer"
            >
              <FileText className="w-3.5 h-3.5 text-blue-400" />
              {isPreviewing ? 'Opening...' : 'A4 PDF Preview'}
            </Button>

            {/* Primary Print Button */}
            <Button
              type="button"
              onClick={handleExecutePrint}
              disabled={isPrinting}
              className="h-8 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1.5 text-xs shadow-md shadow-emerald-950/40"
            >
              <Printer className="w-3.5 h-3.5" />
              {isPrinting ? 'Preparing Print...' : 'Print Report Now'}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Live A4 Document Preview Workspace */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950/70 flex justify-center">
          <div
            id="printable-financial-report"
            className={`bg-white text-slate-900 shadow-2xl transition-all border border-slate-300 p-8 ${
              orientation === 'PORTRAIT'
                ? 'w-full max-w-[210mm] min-h-[297mm]'
                : 'w-full max-w-[297mm] min-h-[210mm]'
            }`}
            style={{
              fontFamily:
                "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
            }}
          >
            {/* 1. Header Preview */}
            <div className="border-b-2 border-[#28375C] pb-3 mb-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Logo"
                      className="w-14 h-14 object-contain rounded-md"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded bg-[#28375C] text-white flex items-center justify-center font-black text-xl">
                      <GraduationCap className="w-7 h-7" />
                    </div>
                  )}
                  <div>
                    <h1 className="text-xl font-black uppercase text-[#28375C] tracking-tight">
                      {instituteName}
                    </h1>
                    <p className="text-xs font-semibold text-slate-700">{tagline}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {address} • <strong>Tel/Helpline:</strong> {phone} • <strong>Support:</strong> {helpline} • <strong>Email:</strong> {email}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="inline-block px-2.5 py-1 bg-[#28375C] text-white font-extrabold text-[10px] uppercase tracking-wider rounded">
                    {reportTitle}
                  </span>
                  <div className="text-xs font-bold text-slate-900 mt-1">{periodLabel}</div>
                  <div className="text-[10px] text-slate-600">
                    Scope: <strong>{branchScopeName}</strong> • Session: <strong>{sessionScopeName}</strong>
                  </div>
                  <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                    Ref: {auditId} • {generatedTimestamp}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Executive Financial Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              {/* Box 1 */}
              <div className="border border-emerald-300 bg-emerald-50/50 rounded-lg p-3">
                <div className="flex items-center justify-between text-[11px] font-bold text-emerald-900 pb-1 border-b border-emerald-200">
                  <span>TOTAL COLLECTIONS (INFLOW)</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-emerald-200/80 rounded font-bold">
                    {sortedCollections.length} Receipts
                  </span>
                </div>
                <div className="text-xl font-black text-emerald-700 mt-2">
                  {formatCurrency(totalCollectionsCalculated)}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Verified student tuition and fee receipts
                </div>
              </div>

              {/* Box 2 */}
              <div className="border border-rose-300 bg-rose-50/50 rounded-lg p-3">
                <div className="flex items-center justify-between text-[11px] font-bold text-rose-900 pb-1 border-b border-rose-200">
                  <span>OPERATING EXPENSES (OUTFLOW)</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-rose-200/80 rounded font-bold">
                    {sortedExpenses.length} Vouchers
                  </span>
                </div>
                <div className="text-xl font-black text-rose-700 mt-2">
                  {formatCurrency(totalExpensesCalculated)}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Rent, tutor salaries, and center expenses
                </div>
              </div>

              {/* Box 3 */}
              <div
                className={`border rounded-lg p-3 ${
                  netSurplusCalculated >= 0
                    ? 'border-blue-300 bg-blue-50/50'
                    : 'border-rose-300 bg-rose-50/50'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-bold pb-1 border-b border-blue-200">
                  <span className={netSurplusCalculated >= 0 ? 'text-blue-900' : 'text-rose-900'}>
                    {netSurplusCalculated >= 0 ? 'NET SURPLUS / PROFIT' : 'NET DEFICIT / LOSS'}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-bold text-white ${
                      netSurplusCalculated >= 0 ? 'bg-blue-600' : 'bg-rose-600'
                    }`}
                  >
                    {netSurplusCalculated >= 0 ? 'SURPLUS (+)' : 'DEFICIT (-)'}
                  </span>
                </div>
                <div
                  className={`text-xl font-black mt-2 ${
                    netSurplusCalculated >= 0 ? 'text-blue-700' : 'text-rose-700'
                  }`}
                >
                  {netSurplusCalculated >= 0 ? '+' : ''}
                  {formatCurrency(netSurplusCalculated)}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Expense Ratio: {expenseRatio}% of collections
                </div>
              </div>
            </div>

            {/* 3. Financial Movement Audit Summary Table */}
            <div className="border border-slate-300 rounded-lg overflow-hidden mb-4">
              <div className="bg-slate-100 px-3 py-2 border-b border-slate-300 text-xs font-bold text-slate-800 flex justify-between items-center">
                <span>FINANCIAL MOVEMENT AUDIT SUMMARY</span>
                <span className="font-mono text-[10px] text-slate-500">
                  SCOPE: {branchScopeName.toUpperCase()}
                </span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#28375C] text-white text-[11px]">
                    <th className="py-1.5 px-3 text-left">Accounting Stream</th>
                    <th className="py-1.5 px-3 text-left">Branch Scope</th>
                    <th className="py-1.5 px-3 text-center">Movement Type</th>
                    <th className="py-1.5 px-3 text-center">Volume</th>
                    <th className="py-1.5 px-3 text-right">Total Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="py-2 px-3 font-semibold text-slate-900">
                      Student Tuition & Fee Collections
                    </td>
                    <td className="py-2 px-3 text-slate-600">{branchScopeName}</td>
                    <td className="py-2 px-3 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Inflow (+)
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center font-medium text-slate-700">
                      {sortedCollections.length} receipts
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-emerald-600">
                      {formatCurrency(totalCollectionsCalculated)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-semibold text-slate-900">
                      Operating Center Expenditures
                    </td>
                    <td className="py-2 px-3 text-slate-600">{branchScopeName}</td>
                    <td className="py-2 px-3 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                        Outflow (-)
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center font-medium text-slate-700">
                      {sortedExpenses.length} vouchers
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-rose-600">
                      {formatCurrency(totalExpensesCalculated)}
                    </td>
                  </tr>
                  <tr className="bg-slate-100 font-bold border-t-2 border-[#28375C]">
                    <td colSpan={4} className="py-2.5 px-3 uppercase tracking-wide text-slate-900">
                      NET CASH & FINANCIAL BALANCE FOR SELECTED PERIOD
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right text-sm font-black ${
                        netSurplusCalculated >= 0 ? 'text-blue-600' : 'text-rose-600'
                      }`}
                    >
                      {netSurplusCalculated >= 0 ? '+' : ''}
                      {formatCurrency(netSurplusCalculated)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 4. Detailed Collections Table */}
            {(scope === 'ALL' || scope === 'COLLECTIONS') && sortedCollections.length > 0 && (
              <div className="mb-4">
                <div className="bg-[#28375C] text-white px-3 py-1.5 rounded-t font-bold text-xs flex justify-between items-center">
                  <span>PART I: STUDENT FEE COLLECTIONS REGISTER (INFLOW)</span>
                  <span className="text-[10px] opacity-90 font-medium">
                    {sortedCollections.length} Confirmed Receipts
                  </span>
                </div>
                <div className="border border-slate-300 border-t-0 rounded-b overflow-hidden">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 border-b border-slate-300 font-bold">
                        <th className="py-1 px-1.5 text-center w-8">#</th>
                        <th className="py-1 px-1.5 text-center">Date</th>
                        <th className="py-1 px-1.5 text-left">Receipt No</th>
                        <th className="py-1 px-1.5 text-left">Student Name</th>
                        <th className="py-1 px-1.5 text-center">Roll No</th>
                        <th className="py-1 px-1.5 text-left">Class</th>
                        <th className="py-1 px-1.5 text-center">Mode</th>
                        <th className="py-1 px-1.5 text-left">Ref / Txn</th>
                        <th className="py-1 px-1.5 text-right">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {sortedCollections.slice(0, 50).map((c, idx) => (
                        <tr key={c.id || idx} className="hover:bg-slate-50">
                          <td className="py-1 px-1.5 text-center font-mono text-slate-500">{idx + 1}</td>
                          <td className="py-1 px-1.5 text-center text-slate-600">{formatDate(c.paymentDate)}</td>
                          <td className="py-1 px-1.5 font-mono font-bold text-slate-900">{c.receiptNumber}</td>
                          <td className="py-1 px-1.5 font-semibold text-slate-900">{c.studentName}</td>
                          <td className="py-1 px-1.5 text-center font-mono text-slate-600">{c.rollNumber || '—'}</td>
                          <td className="py-1 px-1.5 text-slate-700">{c.standard || '—'}</td>
                          <td className="py-1 px-1.5 text-center font-medium">
                            <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 text-[9px] font-bold">
                              {c.paymentMode}
                            </span>
                          </td>
                          <td className="py-1 px-1.5 font-mono text-[9px] text-slate-500">{c.referenceNumber || '—'}</td>
                          <td className="py-1 px-1.5 text-right font-bold text-emerald-700">{formatCurrency(c.totalAmount)}</td>
                        </tr>
                      ))}
                      {sortedCollections.length > 50 && (
                        <tr className="bg-slate-50 italic text-slate-500 text-center">
                          <td colSpan={9} className="py-1.5">
                            ... and {sortedCollections.length - 50} more collection entries (all {sortedCollections.length} will be fully included in the official printout)
                          </td>
                        </tr>
                      )}
                      <tr className="bg-slate-100 font-bold border-t-2 border-[#28375C] text-xs">
                        <td colSpan={8} className="py-1.5 px-3 uppercase text-slate-900">
                          SUBTOTAL FEE COLLECTIONS ({sortedCollections.length} RECORDS)
                        </td>
                        <td className="py-1.5 px-1.5 text-right font-black text-emerald-700">
                          {formatCurrency(totalCollectionsCalculated)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 5. Detailed Expenses Table */}
            {(scope === 'ALL' || scope === 'EXPENSES') && sortedExpenses.length > 0 && (
              <div className="mb-4">
                <div className="bg-rose-700 text-white px-3 py-1.5 rounded-t font-bold text-xs flex justify-between items-center">
                  <span>PART II: OPERATIONAL EXPENDITURES REGISTER (OUTFLOW)</span>
                  <span className="text-[10px] opacity-90 font-medium">
                    {sortedExpenses.length} Expense Vouchers
                  </span>
                </div>
                <div className="border border-slate-300 border-t-0 rounded-b overflow-hidden">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 border-b border-slate-300 font-bold">
                        <th className="py-1 px-1.5 text-center w-8">#</th>
                        <th className="py-1 px-1.5 text-center">Date</th>
                        <th className="py-1 px-1.5 text-left">Voucher Ref</th>
                        <th className="py-1 px-1.5 text-left">Category</th>
                        <th className="py-1 px-1.5 text-left">Description</th>
                        <th className="py-1 px-1.5 text-left">Paid To / Vendor</th>
                        <th className="py-1 px-1.5 text-center">Mode</th>
                        <th className="py-1 px-1.5 text-right">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {sortedExpenses.slice(0, 50).map((e, idx) => (
                        <tr key={e.id || idx} className="hover:bg-slate-50">
                          <td className="py-1 px-1.5 text-center font-mono text-slate-500">{idx + 1}</td>
                          <td className="py-1 px-1.5 text-center text-slate-600">{formatDate(e.expenseDate)}</td>
                          <td className="py-1 px-1.5 font-mono font-bold text-slate-900">
                            {e.referenceNumber || `VCH-${String(idx + 1).padStart(4, '0')}`}
                          </td>
                          <td className="py-1 px-1.5">
                            <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 text-[9px] font-bold">
                              {e.categoryName}
                            </span>
                          </td>
                          <td className="py-1 px-1.5 text-slate-800 font-medium">{e.description}</td>
                          <td className="py-1 px-1.5 text-slate-600">{e.vendor || e.paidTo || '—'}</td>
                          <td className="py-1 px-1.5 text-center text-slate-700">{e.paymentMode}</td>
                          <td className="py-1 px-1.5 text-right font-bold text-rose-700">{formatCurrency(e.amount)}</td>
                        </tr>
                      ))}
                      {sortedExpenses.length > 50 && (
                        <tr className="bg-slate-50 italic text-slate-500 text-center">
                          <td colSpan={8} className="py-1.5">
                            ... and {sortedExpenses.length - 50} more expense vouchers (all {sortedExpenses.length} will be fully included in the official printout)
                          </td>
                        </tr>
                      )}
                      <tr className="bg-slate-100 font-bold border-t-2 border-rose-700 text-xs">
                        <td colSpan={7} className="py-1.5 px-3 uppercase text-slate-900">
                          SUBTOTAL OPERATING EXPENSES ({sortedExpenses.length} RECORDS)
                        </td>
                        <td className="py-1.5 px-1.5 text-right font-black text-rose-700">
                          {formatCurrency(totalExpensesCalculated)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 6. Closing Reconciliation Strip */}
            {scope === 'ALL' && (
              <div className="p-2.5 bg-slate-50 border-2 border-[#28375C] rounded-lg flex justify-between items-center mb-4 text-xs font-bold">
                <div>
                  <span className="text-slate-500 uppercase text-[10px]">Financial Reconciliation: </span>
                  <span className="text-slate-900 ml-1">
                    Inflow: <span className="text-emerald-700 font-black">{formatCurrency(totalCollectionsCalculated)}</span> • Outflow: <span className="text-rose-700 font-black">{formatCurrency(totalExpensesCalculated)}</span>
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 uppercase text-[10px]">Closing Net Balance: </span>
                  <span
                    className={`ml-1 text-sm font-black ${
                      netSurplusCalculated >= 0 ? 'text-blue-700' : 'text-rose-700'
                    }`}
                  >
                    {netSurplusCalculated >= 0 ? '+' : ''}
                    {formatCurrency(netSurplusCalculated)}
                  </span>
                </div>
              </div>
            )}

            {/* 7. Signatory & Audit Footer */}
            <div className="pt-4 border-t border-slate-300 mt-6">
              <p className="text-[10px] text-slate-500 italic mb-8">
                * Certification Declaration: This document is an authoritative financial movement statement generated by the Sutawane Classes Management System. All revenue collections and expense disbursements have been verified against daily cash registers, bank credit confirmations, and official vouchers.
              </p>

              <div className="grid grid-cols-4 gap-4 text-center items-end">
                <div>
                  <div className="border-b border-slate-600 mb-1 h-8"></div>
                  <div className="text-[11px] font-bold uppercase text-slate-900">Prepared By</div>
                  <div className="text-[9px] text-slate-500">Accountant / Operator</div>
                </div>

                <div>
                  <div className="border-b border-slate-600 mb-1 h-8"></div>
                  <div className="text-[11px] font-bold uppercase text-slate-900">Verified By</div>
                  <div className="text-[9px] text-slate-500">Internal Audit Officer</div>
                </div>

                <div>
                  <div className="border-b border-slate-600 mb-1 h-8"></div>
                  <div className="text-[11px] font-bold uppercase text-slate-900">Authorized Signatory</div>
                  <div className="text-[9px] text-slate-500">Director / Principal</div>
                </div>

                <div className="border border-dashed border-slate-400 rounded h-12 flex flex-col items-center justify-center">
                  <span className="text-[8px] uppercase font-bold text-slate-400">Official Seal</span>
                  <span className="text-[7px] text-slate-300">Institute Stamp</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Footer Actions */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            Live Print Preview: Standard A4 ({orientation === 'PORTRAIT' ? 'Vertical 210 × 297mm' : 'Horizontal 297 × 210mm'}). All records are formatted for crisp physical printing.
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-8 border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Close
            </Button>
            <Button
              onClick={handleExecutePrint}
              disabled={isPrinting}
              className="h-8 bg-primary hover:bg-primary/90 text-white font-bold gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              {isPrinting ? 'Printing...' : 'Print Official A4 Report'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
export default OfficialFinancialReportModal
