import React, { useState, useMemo, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useApp } from '@/context/AppContext'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  FileSpreadsheet,
  FileText,
  Printer,
  GraduationCap,
  Building2,
  Calendar,
  TrendingUp,
  TrendingDown,
  IndianRupee,
  Search,
  Download,
  CalendarDays,
  CalendarRange,
  RotateCcw,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react'
import { cn, formatCurrency, formatDate, formatDateLong, getTodayDateString, toInputDateString } from '@/lib/utils'
import { FeeReceiptModal, type ReceiptData } from '@/components/FeeReceiptModal'
import { OfficialFinancialReportModal } from '@/components/OfficialFinancialReportModal'
import { WhatsAppIcon, openWhatsApp, buildReceiptWhatsAppMessage } from '@/lib/whatsapp'
import * as XLSX from 'xlsx'
import {
  exportPaymentsToExcel,
  exportPaymentsToPDF,
  exportExpensesToExcel,
  exportExpensesToPDF,
  type PaymentExportItem,
  type ExpenseExportItem,
} from '@/lib/exportUtils'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 7 }, (_, i) => CURRENT_YEAR - 3 + i)

// Column Definitions
interface ColumnDef {
  id: string
  label: string
  alwaysVisible?: boolean
  defaultVisible: boolean
}

const ALL_COLLECTION_COLS: ColumnDef[] = [
  { id: 'srNo', label: '# / Sr No', defaultVisible: true },
  { id: 'receiptNo', label: 'Receipt Number', defaultVisible: true },
  { id: 'studentName', label: 'Student Name', alwaysVisible: true, defaultVisible: true },
  { id: 'rollNo', label: 'Roll Number', defaultVisible: true },
  { id: 'standard', label: 'Class / Course', defaultVisible: true },
  { id: 'paymentMode', label: 'Payment Mode', defaultVisible: true },
  { id: 'referenceNumber', label: 'Txn / Ref No', defaultVisible: true },
  { id: 'paymentDate', label: 'Payment Date', defaultVisible: true },
  { id: 'totalAmount', label: 'Amount (₹)', alwaysVisible: true, defaultVisible: true },
  { id: 'actions', label: 'Actions Toolbar', alwaysVisible: true, defaultVisible: true },
]

const ALL_EXPENSE_COLS: ColumnDef[] = [
  { id: 'srNo', label: '# / Sr No', defaultVisible: true },
  { id: 'referenceNumber', label: 'Voucher / Ref No', defaultVisible: true },
  { id: 'categoryName', label: 'Expense Category', defaultVisible: true },
  { id: 'description', label: 'Description / Purpose', alwaysVisible: true, defaultVisible: true },
  { id: 'vendor', label: 'Paid To / Vendor', defaultVisible: true },
  { id: 'paymentMode', label: 'Payment Mode', defaultVisible: true },
  { id: 'expenseDate', label: 'Disbursement Date', defaultVisible: true },
  { id: 'amount', label: 'Amount (₹)', alwaysVisible: true, defaultVisible: true },
]

export const DailyReportsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const {
    selectedBranchId,
    setSelectedBranchId,
    selectedSessionId,
    setSelectedSessionId,
    branches,
    sessions,
    currentBranch,
    currentSession,
    settings,
    activeLogoUrl,
  } = useApp()

  // Mode: 'DAILY' | 'MONTHLY' | 'CUSTOM'
  const initialMode = (searchParams.get('mode') as 'DAILY' | 'MONTHLY' | 'CUSTOM') || 'DAILY'
  const [activeMode, setActiveMode] = useState<'DAILY' | 'MONTHLY' | 'CUSTOM'>(initialMode)

  // 1. Daily state
  const todayStr = useMemo(() => getTodayDateString(), [])
  const [dailyDate, setDailyDate] = useState<string>(() => toInputDateString(searchParams.get('date')) || getTodayDateString())

  // 2. Monthly state
  const [selectedMonth, setSelectedMonth] = useState<number>(() => {
    const m = searchParams.get('month')
    return m !== null ? Number(m) : new Date().getMonth()
  })
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    const y = searchParams.get('year')
    return y !== null ? Number(y) : CURRENT_YEAR
  })

  // 3. Custom Date Range state
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const now = new Date()
    return getTodayDateString(new Date(now.getFullYear(), now.getMonth(), 1))
  })
  const [customEndDate, setCustomEndDate] = useState<string>(() => getTodayDateString())

  // Table view filter: 'ALL' | 'COLLECTIONS' | 'EXPENSES'
  const [activeTableTab, setActiveTableTab] = useState<'ALL' | 'COLLECTIONS' | 'EXPENSES'>('ALL')
  const [collectionSearch, setCollectionSearch] = useState('')
  const [expenseSearch, setExpenseSearch] = useState('')
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptData | null>(null)
  const [toastMsg, setToastMsg] = useState('')

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 4500)
  }

  // --- Collections Table UI States ---
  const [isColModalOpen, setIsColModalOpen] = useState(false)
  const [visibleColCols, setVisibleColCols] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('sutawane_daily_collections_cols_v1')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {}
    }
    const initial: Record<string, boolean> = {}
    ALL_COLLECTION_COLS.forEach((col) => {
      initial[col.id] = col.defaultVisible
    })
    return initial
  })

  const [collectionSortField, setCollectionSortField] = useState('paymentDate')
  const [collectionSortDir, setCollectionSortDir] = useState<'asc' | 'desc'>('desc')
  const [collectionPage, setCollectionPage] = useState(1)
  const [collectionPageSize, setCollectionPageSize] = useState(25)

  // --- Expenses Table UI States ---
  const [isOfficialPrintModalOpen, setIsOfficialPrintModalOpen] = useState(false)
  const [isExpColModalOpen, setIsExpColModalOpen] = useState(false)
  const [visibleExpCols, setVisibleExpCols] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('sutawane_daily_expenses_cols_v1')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {}
    }
    const initial: Record<string, boolean> = {}
    ALL_EXPENSE_COLS.forEach((col) => {
      initial[col.id] = col.defaultVisible
    })
    return initial
  })

  const [expenseSortField, setExpenseSortField] = useState('expenseDate')
  const [expenseSortDir, setExpenseSortDir] = useState<'asc' | 'desc'>('desc')
  const [expensePage, setExpensePage] = useState(1)
  const [expensePageSize, setExpensePageSize] = useState(25)

  // Sync mode changes to URL
  const handleModeChange = (mode: 'DAILY' | 'MONTHLY' | 'CUSTOM') => {
    setActiveMode(mode)
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('mode', mode)
    setSearchParams(nextParams)
  }

  // Intercept Ctrl+P / Cmd+P to open the Official A4 Printable Report Modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        setIsOfficialPrintModalOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Compute startDate & endDate based on mode
  const { computedStartDate, computedEndDate, periodLabel } = useMemo(() => {
    if (activeMode === 'DAILY') {
      const formatted = formatDateLong(dailyDate)
      return {
        computedStartDate: dailyDate,
        computedEndDate: dailyDate,
        periodLabel: `Daily Statement: ${formatted}`,
      }
    }

    if (activeMode === 'MONTHLY') {
      const start = new Date(selectedYear, selectedMonth, 1)
      const end = new Date(selectedYear, selectedMonth + 1, 0)
      const sStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`
      const eStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
      return {
        computedStartDate: sStr,
        computedEndDate: eStr,
        periodLabel: `Monthly Statement: ${MONTHS[selectedMonth]} ${selectedYear}`,
      }
    }

    // CUSTOM mode
    return {
      computedStartDate: customStartDate,
      computedEndDate: customEndDate,
      periodLabel: `Custom Range: ${formatDateLong(customStartDate)} to ${formatDateLong(customEndDate)}`,
    }
  }, [activeMode, dailyDate, selectedMonth, selectedYear, customStartDate, customEndDate])

  // Fetch financial statement
  const { data: statementData, isLoading, refetch } = useQuery({
    queryKey: [
      'financial-statement',
      selectedBranchId,
      selectedSessionId,
      activeMode,
      computedStartDate,
      computedEndDate,
    ],
    queryFn: () =>
      api.get('/reports/statement', {
        branchId: selectedBranchId !== 'ALL' ? selectedBranchId : undefined,
        sessionId: selectedSessionId !== 'ALL' ? selectedSessionId : undefined,
        startDate: computedStartDate,
        endDate: computedEndDate,
      }),
  })

  const summary = statementData?.summary || {
    totalCollections: 0,
    collectionsCount: 0,
    totalExpenses: 0,
    expensesCount: 0,
    netMovement: 0,
    isProfit: true,
    collectionsByMode: {},
    expensesByMode: {},
    expensesByCategory: {},
  }

  const collections: any[] = statementData?.collections || []
  const expenses: any[] = statementData?.expenses || []

  // Collections Filter & Sort Pipeline
  const filteredAndSortedCollections = useMemo(() => {
    let result = [...collections]

    if (collectionSearch.trim()) {
      const tokens = collectionSearch.toLowerCase().trim().split(/\s+/)
      result = result.filter((c) => {
        const text = [
          c.studentName || '',
          c.receiptNumber || '',
          c.rollNumber || '',
          c.standard || '',
          c.referenceNumber || '',
          c.paymentMode || '',
        ].join(' ').toLowerCase()
        return tokens.every((t) => text.includes(t))
      })
    }

    result.sort((a, b) => {
      let valA: any
      let valB: any

      switch (collectionSortField) {
        case 'receiptNumber':
          valA = a.receiptNumber || ''
          valB = b.receiptNumber || ''
          break
        case 'studentName':
          valA = a.studentName || ''
          valB = b.studentName || ''
          break
        case 'rollNumber':
          valA = a.rollNumber || ''
          valB = b.rollNumber || ''
          break
        case 'standard':
          valA = a.standard || ''
          valB = b.standard || ''
          break
        case 'paymentMode':
          valA = a.paymentMode || ''
          valB = b.paymentMode || ''
          break
        case 'referenceNumber':
          valA = a.referenceNumber || ''
          valB = b.referenceNumber || ''
          break
        case 'paymentDate':
          valA = new Date(a.paymentDate).getTime()
          valB = new Date(b.paymentDate).getTime()
          break
        case 'totalAmount':
          valA = Number(a.totalAmount || 0)
          valB = Number(b.totalAmount || 0)
          break
        default:
          valA = new Date(a.paymentDate).getTime()
          valB = new Date(b.paymentDate).getTime()
          break
      }

      if (typeof valA === 'string') {
        valA = valA.toLowerCase()
        valB = (valB || '').toLowerCase()
        return collectionSortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
      }

      const numA = Number(valA) || 0
      const numB = Number(valB) || 0
      return collectionSortDir === 'asc' ? numA - numB : numB - numA
    })

    return result
  }, [collections, collectionSearch, collectionSortField, collectionSortDir])

  const totalCollectionPages = Math.max(1, Math.ceil(filteredAndSortedCollections.length / collectionPageSize))
  const paginatedCollections = useMemo(() => {
    const start = (collectionPage - 1) * collectionPageSize
    return filteredAndSortedCollections.slice(start, start + collectionPageSize)
  }, [filteredAndSortedCollections, collectionPage, collectionPageSize])

  // Expenses Filter & Sort Pipeline
  const filteredAndSortedExpenses = useMemo(() => {
    let result = [...expenses]

    if (expenseSearch.trim()) {
      const tokens = expenseSearch.toLowerCase().trim().split(/\s+/)
      result = result.filter((e) => {
        const text = [
          e.description || '',
          e.vendor || '',
          e.categoryName || '',
          e.referenceNumber || '',
          e.paidTo || '',
          e.paymentMode || '',
        ].join(' ').toLowerCase()
        return tokens.every((t) => text.includes(t))
      })
    }

    result.sort((a, b) => {
      let valA: any
      let valB: any

      switch (expenseSortField) {
        case 'referenceNumber':
          valA = a.referenceNumber || ''
          valB = b.referenceNumber || ''
          break
        case 'categoryName':
          valA = a.categoryName || ''
          valB = b.categoryName || ''
          break
        case 'description':
          valA = a.description || ''
          valB = b.description || ''
          break
        case 'vendor':
          valA = a.vendor || a.paidTo || ''
          valB = b.vendor || b.paidTo || ''
          break
        case 'paymentMode':
          valA = a.paymentMode || ''
          valB = b.paymentMode || ''
          break
        case 'expenseDate':
          valA = new Date(a.expenseDate).getTime()
          valB = new Date(b.expenseDate).getTime()
          break
        case 'amount':
          valA = Number(a.amount || 0)
          valB = Number(b.amount || 0)
          break
        default:
          valA = new Date(a.expenseDate).getTime()
          valB = new Date(b.expenseDate).getTime()
          break
      }

      if (typeof valA === 'string') {
        valA = valA.toLowerCase()
        valB = (valB || '').toLowerCase()
        return expenseSortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
      }

      const numA = Number(valA) || 0
      const numB = Number(valB) || 0
      return expenseSortDir === 'asc' ? numA - numB : numB - numA
    })

    return result
  }, [expenses, expenseSearch, expenseSortField, expenseSortDir])

  const totalExpensePages = Math.max(1, Math.ceil(filteredAndSortedExpenses.length / expensePageSize))
  const paginatedExpenses = useMemo(() => {
    const start = (expensePage - 1) * expensePageSize
    return filteredAndSortedExpenses.slice(start, start + expensePageSize)
  }, [filteredAndSortedExpenses, expensePage, expensePageSize])

  // Sort handlers
  const handleCollectionSort = (field: string) => {
    if (collectionSortField === field) {
      setCollectionSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setCollectionSortField(field)
      setCollectionSortDir(field === 'paymentDate' || field === 'totalAmount' ? 'desc' : 'asc')
    }
  }

  const renderCollectionSortIcon = (field: string) => {
    if (collectionSortField === field) {
      return collectionSortDir === 'asc' ? (
        <ArrowUp className="w-3.5 h-3.5 text-amber-300 font-bold flex-shrink-0" />
      ) : (
        <ArrowDown className="w-3.5 h-3.5 text-amber-300 font-bold flex-shrink-0" />
      )
    }
    return <ArrowUpDown className="w-3.5 h-3.5 text-white/50 group-hover:text-white/90 flex-shrink-0" />
  }

  const handleExpenseSort = (field: string) => {
    if (expenseSortField === field) {
      setExpenseSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setExpenseSortField(field)
      setExpenseSortDir(field === 'expenseDate' || field === 'amount' ? 'desc' : 'asc')
    }
  }

  const renderExpenseSortIcon = (field: string) => {
    if (expenseSortField === field) {
      return expenseSortDir === 'asc' ? (
        <ArrowUp className="w-3.5 h-3.5 text-amber-300 font-bold flex-shrink-0" />
      ) : (
        <ArrowDown className="w-3.5 h-3.5 text-amber-300 font-bold flex-shrink-0" />
      )
    }
    return <ArrowUpDown className="w-3.5 h-3.5 text-white/50 group-hover:text-white/90 flex-shrink-0" />
  }

  // Column helpers for Collections
  const toggleColCol = (id: string) => {
    setVisibleColCols((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      localStorage.setItem('sutawane_daily_collections_cols_v1', JSON.stringify(next))
      return next
    })
  }

  const showAllColCols = () => {
    const updated: Record<string, boolean> = {}
    ALL_COLLECTION_COLS.forEach((c) => (updated[c.id] = true))
    setVisibleColCols(updated)
    localStorage.setItem('sutawane_daily_collections_cols_v1', JSON.stringify(updated))
  }

  const resetDefaultColCols = () => {
    const updated: Record<string, boolean> = {}
    ALL_COLLECTION_COLS.forEach((c) => (updated[c.id] = c.defaultVisible))
    setVisibleColCols(updated)
    localStorage.setItem('sutawane_daily_collections_cols_v1', JSON.stringify(updated))
  }

  // Column helpers for Expenses
  const toggleExpCol = (id: string) => {
    setVisibleExpCols((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      localStorage.setItem('sutawane_daily_expenses_cols_v1', JSON.stringify(next))
      return next
    })
  }

  const showAllExpCols = () => {
    const updated: Record<string, boolean> = {}
    ALL_EXPENSE_COLS.forEach((c) => (updated[c.id] = true))
    setVisibleExpCols(updated)
    localStorage.setItem('sutawane_daily_expenses_cols_v1', JSON.stringify(updated))
  }

  const resetDefaultExpCols = () => {
    const updated: Record<string, boolean> = {}
    ALL_EXPENSE_COLS.forEach((c) => (updated[c.id] = c.defaultVisible))
    setVisibleExpCols(updated)
    localStorage.setItem('sutawane_daily_expenses_cols_v1', JSON.stringify(updated))
  }

  // Export handlers
  const handleExportCollectionsExcel = () => {
    if (filteredAndSortedCollections.length === 0) return
    const exportItems: PaymentExportItem[] = filteredAndSortedCollections.map((c) => ({
      id: c.id,
      receiptNumber: c.receiptNumber,
      paymentDate: c.paymentDate,
      totalAmount: c.totalAmount,
      paymentMode: c.paymentMode,
      referenceNumber: c.referenceNumber,
      notes: c.notes,
      isReversed: false,
      student: {
        fullName: c.studentName,
        parentPhone: c.parentPhone,
      },
      admission: {
        rollNumber: c.rollNumber,
        standard: c.standard,
      },
      branch: {
        name: c.branchName || currentBranch?.name,
      },
      session: {
        name: currentSession?.name,
      },
    }))

    exportPaymentsToExcel(exportItems, {
      branchName: currentBranch?.name,
      sessionName: currentSession?.name,
    })
    showToast(`Exported ${filteredAndSortedCollections.length} collections to Excel (.xlsx)`)
  }

  const handleExportCollectionsPDF = async () => {
    if (filteredAndSortedCollections.length === 0) return
    const exportItems: PaymentExportItem[] = filteredAndSortedCollections.map((c) => ({
      id: c.id,
      receiptNumber: c.receiptNumber,
      paymentDate: c.paymentDate,
      totalAmount: c.totalAmount,
      paymentMode: c.paymentMode,
      referenceNumber: c.referenceNumber,
      notes: c.notes,
      isReversed: false,
      student: {
        fullName: c.studentName,
        parentPhone: c.parentPhone,
      },
      admission: {
        rollNumber: c.rollNumber,
        standard: c.standard,
      },
      branch: {
        name: c.branchName || currentBranch?.name,
      },
      session: {
        name: currentSession?.name,
      },
    }))

    await exportPaymentsToPDF(exportItems, {
      instituteName,
      branchName: currentBranch?.name,
      sessionName: currentSession?.name,
      logoUrl: activeLogoUrl || settings?.logo_url,
      tagline,
    })
    showToast(`Exported ${filteredAndSortedCollections.length} collections to PDF (.pdf)`)
  }

  const handleExportExpensesExcel = () => {
    if (filteredAndSortedExpenses.length === 0) return
    const exportItems: ExpenseExportItem[] = filteredAndSortedExpenses.map((e) => ({
      id: e.id,
      expenseDate: e.expenseDate,
      amount: e.amount,
      description: e.description,
      paymentMode: e.paymentMode,
      vendor: e.vendor || e.paidTo,
      referenceNumber: e.referenceNumber,
      category: {
        id: e.categoryId || '',
        name: e.categoryName || 'General',
      },
      branch: {
        id: e.branchId || '',
        name: e.branchName || currentBranch?.name || '',
      },
    }))

    exportExpensesToExcel(exportItems, {
      branchName: currentBranch?.name,
      dateRangeLabel: periodLabel,
    })
    showToast(`Exported ${filteredAndSortedExpenses.length} expense records to Excel (.xlsx)`)
  }

  const handleExportExpensesPDF = async () => {
    if (filteredAndSortedExpenses.length === 0) return
    const exportItems: ExpenseExportItem[] = filteredAndSortedExpenses.map((e) => ({
      id: e.id,
      expenseDate: e.expenseDate,
      amount: e.amount,
      description: e.description,
      paymentMode: e.paymentMode,
      vendor: e.vendor || e.paidTo,
      referenceNumber: e.referenceNumber,
      category: {
        id: e.categoryId || '',
        name: e.categoryName || 'General',
      },
      branch: {
        id: e.branchId || '',
        name: e.branchName || currentBranch?.name || '',
      },
    }))

    await exportExpensesToPDF(exportItems, {
      instituteName,
      branchName: currentBranch?.name,
      dateRangeLabel: periodLabel,
      logoUrl: activeLogoUrl || settings?.logo_url,
      tagline,
    })
    showToast(`Exported ${filteredAndSortedExpenses.length} expense records to PDF (.pdf)`)
  }

  // Institute Branding details
  const instituteName = (settings?.institute_name || currentBranch?.name || 'SUTAWANE CLASSES').toUpperCase()
  const tagline = settings?.tagline || 'Excellence in Coaching & Board Exam Preparations'
  const address = currentBranch?.address || settings?.address || 'Main Campus, Maharashtra'
  const phone = currentBranch?.phone || settings?.phone || '7776824564'
  const email = settings?.email || 'contact@sutawaneclasses.com'
  const logoUrl = activeLogoUrl || settings?.logo_url || null

  const handlePrint = () => {
    setIsOfficialPrintModalOpen(true)
  }

  // Quick preset handlers
  const setToday = () => setDailyDate(todayStr)
  const setYesterday = () => {
    const y = new Date()
    y.setDate(y.getDate() - 1)
    setDailyDate(getTodayDateString(y))
  }

  // Export Multi-Sheet Excel Statement (.xlsx)
  const handleExportExcelStatement = () => {
    const wb = XLSX.utils.book_new()
    const branchLabel = currentBranch ? currentBranch.name : 'All Branches Consolidated'
    const sessionLabel = currentSession ? currentSession.name : 'All Academic Sessions'

    // ==========================================
    // SHEET 1: Executive Audit Summary
    // ==========================================
    const summaryRows: any[][] = [
      [`FINANCIAL AUDIT STATEMENT - ${instituteName}`],
      [`Period:`, periodLabel],
      [`Branch Scope:`, branchLabel],
      [`Academic Session:`, sessionLabel],
      [`Audit Ref:`, `AUD-${computedStartDate.replace(/-/g, '')}-${computedEndDate.replace(/-/g, '')}`],
      [`Generated On:`, new Date().toLocaleString('en-IN')],
      [],
      ['--- EXECUTIVE FINANCIAL PERFORMANCE SUMMARY ---'],
      ['Accounting Stream / Metric', 'Transaction Volume', 'Total Amount (₹)', 'Performance Analysis'],
      [
        'Total Collections (Revenue Inflow)',
        `${summary.collectionsCount} Receipts`,
        summary.totalCollections,
        'Confirmed student tuition & academic fee receipts',
      ],
      [
        'Total Operating Expenses (Outflow)',
        `${summary.expensesCount} Vouchers`,
        summary.totalExpenses,
        'Rent, staff salaries, utilities, and center operations',
      ],
      [
        'Net Financial Movement (Cash Flow)',
        `${summary.collectionsCount + summary.expensesCount} Transactions`,
        summary.netMovement,
        summary.netMovement >= 0 ? 'NET PROFIT / OPERATIONAL SURPLUS' : 'NET DEFICIT / OPERATIONAL LOSS',
      ],
      [
        'Operating Expense Ratio (%)',
        '—',
        summary.totalCollections > 0 ? Number(((summary.totalExpenses / summary.totalCollections) * 100).toFixed(1)) : 0,
        '% of gross collection consumed by operations',
      ],
      [],
      ['--- FINANCIAL MOVEMENT AUDIT BREAKDOWN ---'],
      ['Category / Stream', 'Branch Scope', 'Movement Type', 'Transaction Count', 'Total Amount (₹)'],
      [
        'Student Tuition & Fee Collections',
        branchLabel,
        'INFLOW (+)',
        `${summary.collectionsCount} receipts`,
        summary.totalCollections,
      ],
      [
        'Operating Center Expenditures',
        branchLabel,
        'OUTFLOW (-)',
        `${summary.expensesCount} vouchers`,
        summary.totalExpenses,
      ],
      [
        'NET CASH & FINANCIAL BALANCE',
        branchLabel,
        summary.netMovement >= 0 ? 'SURPLUS (+)' : 'DEFICIT (-)',
        `${summary.collectionsCount + summary.expensesCount} records`,
        summary.netMovement,
      ],
    ]

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows)
    wsSummary['!cols'] = [{ wch: 38 }, { wch: 26 }, { wch: 22 }, { wch: 50 }]
    wsSummary['!rows'] = [
      { hpt: 26 },
      { hpt: 18 },
      { hpt: 18 },
      { hpt: 18 },
      { hpt: 18 },
      { hpt: 18 },
      { hpt: 14 },
      { hpt: 22 },
      { hpt: 20 },
      { hpt: 19 },
      { hpt: 19 },
      { hpt: 20 },
      { hpt: 19 },
      { hpt: 14 },
      { hpt: 22 },
      { hpt: 20 },
      { hpt: 19 },
      { hpt: 19 },
      { hpt: 22 },
    ]
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Audit Summary')

    // ==========================================
    // SHEET 2: Fee Collections Register
    // ==========================================
    const colHeader = [
      '#',
      'Receipt No',
      'Payment Date',
      'Student Name',
      'Roll Number',
      'Class / Course',
      'Branch',
      'Payment Mode',
      'Txn / Ref No',
      'Amount (₹)',
    ]
    const colDataRows = collections.map((c, idx) => [
      idx + 1,
      c.receiptNumber || '—',
      formatDate(c.paymentDate),
      c.studentName || '—',
      c.rollNumber || '—',
      c.standard || '—',
      c.branchName || branchLabel,
      c.paymentMode || 'CASH',
      c.referenceNumber || '—',
      c.totalAmount || 0,
    ])
    const totalCollectionsSum = collections.reduce((sum, c) => sum + (c.totalAmount || 0), 0)
    const colSummaryRow = [
      '',
      `TOTAL COLLECTIONS (${collections.length})`,
      '',
      '',
      '',
      '',
      '',
      '',
      'Total (₹):',
      totalCollectionsSum,
    ]

    const wsCollections = XLSX.utils.aoa_to_sheet([colHeader, ...colDataRows, colSummaryRow])
    wsCollections['!cols'] = [
      { wch: 6 },
      { wch: 20 },
      { wch: 14 },
      { wch: 28 },
      { wch: 14 },
      { wch: 16 },
      { wch: 22 },
      { wch: 14 },
      { wch: 18 },
      { wch: 16 },
    ]
    wsCollections['!rows'] = [{ hpt: 22 }]
    XLSX.utils.book_append_sheet(wb, wsCollections, 'Fee Collections Register')

    // ==========================================
    // SHEET 3: Operating Expenses Register
    // ==========================================
    const expHeader = [
      '#',
      'Voucher Ref',
      'Disbursement Date',
      'Expense Category',
      'Description / Purpose',
      'Paid To / Vendor',
      'Branch',
      'Payment Mode',
      'Amount (₹)',
    ]
    const expDataRows = expenses.map((e, idx) => [
      idx + 1,
      e.referenceNumber || `VCH-${String(idx + 1).padStart(4, '0')}`,
      formatDate(e.expenseDate),
      e.categoryName || 'General',
      e.description || '—',
      e.vendor || e.paidTo || '—',
      e.branchName || branchLabel,
      e.paymentMode || 'CASH',
      e.amount || 0,
    ])
    const totalExpensesSum = expenses.reduce((sum, e) => sum + (e.amount || 0), 0)
    const expSummaryRow = [
      '',
      `TOTAL EXPENSES (${expenses.length})`,
      '',
      '',
      '',
      '',
      '',
      'Total (₹):',
      totalExpensesSum,
    ]

    const wsExpenses = XLSX.utils.aoa_to_sheet([expHeader, ...expDataRows, expSummaryRow])
    wsExpenses['!cols'] = [
      { wch: 6 },
      { wch: 18 },
      { wch: 16 },
      { wch: 20 },
      { wch: 32 },
      { wch: 22 },
      { wch: 22 },
      { wch: 14 },
      { wch: 16 },
    ]
    wsExpenses['!rows'] = [{ hpt: 22 }]
    XLSX.utils.book_append_sheet(wb, wsExpenses, 'Operating Expenses Register')

    // ==========================================
    // SHEET 4: Payment Channels Breakdown
    // ==========================================
    const channelsHeader = [
      'Payment Channel / Mode',
      'Transaction Volume',
      'Total Amount Realized (₹)',
      'Share of Collections (%)',
    ]
    const channelsRows = Object.entries(summary.collectionsByMode || {}).map(([mode, data]: [string, any]) => {
      const share = totalCollectionsSum > 0 ? Number(((data.amount / totalCollectionsSum) * 100).toFixed(1)) : 0
      return [mode, `${data.count} receipts`, data.amount, `${share}%`]
    })
    const wsChannels = XLSX.utils.aoa_to_sheet([channelsHeader, ...channelsRows])
    wsChannels['!cols'] = [{ wch: 26 }, { wch: 22 }, { wch: 26 }, { wch: 24 }]
    wsChannels['!rows'] = [{ hpt: 22 }]
    XLSX.utils.book_append_sheet(wb, wsChannels, 'Payment Channels Breakdown')

    // ==========================================
    // SHEET 5: Expense Categories Breakdown
    // ==========================================
    const categoriesHeader = [
      'Expense Category',
      'Voucher Volume',
      'Total Amount Disbursed (₹)',
      'Share of Expenditures (%)',
    ]
    const categoriesRows = Object.entries(summary.expensesByCategory || {}).map(([cat, data]: [string, any]) => {
      const share = totalExpensesSum > 0 ? Number(((data.amount / totalExpensesSum) * 100).toFixed(1)) : 0
      return [cat, `${data.count} vouchers`, data.amount, `${share}%`]
    })
    const wsCategories = XLSX.utils.aoa_to_sheet([categoriesHeader, ...categoriesRows])
    wsCategories['!cols'] = [{ wch: 26 }, { wch: 20 }, { wch: 28 }, { wch: 26 }]
    wsCategories['!rows'] = [{ hpt: 22 }]
    XLSX.utils.book_append_sheet(wb, wsCategories, 'Expense Categories Breakdown')

    // Write multi-sheet file
    const fileName = `Financial_Statement_${activeMode.toLowerCase()}_${computedStartDate}_to_${computedEndDate}.xlsx`
    XLSX.writeFile(wb, fileName)
    showToast(`Exported multi-sheet financial statement to Excel (.xlsx)`)
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 p-4 bg-foreground text-background rounded-xl shadow-xl flex items-center gap-2 text-sm font-medium animate-in fade-in slide-in-from-bottom-4 border no-print">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {toastMsg}
        </div>
      )}


      {/* Screen Controls Header (hidden in print) */}
      <div className="flex flex-col gap-3 no-print border-b pb-4">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/reports')}
            className="gap-1.5 text-xs h-7 px-2 text-muted-foreground hover:text-foreground hover:bg-muted -ml-2"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back to Financial Reports
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-primary" />
              Unified Financial Statement & Movement Report
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Comprehensive report of daily/monthly collections, expenditures, cash flow, and net profit/loss.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcelStatement}
              className="gap-1.5 text-xs h-9 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              title="Export complete financial statement with all accounting streams to Multi-Sheet Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              Export Excel (.xlsx)
            </Button>
            <Button
              onClick={handlePrint}
              size="sm"
              className="gap-1.5 h-9 bg-primary text-white font-semibold"
            >
              <Printer className="w-4 h-4" />
              Print Official A4 Report
            </Button>
          </div>
        </div>

        {/* 3 Main Report Time Modes Switcher & In-Page Scopes */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 p-2.5 rounded-xl border">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-background p-1 rounded-lg border shadow-sm">
              <Button
                variant={activeMode === 'DAILY' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleModeChange('DAILY')}
                className="text-xs h-8 gap-1.5 font-medium"
              >
                <Calendar className="w-3.5 h-3.5" />
                Daily Report
              </Button>
              <Button
                variant={activeMode === 'MONTHLY' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleModeChange('MONTHLY')}
                className="text-xs h-8 gap-1.5 font-medium"
              >
                <CalendarDays className="w-3.5 h-3.5" />
                Month-wise Report
              </Button>
              <Button
                variant={activeMode === 'CUSTOM' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleModeChange('CUSTOM')}
                className="text-xs h-8 gap-1.5 font-medium"
              >
                <CalendarRange className="w-3.5 h-3.5" />
                Custom Date Filter
              </Button>
            </div>

            {/* In-Page Branch Selector */}
            <div className="flex items-center gap-1.5 bg-background border rounded-lg px-2.5 py-1 text-xs shadow-xs">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="bg-transparent border-0 text-xs font-semibold focus:outline-none cursor-pointer text-foreground"
                title="Filter statement by branch"
              >
                <option value="ALL">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* In-Page Session Selector */}
            <div className="flex items-center gap-1.5 bg-background border rounded-lg px-2.5 py-1 text-xs shadow-xs">
              <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
              <select
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                className="bg-transparent border-0 text-xs font-semibold focus:outline-none cursor-pointer text-foreground"
                title="Filter statement by academic session"
              >
                <option value="ALL">All Academic Sessions</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.isCurrent ? ' (Current)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dynamic Filter Controls Based on Active Mode */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 1. Daily Report Filter */}
            {activeMode === 'DAILY' && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">Select Date:</span>
                <Input
                  type="date"
                  value={dailyDate}
                  onChange={(e) => setDailyDate(e.target.value)}
                  className="h-8 text-xs w-36 bg-background"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={setToday}
                  className={`h-8 text-xs ${dailyDate === todayStr ? 'bg-primary/10 border-primary text-primary font-bold' : ''}`}
                >
                  Today
                </Button>
                <Button variant="outline" size="sm" onClick={setYesterday} className="h-8 text-xs">
                  Yesterday
                </Button>
              </div>
            )}

            {/* 2. Month-wise Report Filter */}
            {activeMode === 'MONTHLY' && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">Select Month & Year:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="h-8 text-xs bg-background border border-input rounded-md px-2.5 font-medium focus:outline-none"
                >
                  {MONTHS.map((m, idx) => (
                    <option key={m} value={idx}>
                      {m}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="h-8 text-xs bg-background border border-input rounded-md px-2.5 font-medium focus:outline-none"
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 3. Custom Date Range Filter */}
            {activeMode === 'CUSTOM' && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">From:</span>
                  <Input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="h-8 text-xs w-36 bg-background"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">To:</span>
                  <Input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="h-8 text-xs w-36 bg-background"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3 Financial Performance KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Collections (Inflow) */}
        <Card className="border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/20 print:border-neutral-400 print:bg-white shadow-sm">
          <CardHeader className="py-3 pb-1">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 print:text-neutral-900 flex items-center justify-between">
              <span>Fee Collections (Inflow)</span>
              <div className="p-1.5 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300 print:hidden">
                <TrendingUp className="w-4 h-4" />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 space-y-2">
            <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 print:text-neutral-950">
              {formatCurrency(summary.totalCollections)}
            </div>
            <p className="text-[11px] text-muted-foreground print:text-neutral-600">
              {summary.collectionsCount} payment receipts confirmed
            </p>
            {/* Payment Modes Breakdown */}
            {Object.keys(summary.collectionsByMode || {}).length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1.5 border-t border-emerald-200/60 dark:border-emerald-900/40 text-[10px]">
                {Object.entries(summary.collectionsByMode).map(([mode, data]: [string, any]) => (
                  <span
                    key={mode}
                    className="px-1.5 py-0.5 rounded bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 font-medium"
                  >
                    {mode}: {formatCurrency(data.amount)} ({data.count})
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Total Expenses (Outflow) */}
        <Card className="border-rose-200 bg-rose-50/40 dark:bg-rose-950/20 print:border-neutral-400 print:bg-white shadow-sm">
          <CardHeader className="py-3 pb-1">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300 print:text-neutral-900 flex items-center justify-between">
              <span>Operating Expenses (Outflow)</span>
              <div className="p-1.5 rounded-md bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300 print:hidden">
                <TrendingDown className="w-4 h-4" />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 space-y-2">
            <div className="text-2xl font-black text-rose-700 dark:text-rose-400 print:text-neutral-950">
              {formatCurrency(summary.totalExpenses)}
            </div>
            <p className="text-[11px] text-muted-foreground print:text-neutral-600">
              {summary.expensesCount} expense vouchers disbursed
            </p>
            {/* Top Categories Breakdown */}
            {Object.keys(summary.expensesByCategory || {}).length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1.5 border-t border-rose-200/60 dark:border-rose-900/40 text-[10px]">
                {Object.entries(summary.expensesByCategory).map(([cat, data]: [string, any]) => (
                  <span
                    key={cat}
                    className="px-1.5 py-0.5 rounded bg-rose-100/80 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200 font-medium"
                  >
                    {cat}: {formatCurrency(data.amount)}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Net Movement (Profit / Loss) */}
        <Card
          className={`${
            summary.netMovement >= 0
              ? 'border-blue-200 bg-blue-50/40 dark:bg-blue-950/20'
              : 'border-amber-300 bg-amber-50/40 dark:bg-amber-950/20'
          } print:border-neutral-400 print:bg-white shadow-sm`}
        >
          <CardHeader className="py-3 pb-1">
            <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center justify-between">
              <span
                className={
                  summary.netMovement >= 0
                    ? 'text-blue-800 dark:text-blue-300 print:text-neutral-900'
                    : 'text-amber-800 dark:text-amber-300 print:text-neutral-900'
                }
              >
                {summary.netMovement >= 0 ? 'Net Surplus / Profit' : 'Net Deficit / Loss'}
              </span>
              <Badge variant={summary.netMovement >= 0 ? 'success' : 'danger'} className="text-[10px]">
                {summary.netMovement >= 0 ? 'NET PROFIT' : 'NET DEFICIT'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 space-y-2">
            <div
              className={`text-2xl font-black ${
                summary.netMovement >= 0
                  ? 'text-blue-700 dark:text-blue-400'
                  : 'text-rose-700 dark:text-rose-400'
              } print:text-neutral-950`}
            >
              {summary.netMovement >= 0 ? '+' : ''}
              {formatCurrency(summary.netMovement)}
            </div>
            <p className="text-[11px] text-muted-foreground print:text-neutral-600">
              Total Collections minus Total Operational Expenses
            </p>
            <div className="pt-1.5 border-t border-border/60 text-[10px] text-muted-foreground">
              Ratio: {summary.totalCollections > 0 ? ((summary.totalExpenses / summary.totalCollections) * 100).toFixed(1) : 0}% expense ratio
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Financial Movement Audit Summary Table */}
      <Card className="print:border-neutral-400 overflow-hidden shadow-sm">
        <CardHeader className="py-3.5 bg-muted/20 border-b">
          <CardTitle className="text-sm font-bold flex items-center justify-between">
            <span>Financial Movement Audit Summary</span>
            <span className="text-xs font-normal text-muted-foreground font-mono">{periodLabel}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-[#28375C] text-white">
              <TableRow className="border-b border-[#1b2640] hover:bg-[#28375C] bg-[#28375C]">
                <TableHead className="text-white font-semibold">Category / Accounting Stream</TableHead>
                <TableHead className="text-white font-semibold">Branch Scope</TableHead>
                <TableHead className="text-white font-semibold">Movement Type</TableHead>
                <TableHead className="text-white font-semibold">Transaction Volume</TableHead>
                <TableHead className="text-right text-white font-semibold">Total Amount (₹)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-semibold text-foreground">Student Fee Collections</TableCell>
                <TableCell>{currentBranch ? currentBranch.name : 'All Active Branches'}</TableCell>
                <TableCell>
                  <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200">
                    Inflow (+)
                  </span>
                </TableCell>
                <TableCell className="text-xs">{summary.collectionsCount} payment receipts</TableCell>
                <TableCell className="text-right font-bold text-emerald-600 text-sm">
                  {formatCurrency(summary.totalCollections)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-semibold text-foreground">Operating Center Expenditures</TableCell>
                <TableCell>{currentBranch ? currentBranch.name : 'All Active Branches'}</TableCell>
                <TableCell>
                  <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200">
                    Outflow (-)
                  </span>
                </TableCell>
                <TableCell className="text-xs">{summary.expensesCount} expense vouchers</TableCell>
                <TableCell className="text-right font-bold text-rose-600 text-sm">
                  {formatCurrency(summary.totalExpenses)}
                </TableCell>
              </TableRow>
              <TableRow className="bg-muted/40 font-bold text-sm border-t-2">
                <TableCell colSpan={4} className="text-foreground uppercase tracking-wide">
                  NET CASH & FINANCIAL BALANCE FOR SELECTED PERIOD
                </TableCell>
                <TableCell
                  className={`text-right font-black text-base ${
                    summary.netMovement >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-rose-600'
                  }`}
                >
                  {summary.netMovement >= 0 ? '+' : ''}
                  {formatCurrency(summary.netMovement)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Screen Sub-navigation to toggle Detailed Transactions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print pt-2">
        <div className="flex items-center gap-1.5 bg-slate-100/90 dark:bg-slate-900/70 p-1.5 rounded-xl border border-slate-200/80 dark:border-slate-800 w-fit">
          <button
            type="button"
            onClick={() => setActiveTableTab('ALL')}
            className={cn(
              'inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border transition-all duration-150 cursor-pointer select-none',
              activeTableTab === 'ALL'
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm shadow-slate-900/20 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-white/80 dark:text-slate-400 dark:hover:text-slate-200'
            )}
          >
            <span>All Ledger Records</span>
            <span
              className={cn(
                'px-1.5 py-0.5 rounded-full text-[11px] font-bold leading-none',
                activeTableTab === 'ALL'
                  ? 'bg-white/20 text-white dark:bg-slate-800/30 dark:text-slate-900'
                  : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
              )}
            >
              {collections.length + expenses.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTableTab('COLLECTIONS')}
            className={cn(
              'inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border transition-all duration-150 cursor-pointer select-none',
              activeTableTab === 'COLLECTIONS'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-600/30 dark:bg-emerald-600 dark:border-emerald-600'
                : 'border-transparent text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40'
            )}
          >
            <TrendingUp className={cn('w-3.5 h-3.5', activeTableTab === 'COLLECTIONS' ? 'text-white' : 'text-emerald-600')} />
            <span>Collections Only</span>
            <span
              className={cn(
                'px-1.5 py-0.5 rounded-full text-[11px] font-bold leading-none',
                activeTableTab === 'COLLECTIONS'
                  ? 'bg-white/25 text-white font-bold'
                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
              )}
            >
              {collections.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTableTab('EXPENSES')}
            className={cn(
              'inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border transition-all duration-150 cursor-pointer select-none',
              activeTableTab === 'EXPENSES'
                ? 'bg-rose-600 text-white border-rose-600 shadow-sm shadow-rose-600/30 dark:bg-rose-600 dark:border-rose-600'
                : 'border-transparent text-rose-700 hover:text-rose-800 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40'
            )}
          >
            <TrendingDown className={cn('w-3.5 h-3.5', activeTableTab === 'EXPENSES' ? 'text-white' : 'text-rose-600')} />
            <span>Expenses Only</span>
            <span
              className={cn(
                'px-1.5 py-0.5 rounded-full text-[11px] font-bold leading-none',
                activeTableTab === 'EXPENSES'
                  ? 'bg-white/25 text-white font-bold'
                  : 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300'
              )}
            >
              {expenses.length}
            </span>
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          Showing complete transaction log for audit and verification
        </p>
      </div>

      {/* SECTION 1: DETAILED COLLECTIONS TRANSACTION RECORDS */}
      {(activeTableTab === 'ALL' || activeTableTab === 'COLLECTIONS') && (
        <Card className="print:border-neutral-400 shadow-sm overflow-hidden">
          <CardHeader className="py-3 px-4 bg-muted/20 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-600" />
                Fee Collection Transaction Records ({filteredAndSortedCollections.length} of {collections.length})
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Every fee payment received with receipt number, student name, and payment mode
              </p>
            </div>

            {/* Collections Action & Search Toolbar */}
            <div className="flex flex-wrap items-center gap-2 no-print">
              {/* Search with Clear Button */}
              <div className="relative w-full sm:w-60">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search student, receipt, roll..."
                  value={collectionSearch}
                  onChange={(e) => {
                    setCollectionSearch(e.target.value)
                    setCollectionPage(1)
                  }}
                  className="h-8 pl-8 pr-7 text-xs bg-background"
                />
                {collectionSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setCollectionSearch('')
                      setCollectionPage(1)
                    }}
                    className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Columns Visibility Toggle */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsColModalOpen(true)}
                className="h-8 px-2.5 text-xs gap-1"
                title="Customize Collections Columns"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="hidden sm:inline">Columns</span>
              </Button>

              {/* Export Collections to Excel */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCollectionsExcel}
                disabled={filteredAndSortedCollections.length === 0}
                className="h-8 px-2.5 text-xs gap-1 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                title="Export filtered collection records to Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Excel</span>
              </Button>

              {/* Export Collections to PDF */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCollectionsPDF}
                disabled={filteredAndSortedCollections.length === 0}
                className="h-8 px-2.5 text-xs gap-1 border-rose-500/40 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                title="Export filtered collection records to PDF"
              >
                <FileText className="w-3.5 h-3.5 text-rose-600" />
                <span className="hidden sm:inline">PDF</span>
              </Button>

              {/* Page Size Selector */}
              <select
                value={collectionPageSize}
                onChange={(e) => {
                  setCollectionPageSize(Number(e.target.value))
                  setCollectionPage(1)
                }}
                className="h-8 text-xs bg-background border border-input rounded-md px-2 font-medium focus:outline-none cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={10000}>All</option>
              </select>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {filteredAndSortedCollections.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                <Receipt className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                No fee collection transactions match your active query.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="w-full">
                  <TableHeader className="bg-[#28375C] text-white">
                    <TableRow className="border-b border-[#1b2640] hover:bg-[#28375C] bg-[#28375C]">
                      {/* Sr No */}
                      {visibleColCols.srNo && (
                        <TableHead className="w-10 text-center text-xs text-white">#</TableHead>
                      )}

                      {/* Receipt No */}
                      {visibleColCols.receiptNo && (
                        <TableHead
                          onClick={() => handleCollectionSort('receiptNumber')}
                          className="cursor-pointer hover:text-white hover:bg-[#1f2c4a] select-none whitespace-nowrap text-white group"
                        >
                          <div className="flex items-center gap-1 text-white">
                            <span>Receipt No</span>
                            {renderCollectionSortIcon('receiptNumber')}
                          </div>
                        </TableHead>
                      )}

                      {/* Student Name */}
                      {visibleColCols.studentName && (
                        <TableHead
                          onClick={() => handleCollectionSort('studentName')}
                          className="cursor-pointer hover:text-white hover:bg-[#1f2c4a] select-none min-w-[160px] text-white group"
                        >
                          <div className="flex items-center gap-1 font-semibold text-white">
                            <span>Student Name</span>
                            {renderCollectionSortIcon('studentName')}
                          </div>
                        </TableHead>
                      )}

                      {/* Roll No */}
                      {visibleColCols.rollNo && (
                        <TableHead
                          onClick={() => handleCollectionSort('rollNumber')}
                          className="cursor-pointer hover:text-white hover:bg-[#1f2c4a] select-none whitespace-nowrap text-white group"
                        >
                          <div className="flex items-center gap-1 text-white">
                            <span>Roll No</span>
                            {renderCollectionSortIcon('rollNumber')}
                          </div>
                        </TableHead>
                      )}

                      {/* Class / Standard */}
                      {visibleColCols.standard && (
                        <TableHead
                          onClick={() => handleCollectionSort('standard')}
                          className="cursor-pointer hover:text-white hover:bg-[#1f2c4a] select-none whitespace-nowrap text-white group"
                        >
                          <div className="flex items-center gap-1 text-white">
                            <span>Class</span>
                            {renderCollectionSortIcon('standard')}
                          </div>
                        </TableHead>
                      )}

                      {/* Payment Mode */}
                      {visibleColCols.paymentMode && (
                        <TableHead
                          onClick={() => handleCollectionSort('paymentMode')}
                          className="cursor-pointer hover:text-white hover:bg-[#1f2c4a] select-none whitespace-nowrap text-white group"
                        >
                          <div className="flex items-center gap-1 text-white">
                            <span>Payment Mode</span>
                            {renderCollectionSortIcon('paymentMode')}
                          </div>
                        </TableHead>
                      )}

                      {/* Reference Number */}
                      {visibleColCols.referenceNumber && (
                        <TableHead
                          onClick={() => handleCollectionSort('referenceNumber')}
                          className="cursor-pointer hover:text-white hover:bg-[#1f2c4a] select-none whitespace-nowrap text-white group"
                        >
                          <div className="flex items-center gap-1 text-white">
                            <span>Txn / Ref</span>
                            {renderCollectionSortIcon('referenceNumber')}
                          </div>
                        </TableHead>
                      )}

                      {/* Payment Date */}
                      {visibleColCols.paymentDate && (
                        <TableHead
                          onClick={() => handleCollectionSort('paymentDate')}
                          className="cursor-pointer hover:text-white hover:bg-[#1f2c4a] select-none whitespace-nowrap text-white group"
                        >
                          <div className="flex items-center gap-1 text-white">
                            <span>Date</span>
                            {renderCollectionSortIcon('paymentDate')}
                          </div>
                        </TableHead>
                      )}

                      {/* Amount */}
                      {visibleColCols.totalAmount && (
                        <TableHead
                          onClick={() => handleCollectionSort('totalAmount')}
                          className="cursor-pointer hover:text-white hover:bg-[#1f2c4a] select-none text-right whitespace-nowrap text-white group"
                        >
                          <div className="flex items-center justify-end gap-1 text-white">
                            <span>Amount (₹)</span>
                            {renderCollectionSortIcon('totalAmount')}
                          </div>
                        </TableHead>
                      )}

                      {/* Action */}
                      {visibleColCols.actions && (
                        <TableHead className="text-right no-print whitespace-nowrap pr-4 text-white font-semibold">Action</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {paginatedCollections.map((c, idx) => {
                      const rowNum = (collectionPage - 1) * collectionPageSize + idx + 1
                      return (
                        <TableRow key={c.id} className="hover:bg-muted/40 transition-colors">
                          {/* Sr No */}
                          {visibleColCols.srNo && (
                            <TableCell className="text-xs font-mono text-muted-foreground text-center">
                              {rowNum}
                            </TableCell>
                          )}

                          {/* Receipt Number */}
                          {visibleColCols.receiptNo && (
                            <TableCell className="font-mono text-xs font-bold text-foreground whitespace-nowrap">
                              {c.receiptNumber}
                            </TableCell>
                          )}

                          {/* Student Name */}
                          {visibleColCols.studentName && (
                            <TableCell className="font-semibold text-foreground">
                              <button
                                type="button"
                                onClick={() => navigate(`/students/${c.student?.id || c.studentId}`)}
                                className="hover:underline text-left"
                              >
                                {c.studentName}
                              </button>
                            </TableCell>
                          )}

                          {/* Roll Number */}
                          {visibleColCols.rollNo && (
                            <TableCell className="font-mono text-xs whitespace-nowrap">
                              {c.rollNumber || '—'}
                            </TableCell>
                          )}

                          {/* Class */}
                          {visibleColCols.standard && (
                            <TableCell className="text-xs whitespace-nowrap">
                              {c.standard || '—'}
                            </TableCell>
                          )}

                          {/* Payment Mode */}
                          {visibleColCols.paymentMode && (
                            <TableCell className="whitespace-nowrap">
                              <Badge
                                variant={
                                  c.paymentMode === 'UPI'
                                    ? 'default'
                                    : c.paymentMode === 'CASH'
                                    ? 'success'
                                    : c.paymentMode === 'BANK_TRANSFER'
                                    ? 'secondary'
                                    : 'outline'
                                }
                                className="text-[10px]"
                              >
                                {c.paymentMode}
                              </Badge>
                            </TableCell>
                          )}

                          {/* Reference Number */}
                          {visibleColCols.referenceNumber && (
                            <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                              {c.referenceNumber || '—'}
                            </TableCell>
                          )}

                          {/* Payment Date */}
                          {visibleColCols.paymentDate && (
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDate(c.paymentDate)}
                            </TableCell>
                          )}

                          {/* Amount */}
                          {visibleColCols.totalAmount && (
                            <TableCell className="text-right font-bold text-emerald-600 text-xs whitespace-nowrap">
                              {formatCurrency(c.totalAmount)}
                            </TableCell>
                          )}

                          {/* Actions */}
                          {visibleColCols.actions && (
                            <TableCell className="text-right no-print whitespace-nowrap pr-4">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedReceipt(c)}
                                  className="h-7 text-[11px] px-2 gap-1"
                                  title="View / Print Official Receipt"
                                >
                                  <Printer className="w-3 h-3" />
                                  <span>Receipt</span>
                                </Button>
                                {c.parentPhone && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      const msg = buildReceiptWhatsAppMessage({
                                        instituteName,
                                        studentName: c.studentName,
                                        rollNumber: c.rollNumber,
                                        standard: c.standard,
                                        receiptNumber: c.receiptNumber,
                                        totalAmount: c.totalAmount,
                                        paymentDate: c.paymentDate,
                                        paymentMode: c.paymentMode,
                                        referenceNumber: c.referenceNumber,
                                        branchName: c.branchName,
                                        helpline: phone,
                                      })
                                      openWhatsApp(c.parentPhone, msg)
                                    }}
                                    className="h-7 text-[11px] px-2 text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                    title="Send WhatsApp confirmation"
                                  >
                                    <WhatsAppIcon className="w-3 h-3 text-[#25D366]" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      )
                    })}

                    {/* Subtotal Row */}
                    <TableRow className="bg-muted/30 font-bold text-xs border-t-2">
                      <TableCell colSpan={8} className="uppercase font-semibold">
                        Subtotal Collections ({filteredAndSortedCollections.length} records)
                      </TableCell>
                      <TableCell className="text-right font-black text-emerald-600 text-sm whitespace-nowrap">
                        {formatCurrency(filteredAndSortedCollections.reduce((sum, c) => sum + c.totalAmount, 0))}
                      </TableCell>
                      <TableCell className="no-print" />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>

          {/* Collections Pagination Footer */}
          <div className="p-3 bg-muted/20 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground no-print">
            <div>
              Showing <strong className="text-foreground">{paginatedCollections.length}</strong> of{' '}
              <strong className="text-foreground">{filteredAndSortedCollections.length}</strong> filtered receipts
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCollectionPage((p) => Math.max(1, p - 1))}
                disabled={collectionPage <= 1}
                className="h-7 text-xs px-2 gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </Button>

              <span className="text-xs font-medium px-2">
                Page {collectionPage} of {totalCollectionPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCollectionPage((p) => Math.min(totalCollectionPages, p + 1))}
                disabled={collectionPage >= totalCollectionPages}
                className="h-7 text-xs px-2 gap-1"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* SECTION 2: DETAILED EXPENSES TRANSACTION RECORDS */}
      {(activeTableTab === 'ALL' || activeTableTab === 'EXPENSES') && (
        <Card className="print:border-neutral-400 shadow-sm overflow-hidden">
          <CardHeader className="py-3 px-4 bg-muted/20 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-rose-600" />
                Operational Expense Disbursements ({filteredAndSortedExpenses.length} of {expenses.length})
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                All center expenditures categorized by rent, salaries, utilities, and vendor supplies
              </p>
            </div>

            {/* Expenses Action & Search Toolbar */}
            <div className="flex flex-wrap items-center gap-2 no-print">
              {/* Search with Clear Button */}
              <div className="relative w-full sm:w-60">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search vendor, description..."
                  value={expenseSearch}
                  onChange={(e) => {
                    setExpenseSearch(e.target.value)
                    setExpensePage(1)
                  }}
                  className="h-8 pl-8 pr-7 text-xs bg-background"
                />
                {expenseSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setExpenseSearch('')
                      setExpensePage(1)
                    }}
                    className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Columns Visibility Toggle */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsExpColModalOpen(true)}
                className="h-8 px-2.5 text-xs gap-1"
                title="Customize Expenses Columns"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="hidden sm:inline">Columns</span>
              </Button>

              {/* Export Expenses to Excel */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExpensesExcel}
                disabled={filteredAndSortedExpenses.length === 0}
                className="h-8 px-2.5 text-xs gap-1 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                title="Export filtered expense records to Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Excel</span>
              </Button>

              {/* Export Expenses to PDF */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExpensesPDF}
                disabled={filteredAndSortedExpenses.length === 0}
                className="h-8 px-2.5 text-xs gap-1 border-rose-500/40 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                title="Export filtered expense records to PDF"
              >
                <FileText className="w-3.5 h-3.5 text-rose-600" />
                <span className="hidden sm:inline">PDF</span>
              </Button>

              {/* Page Size Selector */}
              <select
                value={expensePageSize}
                onChange={(e) => {
                  setExpensePageSize(Number(e.target.value))
                  setExpensePage(1)
                }}
                className="h-8 text-xs bg-background border border-input rounded-md px-2 font-medium focus:outline-none cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={10000}>All</option>
              </select>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {filteredAndSortedExpenses.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                <TrendingDown className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                No expense disbursements match your active query.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="w-full">
                  <TableHeader className="bg-[#28375C] text-white">
                    <TableRow className="border-b border-[#1b2640] hover:bg-[#28375C] bg-[#28375C]">
                      {/* Sr No */}
                      {visibleExpCols.srNo && (
                        <TableHead className="w-10 text-center text-xs text-white">#</TableHead>
                      )}

                      {/* Voucher / Ref */}
                      {visibleExpCols.referenceNumber && (
                        <TableHead
                          onClick={() => handleExpenseSort('referenceNumber')}
                          className="cursor-pointer hover:text-white hover:bg-[#1f2c4a] select-none whitespace-nowrap text-white group"
                        >
                          <div className="flex items-center gap-1 text-white">
                            <span>Voucher / Ref</span>
                            {renderExpenseSortIcon('referenceNumber')}
                          </div>
                        </TableHead>
                      )}

                      {/* Category */}
                      {visibleExpCols.categoryName && (
                        <TableHead
                          onClick={() => handleExpenseSort('categoryName')}
                          className="cursor-pointer hover:text-white hover:bg-[#1f2c4a] select-none whitespace-nowrap text-white group"
                        >
                          <div className="flex items-center gap-1 text-white">
                            <span>Category</span>
                            {renderExpenseSortIcon('categoryName')}
                          </div>
                        </TableHead>
                      )}

                      {/* Description */}
                      {visibleExpCols.description && (
                        <TableHead
                          onClick={() => handleExpenseSort('description')}
                          className="cursor-pointer hover:text-white hover:bg-[#1f2c4a] select-none min-w-[180px] text-white group"
                        >
                          <div className="flex items-center gap-1 font-semibold text-white">
                            <span>Description / Purpose</span>
                            {renderExpenseSortIcon('description')}
                          </div>
                        </TableHead>
                      )}

                      {/* Vendor */}
                      {visibleExpCols.vendor && (
                        <TableHead
                          onClick={() => handleExpenseSort('vendor')}
                          className="cursor-pointer hover:text-white hover:bg-[#1f2c4a] select-none whitespace-nowrap text-white group"
                        >
                          <div className="flex items-center gap-1 text-white">
                            <span>Paid To / Vendor</span>
                            {renderExpenseSortIcon('vendor')}
                          </div>
                        </TableHead>
                      )}

                      {/* Payment Mode */}
                      {visibleExpCols.paymentMode && (
                        <TableHead
                          onClick={() => handleExpenseSort('paymentMode')}
                          className="cursor-pointer hover:text-white hover:bg-[#1f2c4a] select-none whitespace-nowrap text-white group"
                        >
                          <div className="flex items-center gap-1 text-white">
                            <span>Payment Mode</span>
                            {renderExpenseSortIcon('paymentMode')}
                          </div>
                        </TableHead>
                      )}

                      {/* Date */}
                      {visibleExpCols.expenseDate && (
                        <TableHead
                          onClick={() => handleExpenseSort('expenseDate')}
                          className="cursor-pointer hover:text-white hover:bg-[#1f2c4a] select-none whitespace-nowrap text-white group"
                        >
                          <div className="flex items-center gap-1 text-white">
                            <span>Date</span>
                            {renderExpenseSortIcon('expenseDate')}
                          </div>
                        </TableHead>
                      )}

                      {/* Amount */}
                      {visibleExpCols.amount && (
                        <TableHead
                          onClick={() => handleExpenseSort('amount')}
                          className="cursor-pointer hover:text-white hover:bg-[#1f2c4a] select-none text-right whitespace-nowrap pr-4 text-white group"
                        >
                          <div className="flex items-center justify-end gap-1 text-white">
                            <span>Amount (₹)</span>
                            {renderExpenseSortIcon('amount')}
                          </div>
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {paginatedExpenses.map((e, idx) => {
                      const rowNum = (expensePage - 1) * expensePageSize + idx + 1
                      return (
                        <TableRow key={e.id} className="hover:bg-muted/40 transition-colors">
                          {/* Sr No */}
                          {visibleExpCols.srNo && (
                            <TableCell className="text-xs font-mono text-muted-foreground text-center">
                              {rowNum}
                            </TableCell>
                          )}

                          {/* Reference Number */}
                          {visibleExpCols.referenceNumber && (
                            <TableCell className="font-mono text-xs font-semibold text-foreground whitespace-nowrap">
                              {e.referenceNumber || `VCH-${String(rowNum).padStart(4, '0')}`}
                            </TableCell>
                          )}

                          {/* Category */}
                          {visibleExpCols.categoryName && (
                            <TableCell className="whitespace-nowrap">
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200">
                                {e.categoryName}
                              </span>
                            </TableCell>
                          )}

                          {/* Description */}
                          {visibleExpCols.description && (
                            <TableCell className="text-xs font-medium text-foreground">
                              {e.description}
                            </TableCell>
                          )}

                          {/* Vendor */}
                          {visibleExpCols.vendor && (
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {e.vendor || e.paidTo || '—'}
                            </TableCell>
                          )}

                          {/* Payment Mode */}
                          {visibleExpCols.paymentMode && (
                            <TableCell className="whitespace-nowrap">
                              <Badge
                                variant={
                                  e.paymentMode === 'UPI'
                                    ? 'default'
                                    : e.paymentMode === 'CASH'
                                    ? 'success'
                                    : e.paymentMode === 'BANK_TRANSFER'
                                    ? 'secondary'
                                    : 'outline'
                                }
                                className="text-[10px]"
                              >
                                {e.paymentMode}
                              </Badge>
                            </TableCell>
                          )}

                          {/* Date */}
                          {visibleExpCols.expenseDate && (
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDate(e.expenseDate)}
                            </TableCell>
                          )}

                          {/* Amount */}
                          {visibleExpCols.amount && (
                            <TableCell className="text-right font-bold text-rose-600 text-xs whitespace-nowrap pr-4">
                              {formatCurrency(e.amount)}
                            </TableCell>
                          )}
                        </TableRow>
                      )
                    })}

                    {/* Subtotal Row */}
                    <TableRow className="bg-muted/30 font-bold text-xs border-t-2">
                      <TableCell colSpan={7} className="uppercase font-semibold">
                        Subtotal Operating Expenses ({filteredAndSortedExpenses.length} records)
                      </TableCell>
                      <TableCell className="text-right font-black text-rose-600 text-sm whitespace-nowrap pr-4">
                        {formatCurrency(filteredAndSortedExpenses.reduce((sum, e) => sum + e.amount, 0))}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>

          {/* Expenses Pagination Footer */}
          <div className="p-3 bg-muted/20 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground no-print">
            <div>
              Showing <strong className="text-foreground">{paginatedExpenses.length}</strong> of{' '}
              <strong className="text-foreground">{filteredAndSortedExpenses.length}</strong> filtered vouchers
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExpensePage((p) => Math.max(1, p - 1))}
                disabled={expensePage <= 1}
                className="h-7 text-xs px-2 gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </Button>

              <span className="text-xs font-medium px-2">
                Page {expensePage} of {totalExpensePages}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setExpensePage((p) => Math.min(totalExpensePages, p + 1))}
                disabled={expensePage >= totalExpensePages}
                className="h-7 text-xs px-2 gap-1"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </Card>
      )}


      {/* Collections Column Customization Modal */}
      <Dialog open={isColModalOpen} onOpenChange={setIsColModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontal className="w-4 h-4 text-primary" />
              Customize Collections Columns
            </DialogTitle>
          </DialogHeader>

          <div className="py-3 text-xs space-y-3">
            <p className="text-muted-foreground">
              Select which columns appear in your fee collection register. Preferences are automatically saved on this device.
            </p>

            <div className="grid grid-cols-2 gap-2.5 max-h-64 overflow-y-auto p-1 border rounded-lg bg-muted/30">
              {ALL_COLLECTION_COLS.map((col) => {
                const isChecked = Boolean(visibleColCols[col.id])
                const isAlways = Boolean(col.alwaysVisible)

                return (
                  <label
                    key={col.id}
                    className={`flex items-center gap-2 p-2 rounded border text-xs cursor-pointer select-none transition-colors ${
                      isChecked ? 'bg-card border-primary/40' : 'bg-muted/40 border-transparent text-muted-foreground'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isAlways}
                      onChange={() => toggleColCol(col.id)}
                      className="w-3.5 h-3.5 rounded text-primary focus:ring-primary cursor-pointer disabled:opacity-50"
                    />
                    <span className={isChecked ? 'font-medium text-foreground' : ''}>
                      {col.label}
                    </span>
                  </label>
                )
              })}
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <Button variant="ghost" size="sm" onClick={showAllColCols} className="text-xs h-8">
                Show All
              </Button>
              <Button variant="outline" size="sm" onClick={resetDefaultColCols} className="text-xs h-8">
                Reset Defaults
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Expenses Column Customization Modal */}
      <Dialog open={isExpColModalOpen} onOpenChange={setIsExpColModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontal className="w-4 h-4 text-primary" />
              Customize Expenses Columns
            </DialogTitle>
          </DialogHeader>

          <div className="py-3 text-xs space-y-3">
            <p className="text-muted-foreground">
              Select which columns appear in your operational expenses table. Preferences are automatically saved on this device.
            </p>

            <div className="grid grid-cols-2 gap-2.5 max-h-64 overflow-y-auto p-1 border rounded-lg bg-muted/30">
              {ALL_EXPENSE_COLS.map((col) => {
                const isChecked = Boolean(visibleExpCols[col.id])
                const isAlways = Boolean(col.alwaysVisible)

                return (
                  <label
                    key={col.id}
                    className={`flex items-center gap-2 p-2 rounded border text-xs cursor-pointer select-none transition-colors ${
                      isChecked ? 'bg-card border-primary/40' : 'bg-muted/40 border-transparent text-muted-foreground'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isAlways}
                      onChange={() => toggleExpCol(col.id)}
                      className="w-3.5 h-3.5 rounded text-primary focus:ring-primary cursor-pointer disabled:opacity-50"
                    />
                    <span className={isChecked ? 'font-medium text-foreground' : ''}>
                      {col.label}
                    </span>
                  </label>
                )
              })}
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <Button variant="ghost" size="sm" onClick={showAllExpCols} className="text-xs h-8">
                Show All
              </Button>
              <Button variant="outline" size="sm" onClick={resetDefaultExpCols} className="text-xs h-8">
                Reset Defaults
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt Modal for Instant Print / WhatsApp */}
      {selectedReceipt && (
        <FeeReceiptModal receipt={selectedReceipt} onClose={() => setSelectedReceipt(null)} />
      )}

      {/* Official A4 Financial Statement & Audit Report Modal */}
      <OfficialFinancialReportModal
        isOpen={isOfficialPrintModalOpen}
        onClose={() => setIsOfficialPrintModalOpen(false)}
        summary={summary}
        collections={collections}
        expenses={expenses}
        periodLabel={periodLabel}
        activeMode={activeMode}
        startDate={computedStartDate}
        endDate={computedEndDate}
        currentBranch={currentBranch}
        currentSession={currentSession}
        settings={settings}
        activeLogoUrl={activeLogoUrl}
      />
    </div>
  )
}

export default DailyReportsPage
