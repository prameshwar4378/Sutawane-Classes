import React, { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  X,
  Receipt,
  Eye,
} from 'lucide-react'
import { FeeReceiptModal, type ReceiptData } from '@/components/FeeReceiptModal'
import { StudentSearchAutocomplete } from '@/components/StudentSearchAutocomplete'
import { formatCurrency, formatDate, formatDateLong, numberToWordsINR, getTodayDateString, toInputDateString } from '@/lib/utils'
import { WhatsAppIcon, openWhatsApp, buildReceiptWhatsAppMessage } from '@/lib/whatsapp'
import { exportPaymentsToExcel, exportPaymentsToPDF } from '@/lib/exportUtils'

interface PaymentColumnConfig {
  id: string
  label: string
  defaultVisible: boolean
  alwaysVisible?: boolean
}

const ALL_PAYMENT_COLUMNS: PaymentColumnConfig[] = [
  { id: 'srNo', label: '# (Index)', defaultVisible: true },
  { id: 'receiptNo', label: 'Receipt No.', defaultVisible: true, alwaysVisible: true },
  { id: 'date', label: 'Payment Date', defaultVisible: true },
  { id: 'studentName', label: 'Student Name', defaultVisible: true, alwaysVisible: true },
  { id: 'rollNo', label: 'Roll Number', defaultVisible: true },
  { id: 'standard', label: 'Class / Standard', defaultVisible: true },
  { id: 'branch', label: 'Branch', defaultVisible: true },
  { id: 'session', label: 'Academic Session', defaultVisible: false },
  { id: 'paymentMode', label: 'Payment Mode', defaultVisible: true },
  { id: 'refNotes', label: 'Ref / Notes', defaultVisible: true },
  { id: 'amount', label: 'Amount (₹)', defaultVisible: true, alwaysVisible: true },
  { id: 'status', label: 'Payment Status', defaultVisible: true },
  { id: 'actions', label: 'Actions', defaultVisible: true, alwaysVisible: true },
]

export const CollectFeesPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const queryClient = useQueryClient()
  const {
    selectedBranchId,
    setSelectedBranchId,
    branches,
    currentBranch,
    selectedSessionId,
    sessions,
    courses,
    settings,
  } = useApp()

  // Active view tab: 'collect' | 'history'
  const [activeTab, setActiveTab] = useState<'collect' | 'history'>('collect')

  // Form states
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [targetType, setTargetType] = useState<'ADMISSION' | 'PREVIOUS_DUE'>('ADMISSION')
  const [selectedAdmissionId, setSelectedAdmissionId] = useState<string>('')
  const [selectedPreviousDueId, setSelectedPreviousDueId] = useState<string>('')
  const [paymentDate, setPaymentDate] = useState<string>(() => getTodayDateString())
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

  // Listen to navigation query params or location state to auto-fill individual student
  useEffect(() => {
    const paramStudentId = searchParams.get('studentId') || (location.state as any)?.studentId
    const paramAdmissionId = searchParams.get('admissionId') || (location.state as any)?.admissionId
    const paramPreviousDueId = searchParams.get('previousDueId') || (location.state as any)?.previousDueId
    const paramAmount = searchParams.get('amount') || (location.state as any)?.amount

    if (paramStudentId) {
      setSelectedStudentId(paramStudentId)
      setActiveTab('collect') // Always switch to collection entry form

      if (paramPreviousDueId) {
        setTargetType('PREVIOUS_DUE')
        setSelectedPreviousDueId(paramPreviousDueId)
      } else {
        setTargetType('ADMISSION')
        if (paramAdmissionId) {
          setSelectedAdmissionId(paramAdmissionId)
        }
      }

      if (paramAmount) {
        const num = Number(paramAmount)
        if (!isNaN(num) && num > 0) {
          setAmount(String(num))
        }
      }
      setFormError('')
    }
  }, [searchParams, location.state])

  // 1. Fetch Students List with Universal Branch & Session Filter (Active students only)
  const { data: students = [], isLoading: isLoadingStudents } = useQuery({
    queryKey: ['students-for-fee-collection', selectedBranchId, selectedSessionId],
    queryFn: () =>
      api.get('/students', {
        branchId: selectedBranchId !== 'ALL' ? selectedBranchId : undefined,
        sessionId: selectedSessionId && selectedSessionId !== 'ALL' ? selectedSessionId : undefined,
        isActive: 'true',
      }),
  })

  // 2. Fetch Selected Student Details & Installments
  const { data: selectedProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['student-fee-profile', selectedStudentId, selectedAdmissionId, selectedSessionId],
    queryFn: () =>
      api.get(`/students/${selectedStudentId}`, {
        admissionId: selectedAdmissionId || undefined,
        sessionId: selectedSessionId && selectedSessionId !== 'ALL' ? selectedSessionId : undefined,
      }),
    enabled: Boolean(selectedStudentId),
  })

  // 3. Fetch Recent Payments Register
  const { data: recentPayments = [], isLoading: isLoadingPayments } = useQuery({
    queryKey: ['recent-payments-register', selectedBranchId, selectedSessionId],
    queryFn: () =>
      api.get('/fees/payments', {
        branchId: selectedBranchId !== 'ALL' ? selectedBranchId : undefined,
        sessionId: selectedSessionId && selectedSessionId !== 'ALL' ? selectedSessionId : undefined,
      }),
  })

  // Record Payment Mutation
  const recordPaymentMutation = useMutation({
    mutationFn: (data: any) => api.post('/fees/payments', data),
    onSuccess: (res: any) => {
      // Prepare receipt data
      const payment = res.payment
      const nextRemaining = Math.max(0, Math.round(res.remainingBalance ?? 0))

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
        remainingBalance: nextRemaining,
        parentPhone: res.parentPhone || selectedStudent?.parentPhone,
        studentPhone: res.studentPhone || selectedStudent?.studentPhone,
      })

      // Immediately prefill the amount textbox with the next updated pending balance!
      if (nextRemaining > 0) {
        setAmount(String(nextRemaining))
      } else {
        setAmount('')
      }

      // Optimistically update student profile cache so all pending displays reflect next balance instantly
      queryClient.setQueryData(['student-fee-profile', selectedStudentId], (old: any) => {
        if (!old) return old
        const updatedAllAdmissions = (old.allAdmissions || []).map((adm: any) => {
          if (adm.id === (targetType === 'ADMISSION' ? (selectedAdmissionId || old.currentAdmission?.id) : adm.id)) {
            const newPaid = (adm.paidFees || 0) + payment.totalAmount
            const newPending = Math.max(0, (adm.feePlan?.netPayable ?? adm.pendingFees) - newPaid)
            return {
              ...adm,
              paidFees: newPaid,
              pendingFees: newPending,
            }
          }
          return adm
        })
        const updatedCurrentAdm = old.currentAdmission
          ? {
              ...old.currentAdmission,
              paidFees: (old.currentAdmission.paidFees || 0) + payment.totalAmount,
              pendingFees: nextRemaining,
            }
          : old.currentAdmission

        return {
          ...old,
          currentAdmission: updatedCurrentAdm,
          allAdmissions: updatedAllAdmissions,
          paidFees: (old.paidFees || 0) + payment.totalAmount,
          pendingFees: nextRemaining,
          feeSummary: {
            ...old.feeSummary,
            totalPaid: (old.feeSummary?.totalPaid || 0) + payment.totalAmount,
            totalPending: nextRemaining,
            overallPendingAmount: nextRemaining,
          },
        }
      })

      // Invalidate queries in background
      queryClient.invalidateQueries({ queryKey: ['students'] })
      queryClient.invalidateQueries({ queryKey: ['students-autocomplete'] })
      queryClient.invalidateQueries({ queryKey: ['financial-stats'] })
      queryClient.invalidateQueries({ queryKey: ['recent-payments-register'] })
      queryClient.invalidateQueries({ queryKey: ['student-fee-profile', selectedStudentId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] })

      // Reset transaction fields (preserving the updated amount for next receipt)
      setPaymentDate(getTodayDateString())
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
            admissionId: targetType === 'ADMISSION' ? selectedAdmissionId || undefined : undefined,
            previousDueId: targetType === 'PREVIOUS_DUE' ? selectedPreviousDueId || undefined : undefined,
            amount: Number(amount),
            paymentDate,
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
      queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] })
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

  const selectedStudent = useMemo(() => {
    if (!selectedStudentId) return null
    const fromList = (selectedAdmissionId
      ? students.find((s: any) => s.id === selectedStudentId && s.admissionId === selectedAdmissionId)
      : null) || students.find((s: any) => s.id === selectedStudentId)

    // Always prioritize selectedProfile for live financial numbers (paidFees, pendingFees, overallPendingAmount)
    if (selectedProfile && selectedProfile.id === selectedStudentId) {
      const targetAdm = selectedAdmissionId
        ? selectedProfile.allAdmissions?.find((a: any) => a.id === selectedAdmissionId) || selectedProfile.currentAdmission
        : selectedProfile.currentAdmission

      const livePending = targetAdm?.pendingFees ?? selectedProfile.feeSummary?.overallPendingAmount ?? fromList?.pendingFees ?? 0
      const livePaid = targetAdm?.paidFees ?? selectedProfile.feeSummary?.totalPaid ?? fromList?.paidFees ?? 0
      const liveTotal = targetAdm?.feePlan?.netPayable ?? targetAdm?.feePlan?.totalFees ?? fromList?.totalFees ?? 0

      return {
        id: selectedProfile.id,
        admissionId: targetAdm?.id || fromList?.admissionId,
        studentCode: selectedProfile.studentCode || fromList?.studentCode,
        fullName: selectedProfile.fullName || fromList?.fullName,
        photoUrl: selectedProfile.photoUrl || fromList?.photoUrl,
        rollNumber: targetAdm?.rollNumber || fromList?.rollNumber || '',
        standard: targetAdm?.standard || fromList?.standard || '',
        branchId: targetAdm?.branchId || fromList?.branchId || selectedProfile.branchId,
        branchName: targetAdm?.branch?.name || fromList?.branchName || '',
        sessionId: targetAdm?.sessionId || fromList?.sessionId || selectedProfile.sessionId,
        sessionName: targetAdm?.session?.name || fromList?.sessionName || '',
        parentPhone: selectedProfile.parentPhone || fromList?.parentPhone,
        studentPhone: selectedProfile.studentPhone || fromList?.studentPhone,
        totalFees: liveTotal,
        paidFees: livePaid,
        pendingFees: livePending,
        overallPendingAmount: selectedProfile.feeSummary?.overallPendingAmount ?? livePending,
        isActive: targetAdm?.isActive ?? fromList?.isActive ?? true,
      }
    }
    return fromList || null
  }, [students, selectedStudentId, selectedAdmissionId, selectedProfile])

  // Auto-align admission, amount, and target once selectedProfile finishes fetching
  useEffect(() => {
    if (selectedProfile && selectedProfile.id === selectedStudentId) {
      if (targetType === 'ADMISSION' && !selectedAdmissionId) {
        if (selectedProfile.currentAdmission?.id) {
          setSelectedAdmissionId(selectedProfile.currentAdmission.id)
        }
      }

      // Compute live pending balance for the target
      let targetPending = 0
      if (targetType === 'PREVIOUS_DUE' && selectedPreviousDueId) {
        const prevDue = (selectedProfile.previousSessionDues || []).find(
          (d: any) => d.id === selectedPreviousDueId
        )
        targetPending = prevDue ? prevDue.balanceRemaining : 0
      } else {
        const adm = selectedAdmissionId
          ? selectedProfile.allAdmissions?.find((a: any) => a.id === selectedAdmissionId) || selectedProfile.currentAdmission
          : selectedProfile.currentAdmission
        targetPending =
          adm?.pendingFees ??
          selectedProfile.feeSummary?.overallPendingAmount ??
          selectedProfile.feeSummary?.totalPending ??
          0
      }

      // If amount is not set or empty, prefill with target pending balance.
      // If current amount is greater than targetPending (e.g. stale amount left from prior fee), clamp it to targetPending!
      if (!amount || amount === '0' || Number(amount) > targetPending) {
        if (targetPending > 0) {
          setAmount(String(targetPending))
        } else if (Number(amount) > 0) {
          setAmount('')
        }
      }
    }
  }, [selectedProfile, selectedStudentId, selectedAdmissionId, selectedPreviousDueId, targetType, amount])

  // Compute remaining due based on target selection (admission vs previous due)
  const currentTargetDue = useMemo(() => {
    if (targetType === 'PREVIOUS_DUE') {
      const prevDue = (selectedProfile?.previousSessionDues || []).find((d: any) => d.id === selectedPreviousDueId)
      return prevDue ? prevDue.balanceRemaining : 0
    }
    if (selectedAdmissionId && selectedProfile?.allAdmissions) {
      const targetAdm = selectedProfile.allAdmissions.find((a: any) => a.id === selectedAdmissionId)
      if (targetAdm) return targetAdm.pendingFees
    }
    return selectedProfile?.feeSummary?.totalPending ?? (selectedStudent?.pendingFees || 0)
  }, [targetType, selectedAdmissionId, selectedPreviousDueId, selectedProfile, selectedStudent])

  const remainingDue = currentTargetDue

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
      admissionId: targetType === 'ADMISSION' ? selectedAdmissionId || undefined : undefined,
      previousDueId: targetType === 'PREVIOUS_DUE' ? selectedPreviousDueId || undefined : undefined,
      amount: numAmount,
      paymentMode,
      paymentDate: paymentDate || undefined,
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

  // ----------------------------------------------------
  // Center Fee Collections Register: Table Controls & Filters
  // ----------------------------------------------------
  const [registerSearchQuery, setRegisterSearchQuery] = useState('')
  const [registerBranchId, setRegisterBranchId] = useState<string>('ALL')
  const [registerSessionId, setRegisterSessionId] = useState<string>('ALL')
  const [registerStandard, setRegisterStandard] = useState<string>('ALL')
  const [registerPaymentMode, setRegisterPaymentMode] = useState<string>('ALL')
  const [registerStatus, setRegisterStatus] = useState<'ALL' | 'CONFIRMED' | 'REVERSED'>('ALL')
  const [registerDatePreset, setRegisterDatePreset] = useState<'ALL' | 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM'>('ALL')
  const [registerStartDate, setRegisterStartDate] = useState<string>('')
  const [registerEndDate, setRegisterEndDate] = useState<string>('')

  // Sorting
  const [sortField, setSortField] = useState<string>('paymentDate')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(25)

  // Column Visibility state persisted in localStorage
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('sutawane_payments_columns_v1')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        // fallback
      }
    }
    const initial: Record<string, boolean> = {}
    ALL_PAYMENT_COLUMNS.forEach((col) => {
      initial[col.id] = col.defaultVisible
    })
    return initial
  })
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false)

  // Unique standard/classes available across payments and courses
  const availableStandards = useMemo(() => {
    const stdSet = new Set<string>()
    courses.forEach((c: any) => {
      if (c.name) stdSet.add(c.name)
    })
    recentPayments.forEach((p: any) => {
      const std = p.admission?.standard || p.student?.standard
      if (std) stdSet.add(std)
    })
    return Array.from(stdSet).sort()
  }, [courses, recentPayments])

  const hasActiveRegisterFilters = useMemo(() => {
    return (
      Boolean(registerSearchQuery.trim()) ||
      registerBranchId !== 'ALL' ||
      registerSessionId !== 'ALL' ||
      registerStandard !== 'ALL' ||
      registerPaymentMode !== 'ALL' ||
      registerStatus !== 'ALL' ||
      registerDatePreset !== 'ALL' ||
      Boolean(registerStartDate) ||
      Boolean(registerEndDate)
    )
  }, [
    registerSearchQuery,
    registerBranchId,
    registerSessionId,
    registerStandard,
    registerPaymentMode,
    registerStatus,
    registerDatePreset,
    registerStartDate,
    registerEndDate,
  ])

  const resetAllRegisterFilters = () => {
    setRegisterSearchQuery('')
    setRegisterBranchId('ALL')
    setRegisterSessionId('ALL')
    setRegisterStandard('ALL')
    setRegisterPaymentMode('ALL')
    setRegisterStatus('ALL')
    setRegisterDatePreset('ALL')
    setRegisterStartDate('')
    setRegisterEndDate('')
    setCurrentPage(1)
  }

  // Toggle sort direction or change sort column
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const renderSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-white/50 group-hover:text-white/90 inline-block ml-1" />
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-amber-300 font-bold inline-block ml-1" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-amber-300 font-bold inline-block ml-1" />
    )
  }

  // Column visibility actions
  const toggleColumn = (id: string) => {
    setVisibleColumns((prev) => {
      const updated = { ...prev, [id]: !prev[id] }
      localStorage.setItem('sutawane_payments_columns_v1', JSON.stringify(updated))
      return updated
    })
  }

  const showAllColumns = () => {
    const updated: Record<string, boolean> = {}
    ALL_PAYMENT_COLUMNS.forEach((col) => {
      updated[col.id] = true
    })
    setVisibleColumns(updated)
    localStorage.setItem('sutawane_payments_columns_v1', JSON.stringify(updated))
  }

  const resetDefaultColumns = () => {
    const updated: Record<string, boolean> = {}
    ALL_PAYMENT_COLUMNS.forEach((col) => {
      updated[col.id] = col.defaultVisible
    })
    setVisibleColumns(updated)
    localStorage.setItem('sutawane_payments_columns_v1', JSON.stringify(updated))
  }

  const visibleColumnsCount = Object.values(visibleColumns).filter(Boolean).length

  // Filter & Sort Pipeline
  const filteredAndSortedPayments = useMemo(() => {
    let result = [...recentPayments]

    // 1. Text Search Filter (multi-term matching)
    const q = registerSearchQuery.trim().toLowerCase()
    if (q) {
      const terms = q.split(/\s+/).filter(Boolean)
      result = result.filter((p: any) => {
        const receiptNo = (p.receiptNumber || '').toLowerCase()
        const studentName = (p.student?.fullName || '').toLowerCase()
        const studentCode = (p.student?.studentCode || '').toLowerCase()
        const rollNo = (p.admission?.rollNumber || p.student?.rollNumber || '').toLowerCase()
        const parentPhone = (p.student?.parentPhone || '').replace(/\D/g, '')
        const studentPhone = (p.student?.studentPhone || '').replace(/\D/g, '')
        const standard = (p.admission?.standard || p.student?.standard || '').toLowerCase()
        const branchName = (p.branch?.name || '').toLowerCase()
        const sessionName = (p.session?.name || '').toLowerCase()
        const refNo = (p.referenceNumber || '').toLowerCase()
        const notes = (p.notes || '').toLowerCase()

        return terms.every((term) => {
          const cleanDigits = term.replace(/\D/g, '')
          return (
            receiptNo.includes(term) ||
            studentName.includes(term) ||
            studentCode.includes(term) ||
            rollNo.includes(term) ||
            standard.includes(term) ||
            branchName.includes(term) ||
            sessionName.includes(term) ||
            refNo.includes(term) ||
            notes.includes(term) ||
            (cleanDigits && parentPhone.includes(cleanDigits)) ||
            (cleanDigits && studentPhone.includes(cleanDigits))
          )
        })
      })
    }

    // 2. Branch Filter
    if (registerBranchId !== 'ALL') {
      result = result.filter((p: any) => p.branchId === registerBranchId)
    }

    // 3. Session Filter
    if (registerSessionId !== 'ALL') {
      result = result.filter((p: any) => p.sessionId === registerSessionId)
    }

    // 4. Standard / Class Filter
    if (registerStandard !== 'ALL') {
      result = result.filter((p: any) => {
        const std = p.admission?.standard || p.student?.standard
        return std === registerStandard
      })
    }

    // 5. Payment Mode Filter
    if (registerPaymentMode !== 'ALL') {
      result = result.filter((p: any) => p.paymentMode === registerPaymentMode)
    }

    // 6. Status Filter
    if (registerStatus !== 'ALL') {
      if (registerStatus === 'CONFIRMED') {
        result = result.filter((p: any) => !p.isReversed)
      } else if (registerStatus === 'REVERSED') {
        result = result.filter((p: any) => Boolean(p.isReversed))
      }
    }

    // 7. Date Filter Preset
    if (registerDatePreset !== 'ALL') {
      const now = new Date()
      const isSameDate = (d1: Date, d2: Date) =>
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate()

      result = result.filter((p: any) => {
        if (!p.paymentDate) return false
        const targetDate = toInputDateString(p.paymentDate)
        const today = getTodayDateString()

        if (registerDatePreset === 'TODAY') {
          return targetDate === today
        }
        if (registerDatePreset === 'YESTERDAY') {
          const yesterday = new Date()
          yesterday.setDate(yesterday.getDate() - 1)
          return targetDate === getTodayDateString(yesterday)
        }
        if (registerDatePreset === 'THIS_WEEK') {
          const weekAgo = new Date()
          weekAgo.setDate(weekAgo.getDate() - 7)
          return targetDate >= getTodayDateString(weekAgo) && targetDate <= today
        }
        if (registerDatePreset === 'THIS_MONTH') {
          const now = new Date()
          const monthStart = getTodayDateString(new Date(now.getFullYear(), now.getMonth(), 1))
          const monthEnd = getTodayDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0))
          return targetDate >= monthStart && targetDate <= monthEnd
        }
        if (registerDatePreset === 'CUSTOM') {
          if (registerStartDate && targetDate < registerStartDate) return false
          if (registerEndDate && targetDate > registerEndDate) return false
          return true
        }
        return true
      })
    }

    // 8. Sorting
    result.sort((a: any, b: any) => {
      let valA: any
      let valB: any

      switch (sortField) {
        case 'receiptNumber':
          valA = a.receiptNumber || ''
          valB = b.receiptNumber || ''
          break
        case 'paymentDate':
          valA = new Date(a.paymentDate).getTime() || 0
          valB = new Date(b.paymentDate).getTime() || 0
          break
        case 'studentName':
          valA = a.student?.fullName || ''
          valB = b.student?.fullName || ''
          break
        case 'rollNumber':
          valA = a.admission?.rollNumber || a.student?.rollNumber || ''
          valB = b.admission?.rollNumber || b.student?.rollNumber || ''
          break
        case 'standard':
          valA = a.admission?.standard || a.student?.standard || ''
          valB = b.admission?.standard || b.student?.standard || ''
          break
        case 'branch':
          valA = a.branch?.name || ''
          valB = b.branch?.name || ''
          break
        case 'session':
          valA = a.session?.name || ''
          valB = b.session?.name || ''
          break
        case 'paymentMode':
          valA = a.paymentMode || ''
          valB = b.paymentMode || ''
          break
        case 'amount':
        case 'totalAmount':
          valA = Number(a.totalAmount) || 0
          valB = Number(b.totalAmount) || 0
          break
        case 'status':
          valA = a.isReversed ? 1 : 0
          valB = b.isReversed ? 1 : 0
          break
        default:
          valA = a[sortField] || ''
          valB = b[sortField] || ''
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortDirection === 'asc'
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA)
      }

      const numA = Number(valA) || 0
      const numB = Number(valB) || 0
      return sortDirection === 'asc' ? numA - numB : numB - numA
    })

    return result
  }, [
    recentPayments,
    registerSearchQuery,
    registerBranchId,
    registerSessionId,
    registerStandard,
    registerPaymentMode,
    registerStatus,
    registerDatePreset,
    registerStartDate,
    registerEndDate,
    sortField,
    sortDirection,
  ])

  // Summary KPIs for current filtered payment set
  const registerKPIs = useMemo(() => {
    let totalConfirmedAmount = 0
    let totalReversedAmount = 0
    let confirmedCount = 0
    let reversedCount = 0

    filteredAndSortedPayments.forEach((p: any) => {
      const amt = Number(p.totalAmount) || 0
      if (p.isReversed) {
        totalReversedAmount += amt
        reversedCount++
      } else {
        totalConfirmedAmount += amt
        confirmedCount++
      }
    })

    return {
      totalCount: filteredAndSortedPayments.length,
      confirmedCount,
      reversedCount,
      totalConfirmedAmount,
      totalReversedAmount,
    }
  }, [filteredAndSortedPayments])

  // Pagination Slice
  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredAndSortedPayments.length /
        (pageSize === -1 ? filteredAndSortedPayments.length || 1 : pageSize)
    )
  )

  const paginatedPayments = useMemo(() => {
    if (pageSize === -1) return filteredAndSortedPayments
    const startIndex = (currentPage - 1) * pageSize
    return filteredAndSortedPayments.slice(startIndex, startIndex + pageSize)
  }, [filteredAndSortedPayments, currentPage, pageSize])

  // Reset page when any filter alters
  useEffect(() => {
    setCurrentPage(1)
  }, [
    registerSearchQuery,
    registerBranchId,
    registerSessionId,
    registerStandard,
    registerPaymentMode,
    registerStatus,
    registerDatePreset,
    registerStartDate,
    registerEndDate,
    pageSize,
  ])

  // Export handlers
  const handleExportExcel = () => {
    exportPaymentsToExcel(filteredAndSortedPayments, {
      branchName: currentBranch?.name,
      sessionName: sessions.find((s) => s.id === selectedSessionId)?.name,
    })
    showToast(`Exported ${filteredAndSortedPayments.length} transactions to Excel (.xlsx)`)
  }

  const handleExportPDF = () => {
    exportPaymentsToPDF(filteredAndSortedPayments, {
      instituteName: settings?.institute_name,
      branchName: currentBranch?.name,
      sessionName: sessions.find((s) => s.id === selectedSessionId)?.name,
    })
    showToast(`Exported ${filteredAndSortedPayments.length} transactions to PDF (Landscape A4)`)
  }

  const renderModeBadge = (mode: string) => {
    switch (mode) {
      case 'UPI':
        return (
          <Badge className="bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30 hover:bg-purple-500/20 font-medium">
            UPI
          </Badge>
        )
      case 'CASH':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 font-medium">
            CASH
          </Badge>
        )
      case 'CHEQUE':
        return (
          <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/20 font-medium">
            CHEQUE
          </Badge>
        )
      case 'BANK_TRANSFER':
        return (
          <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20 font-medium">
            BANK TRF
          </Badge>
        )
      case 'CARD':
        return (
          <Badge className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/20 font-medium">
            CARD
          </Badge>
        )
      default:
        return <Badge variant="outline">{mode}</Badge>
    }
  }

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
            Flexible Fee Collection & Receipts
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Collect fees in flexible amounts, generate receipts, and manage transaction history.
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
            Collections Register (
              {hasActiveRegisterFilters
                ? `${filteredAndSortedPayments.length} of ${recentPayments.length}`
                : recentPayments.length}
            )
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
                  Record fee payments of any amount with automatic receipt printing and WhatsApp confirmation
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
                  sessionId={selectedSessionId && selectedSessionId !== 'ALL' ? selectedSessionId : undefined}
                  placeholder="Type student name, roll number, or phone..."
                  selectedStudent={selectedStudent || null}
                  onSelectStudent={(student) => {
                    setSelectedStudentId(student.id)
                    if (student.admissionId) {
                      setSelectedAdmissionId(student.admissionId)
                    }
                    setFormError('')
                    if (student.pendingFees && student.pendingFees > 0) {
                      setAmount(String(student.pendingFees))
                    }
                  }}
                  onClearSelection={() => {
                    setSelectedStudentId('')
                    setSelectedAdmissionId('')
                    setAmount('')
                    setFormError('')
                  }}
                />

                {/* Selected Student Ledger Overview */}
                {selectedStudent && (
                  <div className="space-y-3">
                    <div className="p-3 bg-muted/40 rounded-lg border grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Agreed Session Fee:</span>
                        <span className="font-bold text-foreground">
                          {formatCurrency(selectedProfile?.feeSummary?.netPayable ?? selectedStudent.totalFees)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Session Paid:</span>
                        <span className="font-bold text-emerald-600">
                          {formatCurrency(selectedProfile?.feeSummary?.totalPaid ?? selectedStudent.paidFees)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Session Pending Due:</span>
                        <span className="font-bold text-rose-600">
                          {formatCurrency(selectedProfile?.feeSummary?.totalPending ?? selectedStudent.pendingFees ?? 0)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Overall Total Outstanding:</span>
                        <span className="font-bold text-amber-700 dark:text-amber-300">
                          {formatCurrency(selectedProfile?.feeSummary?.overallPendingAmount ?? selectedStudent.overallPendingAmount ?? 0)}
                        </span>
                      </div>
                    </div>

                    {/* Target Payment Selection (Multi-session & Previous Dues) */}
                    {selectedProfile && (selectedProfile.allAdmissions?.length > 1 || (selectedProfile.previousSessionDues?.length > 0)) && (
                      <div className="p-2.5 bg-muted/20 border rounded-lg space-y-1.5 text-xs">
                        <label className="font-semibold text-foreground block text-[11px]">
                          Select Payment Target (Session / Dues):
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <select
                            value={targetType === 'PREVIOUS_DUE' ? `PREV_${selectedPreviousDueId}` : (selectedAdmissionId || selectedProfile.currentAdmission?.id || '')}
                            onChange={(e) => {
                              const val = e.target.value
                              if (val.startsWith('PREV_')) {
                                setTargetType('PREVIOUS_DUE')
                                const pId = val.replace('PREV_', '')
                                setSelectedPreviousDueId(pId)
                                const due = selectedProfile.previousSessionDues.find((d: any) => d.id === pId)
                                if (due) setAmount(String(due.balanceRemaining))
                              } else {
                                setTargetType('ADMISSION')
                                setSelectedAdmissionId(val)
                                const adm = selectedProfile.allAdmissions.find((a: any) => a.id === val)
                                if (adm && adm.pendingFees > 0) {
                                  setAmount(String(adm.pendingFees))
                                }
                              }
                            }}
                            className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium focus:outline-none cursor-pointer"
                          >
                            <optgroup label="Academic Session Admissions">
                              {selectedProfile.allAdmissions?.map((adm: any) => (
                                <option key={adm.id} value={adm.id}>
                                  {adm.sessionName} — {adm.standard} ({adm.branchName}) | Due: {formatCurrency(adm.pendingFees)}
                                </option>
                              ))}
                            </optgroup>
                            {selectedProfile.previousSessionDues?.filter((d: any) => d.balanceRemaining > 0).length > 0 && (
                              <optgroup label="Carried-Forward Previous Dues">
                                {selectedProfile.previousSessionDues
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
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Amount Received - Eye-catching Prominent Green Box */}
                <div className="p-4 rounded-xl border-2 border-emerald-500 bg-gradient-to-r from-emerald-50/80 via-teal-50/40 to-emerald-50/80 dark:from-emerald-950/40 dark:via-teal-950/20 dark:to-emerald-950/40 shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs sm:text-sm font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                      <IndianRupee className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
                      <span>2. Amount Received (₹) *</span>
                    </label>
                    {remainingDue > 0 && (
                      <button
                        type="button"
                        onClick={() => setAmount(String(remainingDue))}
                        className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 px-3 py-1 rounded-md shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        Pay Full Due (₹{remainingDue.toLocaleString('en-IN')})
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
                      className="pl-12 pr-4 h-16 text-3xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400 bg-white dark:bg-zinc-900 border-2 border-emerald-500 focus-visible:ring-4 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-600 rounded-lg shadow-inner tracking-tight"
                    />
                  </div>

                  {Number(amount) > 0 && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-1 text-xs">
                      <span className="font-bold text-emerald-800 dark:text-emerald-300 capitalize">
                        ₹ {numberToWordsINR(Number(amount))}
                      </span>
                      {remainingDue > 0 && (
                        <span className="font-semibold text-muted-foreground">
                          Balance After Payment:{' '}
                          <strong className="text-foreground">
                            {remainingDue - Number(amount) <= 0
                              ? '₹0 (Fully Settled)'
                              : `₹${(remainingDue - Number(amount)).toLocaleString('en-IN')}`}
                          </strong>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. Payment Date and Mode */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-foreground">
                        3. Payment Date *
                      </label>
                      <button
                        type="button"
                        onClick={() => setPaymentDate(getTodayDateString())}
                        className="text-[10px] text-primary hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
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
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      4. Payment Mode *
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
                      placeholder="e.g. Part payment, Token fee, Advance, Final balance"
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
                <div className="font-semibold text-foreground">Flexible Any-Amount Payments</div>
                <p>
                  Students can pay in any amount, at any time, as many times as needed. Payments
                  directly reduce the student's agreed session fee balance.
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
        <div className="space-y-4">
          {/* Financial KPI Summary Cards Ribbon */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Total Processed Transactions */}
            <Card className="p-3 bg-card border shadow-sm">
              <div className="text-[11px] font-semibold text-muted-foreground flex items-center justify-between">
                <span>Transactions</span>
                <Receipt className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="text-xl font-bold text-foreground mt-1">
                {registerKPIs.totalCount}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Matching active filters</p>
            </Card>

            {/* Net Collections Realized */}
            <Card className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 shadow-sm">
              <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                <span>Net Collections</span>
                <IndianRupee className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
                {formatCurrency(registerKPIs.totalConfirmedAmount)}
              </div>
              <p className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5 font-medium">
                Confirmed realized inflows
              </p>
            </Card>

            {/* Confirmed Volume */}
            <Card className="p-3 bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40 shadow-sm">
              <div className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 flex items-center justify-between">
                <span>Confirmed Receipts</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div className="text-xl font-bold text-blue-900 dark:text-blue-100 mt-1">
                {registerKPIs.confirmedCount}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Valid audit receipts</p>
            </Card>

            {/* Reversed / Void Volume */}
            <Card className="p-3 bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 shadow-sm">
              <div className="text-[11px] font-semibold text-rose-700 dark:text-rose-300 flex items-center justify-between">
                <span>Void / Reversed</span>
                <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
              </div>
              <div className="text-xl font-bold text-rose-700 dark:text-rose-400 mt-1">
                {formatCurrency(registerKPIs.totalReversedAmount)}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {registerKPIs.reversedCount} reversed transactions
              </p>
            </Card>
          </div>

          {/* Main Table Card */}
          <Card className="shadow-sm overflow-hidden">
            {/* Header with Title and Global Action Buttons */}
            <CardHeader className="py-3 px-4 bg-muted/20 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-primary" />
                  <span>Center Fee Collections Register</span>
                </CardTitle>
                <Badge variant="outline" className="text-xs font-normal">
                  Showing {paginatedPayments.length} of {filteredAndSortedPayments.length} entries
                </Badge>
              </div>

              {/* Action Buttons: Columns & Exports */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsColumnModalOpen(true)}
                  className="gap-1.5 text-xs h-8"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Columns ({visibleColumnsCount}/{ALL_PAYMENT_COLUMNS.length})</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportExcel}
                  disabled={filteredAndSortedPayments.length === 0}
                  className="gap-1.5 text-xs h-8 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Export Excel</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPDF}
                  disabled={filteredAndSortedPayments.length === 0}
                  className="gap-1.5 text-xs h-8 border-rose-500/40 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                >
                  <FileText className="w-3.5 h-3.5 text-rose-600" />
                  <span>Export PDF</span>
                </Button>
              </div>
            </CardHeader>

            {/* Advanced Multi-facet Filter Toolbar */}
            <div className="p-3 bg-muted/10 border-b space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                {/* Search Input */}
                <div className="relative sm:col-span-2">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground pointer-events-none" />
                  <Input
                    value={registerSearchQuery}
                    onChange={(e) => setRegisterSearchQuery(e.target.value)}
                    placeholder="Search receipt, student, roll, phone, notes..."
                    className="pl-8 pr-7 h-8 text-xs bg-background"
                  />
                  {registerSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setRegisterSearchQuery('')}
                      className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Branch Filter */}
                <div className="flex items-center gap-1.5 bg-background border rounded-md px-2 h-8">
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <select
                    value={registerBranchId}
                    onChange={(e) => setRegisterBranchId(e.target.value)}
                    className="w-full bg-transparent text-xs font-medium focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">All Branches</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Session Filter */}
                <div className="flex items-center gap-1.5 bg-background border rounded-md px-2 h-8">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <select
                    value={registerSessionId}
                    onChange={(e) => setRegisterSessionId(e.target.value)}
                    className="w-full bg-transparent text-xs font-medium focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">All Sessions</option>
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.isCurrent ? '(Current)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Class / Standard Filter */}
                <div className="flex items-center gap-1.5 bg-background border rounded-md px-2 h-8">
                  <Filter className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <select
                    value={registerStandard}
                    onChange={(e) => setRegisterStandard(e.target.value)}
                    className="w-full bg-transparent text-xs font-medium focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">All Classes / Stds</option>
                    {availableStandards.map((std) => (
                      <option key={std} value={std}>
                        {std}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Payment Mode Filter */}
                <div className="flex items-center gap-1.5 bg-background border rounded-md px-2 h-8">
                  <CreditCard className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <select
                    value={registerPaymentMode}
                    onChange={(e) => setRegisterPaymentMode(e.target.value)}
                    className="w-full bg-transparent text-xs font-medium focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">All Modes</option>
                    <option value="UPI">UPI</option>
                    <option value="CASH">CASH</option>
                    <option value="CHEQUE">CHEQUE</option>
                    <option value="BANK_TRANSFER">BANK TRANSFER</option>
                    <option value="CARD">CARD</option>
                  </select>
                </div>
              </div>

              {/* Second Row of Filters */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-muted/50">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Payment Status Filter */}
                  <div className="flex items-center gap-1.5 bg-background border rounded-md px-2 h-8">
                    <span className="text-[11px] text-muted-foreground font-medium">Status:</span>
                    <select
                      value={registerStatus}
                      onChange={(e) => setRegisterStatus(e.target.value as any)}
                      className="bg-transparent text-xs font-medium focus:outline-none cursor-pointer"
                    >
                      <option value="ALL">All Records</option>
                      <option value="CONFIRMED">Confirmed Only</option>
                      <option value="REVERSED">Reversed / Void</option>
                    </select>
                  </div>

                  {/* Date Range Preset */}
                  <div className="flex items-center gap-1.5 bg-background border rounded-md px-2 h-8">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <select
                      value={registerDatePreset}
                      onChange={(e) => {
                        const val = e.target.value as any
                        setRegisterDatePreset(val)
                        if (val === 'CUSTOM') {
                          if (!registerStartDate) setRegisterStartDate(getTodayDateString())
                          if (!registerEndDate) setRegisterEndDate(getTodayDateString())
                        }
                      }}
                      className="bg-transparent text-xs font-medium focus:outline-none cursor-pointer"
                    >
                      <option value="ALL">All Dates</option>
                      <option value="TODAY">Today</option>
                      <option value="YESTERDAY">Yesterday</option>
                      <option value="THIS_WEEK">Past 7 Days</option>
                      <option value="THIS_MONTH">This Month</option>
                      <option value="CUSTOM">Custom Date Range</option>
                    </select>
                  </div>

                  {/* Custom Date Pickers if CUSTOM selected */}
                  {registerDatePreset === 'CUSTOM' && (
                    <div className="flex items-center gap-1.5 animate-in fade-in">
                      <Input
                        type="date"
                        value={registerStartDate}
                        onChange={(e) => setRegisterStartDate(e.target.value)}
                        className="h-8 text-xs w-36 bg-background"
                      />
                      <span className="text-xs text-muted-foreground">to</span>
                      <Input
                        type="date"
                        value={registerEndDate}
                        onChange={(e) => setRegisterEndDate(e.target.value)}
                        className="h-8 text-xs w-36 bg-background"
                      />
                    </div>
                  )}

                  {/* Page Size Selector */}
                  <div className="flex items-center gap-1.5 bg-background border rounded-md px-2 h-8">
                    <span className="text-[11px] text-muted-foreground font-medium">Per Page:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                      className="bg-transparent text-xs font-medium focus:outline-none cursor-pointer"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={-1}>All</option>
                    </select>
                  </div>
                </div>

                {/* Reset Filters Button */}
                {hasActiveRegisterFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetAllRegisterFilters}
                    className="text-xs h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 gap-1 px-2.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset All Filters
                  </Button>
                )}
              </div>
            </div>

            {/* Table Content */}
            <CardContent className="p-0">
              {isLoadingPayments ? (
                <p className="text-sm text-muted-foreground py-16 text-center">
                  Loading collections register and audit ledgers...
                </p>
              ) : filteredAndSortedPayments.length === 0 ? (
                <div className="py-16 text-center border-dashed m-4 rounded-xl border">
                  <History className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-semibold">No payment records found</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    {hasActiveRegisterFilters
                      ? 'No transactions match your current search, date range, or filter criteria.'
                      : 'Fee collections will appear here once recorded via the Collect Fee Form.'}
                  </p>
                  {hasActiveRegisterFilters && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetAllRegisterFilters}
                      className="mt-3 text-xs"
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="w-full">
                    <TableHeader className="bg-[#28375C] text-white">
                      <TableRow className="border-b border-[#1b2640] hover:bg-[#28375C] bg-[#28375C]">
                        {/* Index */}
                        {visibleColumns.srNo && (
                          <TableHead className="w-12 text-center text-xs text-white">#</TableHead>
                        )}

                        {/* Receipt No */}
                        {visibleColumns.receiptNo && (
                          <TableHead
                            onClick={() => handleSort('receiptNumber')}
                            className="cursor-pointer hover:text-white hover:bg-[#1f2c4a] transition-colors select-none text-xs whitespace-nowrap text-white group"
                          >
                            <div className="flex items-center text-white">
                              <span>Receipt No.</span>
                              {renderSortIcon('receiptNumber')}
                            </div>
                          </TableHead>
                        )}

                        {/* Date */}
                        {visibleColumns.date && (
                          <TableHead
                            onClick={() => handleSort('paymentDate')}
                            className="cursor-pointer hover:text-white hover:bg-[#1f2c4a] transition-colors select-none text-xs whitespace-nowrap text-white group"
                          >
                            <div className="flex items-center text-white">
                              <span>Payment Date</span>
                              {renderSortIcon('paymentDate')}
                            </div>
                          </TableHead>
                        )}

                        {/* Student Name */}
                        {visibleColumns.studentName && (
                          <TableHead
                            onClick={() => handleSort('studentName')}
                            className="cursor-pointer hover:text-white hover:bg-[#1f2c4a] transition-colors select-none text-xs min-w-[170px] text-white group"
                          >
                            <div className="flex items-center font-semibold text-white">
                              <span>Student Name</span>
                              {renderSortIcon('studentName')}
                            </div>
                          </TableHead>
                        )}

                        {/* Roll Number */}
                        {visibleColumns.rollNo && (
                          <TableHead
                            onClick={() => handleSort('rollNumber')}
                            className="cursor-pointer hover:text-white hover:bg-[#1f2c4a] transition-colors select-none text-xs whitespace-nowrap text-white group"
                          >
                            <div className="flex items-center text-white">
                              <span>Roll No.</span>
                              {renderSortIcon('rollNumber')}
                            </div>
                          </TableHead>
                        )}

                        {/* Class / Standard */}
                        {visibleColumns.standard && (
                          <TableHead
                            onClick={() => handleSort('standard')}
                            className="cursor-pointer hover:text-white hover:bg-[#1f2c4a] transition-colors select-none text-xs whitespace-nowrap text-white group"
                          >
                            <div className="flex items-center text-white">
                              <span>Class / Std</span>
                              {renderSortIcon('standard')}
                            </div>
                          </TableHead>
                        )}

                        {/* Branch */}
                        {visibleColumns.branch && (
                          <TableHead
                            onClick={() => handleSort('branch')}
                            className="cursor-pointer hover:text-white hover:bg-[#1f2c4a] transition-colors select-none text-xs whitespace-nowrap text-white group"
                          >
                            <div className="flex items-center text-white">
                              <span>Branch</span>
                              {renderSortIcon('branch')}
                            </div>
                          </TableHead>
                        )}

                        {/* Session */}
                        {visibleColumns.session && (
                          <TableHead
                            onClick={() => handleSort('session')}
                            className="cursor-pointer hover:text-white hover:bg-[#1f2c4a] transition-colors select-none text-xs whitespace-nowrap text-white group"
                          >
                            <div className="flex items-center text-white">
                              <span>Session</span>
                              {renderSortIcon('session')}
                            </div>
                          </TableHead>
                        )}

                        {/* Mode */}
                        {visibleColumns.paymentMode && (
                          <TableHead
                            onClick={() => handleSort('paymentMode')}
                            className="cursor-pointer hover:text-white hover:bg-[#1f2c4a] transition-colors select-none text-xs whitespace-nowrap text-white group"
                          >
                            <div className="flex items-center text-white">
                              <span>Mode</span>
                              {renderSortIcon('paymentMode')}
                            </div>
                          </TableHead>
                        )}

                        {/* Ref / Notes */}
                        {visibleColumns.refNotes && (
                          <TableHead className="text-xs whitespace-nowrap text-white">Ref / Notes</TableHead>
                        )}

                        {/* Amount */}
                        {visibleColumns.amount && (
                          <TableHead
                            onClick={() => handleSort('totalAmount')}
                            className="cursor-pointer hover:text-white hover:bg-[#1f2c4a] transition-colors select-none text-xs whitespace-nowrap text-white group"
                          >
                            <div className="flex items-center text-white">
                              <span>Amount (₹)</span>
                              {renderSortIcon('totalAmount')}
                            </div>
                          </TableHead>
                        )}

                        {/* Status */}
                        {visibleColumns.status && (
                          <TableHead
                            onClick={() => handleSort('status')}
                            className="cursor-pointer hover:text-white hover:bg-[#1f2c4a] transition-colors select-none text-xs whitespace-nowrap text-white group"
                          >
                            <div className="flex items-center text-white">
                              <span>Status</span>
                              {renderSortIcon('status')}
                            </div>
                          </TableHead>
                        )}

                        {/* Actions */}
                        {visibleColumns.actions && (
                          <TableHead className="text-right text-xs whitespace-nowrap pr-4 text-white font-semibold">
                            Actions
                          </TableHead>
                        )}
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {paginatedPayments.map((p: any, idx: number) => {
                        const serial = pageSize === -1 ? idx + 1 : (currentPage - 1) * pageSize + idx + 1
                        const studentStd = p.admission?.standard || p.student?.standard || '—'
                        const studentRoll = p.admission?.rollNumber || p.student?.rollNumber || '—'

                        return (
                          <TableRow key={p.id} className="hover:bg-muted/40 transition-colors">
                            {/* Index */}
                            {visibleColumns.srNo && (
                              <TableCell className="text-center font-mono text-xs text-muted-foreground">
                                {serial}
                              </TableCell>
                            )}

                            {/* Receipt Number */}
                            {visibleColumns.receiptNo && (
                              <TableCell className="font-mono text-xs font-bold text-foreground whitespace-nowrap">
                                {p.receiptNumber}
                              </TableCell>
                            )}

                            {/* Payment Date */}
                            {visibleColumns.date && (
                              <TableCell className="text-xs whitespace-nowrap">
                                {formatDate(p.paymentDate)}
                              </TableCell>
                            )}

                            {/* Student Name */}
                            {visibleColumns.studentName && (
                              <TableCell className="min-w-[170px]">
                                <div
                                  onClick={() => p.studentId && navigate(`/students/${p.studentId}`)}
                                  className="font-semibold text-foreground hover:underline cursor-pointer flex items-center gap-1.5"
                                  title="View Student Profile"
                                >
                                  <span>{p.student?.fullName || '—'}</span>
                                </div>
                                <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                  {p.student?.studentCode && (
                                    <span className="font-mono">{p.student.studentCode}</span>
                                  )}
                                  {p.student?.parentPhone && (
                                    <>
                                      <span>•</span>
                                      <span>Ph: {p.student.parentPhone}</span>
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            )}

                            {/* Roll Number */}
                            {visibleColumns.rollNo && (
                              <TableCell className="font-mono text-xs whitespace-nowrap">
                                {studentRoll}
                              </TableCell>
                            )}

                            {/* Class / Standard */}
                            {visibleColumns.standard && (
                              <TableCell className="whitespace-nowrap">
                                <Badge variant="outline" className="text-[11px] font-normal">
                                  {studentStd}
                                </Badge>
                              </TableCell>
                            )}

                            {/* Branch */}
                            {visibleColumns.branch && (
                              <TableCell className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                                {p.branch?.name || '—'}
                              </TableCell>
                            )}

                            {/* Session */}
                            {visibleColumns.session && (
                              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                {p.session?.name || '—'}
                              </TableCell>
                            )}

                            {/* Mode */}
                            {visibleColumns.paymentMode && (
                              <TableCell className="whitespace-nowrap">
                                {renderModeBadge(p.paymentMode)}
                              </TableCell>
                            )}

                            {/* Ref / Notes */}
                            {visibleColumns.refNotes && (
                              <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate" title={p.referenceNumber || p.notes || ''}>
                                {p.referenceNumber || p.notes || '—'}
                              </TableCell>
                            )}

                            {/* Amount */}
                            {visibleColumns.amount && (
                              <TableCell className="whitespace-nowrap">
                                <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                                  {formatCurrency(p.totalAmount)}
                                </span>
                              </TableCell>
                            )}

                            {/* Status */}
                            {visibleColumns.status && (
                              <TableCell className="whitespace-nowrap">
                                {p.isReversed ? (
                                  <Badge
                                    variant="destructive"
                                    className="gap-1 text-[10px] font-medium"
                                    title={p.reversalReason ? `Reason: ${p.reversalReason}` : undefined}
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    Reversed
                                  </Badge>
                                ) : (
                                  <Badge variant="success" className="gap-1 text-[10px] font-medium">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Confirmed
                                  </Badge>
                                )}
                              </TableCell>
                            )}

                            {/* Actions */}
                            {visibleColumns.actions && (
                              <TableCell className="text-right whitespace-nowrap pr-4 space-x-1.5">
                                {/* Print Receipt Button */}
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
                                      parentPhone: p.student?.parentPhone,
                                      studentPhone: p.student?.studentPhone,
                                      branchName: p.branch?.name,
                                      standard: p.admission?.standard || p.student?.standard,
                                      rollNumber: p.admission?.rollNumber || p.student?.rollNumber,
                                    })
                                  }
                                  className="h-7 gap-1 text-xs px-2"
                                  title="Print or view A4/thermal official receipt"
                                >
                                  <Printer className="w-3 h-3" />
                                  <span>Receipt</span>
                                </Button>

                                {/* WhatsApp Receipt Button */}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const msg = buildReceiptWhatsAppMessage({
                                      instituteName: settings?.institute_name,
                                      studentName: p.student?.fullName || 'Student',
                                      rollNumber: p.admission?.rollNumber || p.student?.rollNumber,
                                      standard: p.admission?.standard || p.student?.standard,
                                      receiptNumber: p.receiptNumber,
                                      totalAmount: p.totalAmount,
                                      paymentDate: p.paymentDate,
                                      paymentMode: p.paymentMode,
                                      referenceNumber: p.referenceNumber,
                                      branchName: p.branch?.name,
                                      helpline: settings?.phone,
                                    })
                                    openWhatsApp(p.student?.parentPhone || '', msg)
                                  }}
                                  className="h-7 gap-1 text-xs px-2 text-emerald-600 border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40"
                                  title="Send receipt to registered parent via WhatsApp"
                                >
                                  <WhatsAppIcon className="w-3.5 h-3.5" />
                                  <span className="hidden md:inline">WhatsApp</span>
                                </Button>

                                {!p.isReversed && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setReversalTarget(p)
                                      setReversalReason('')
                                    }}
                                    className="h-7 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs px-2 gap-1"
                                    title="Reverse payment and update ledger"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    <span>Reverse</span>
                                  </Button>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>

            {/* Table Footer with Pagination Controls */}
            {filteredAndSortedPayments.length > 0 && (
              <div className="p-3 bg-muted/20 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground">
                <div>
                  Showing{' '}
                  <strong className="text-foreground">
                    {pageSize === -1
                      ? filteredAndSortedPayments.length
                      : (currentPage - 1) * pageSize + 1}
                  </strong>{' '}
                  to{' '}
                  <strong className="text-foreground">
                    {pageSize === -1
                      ? filteredAndSortedPayments.length
                      : Math.min(currentPage * pageSize, filteredAndSortedPayments.length)}
                  </strong>{' '}
                  of <strong className="text-foreground">{filteredAndSortedPayments.length}</strong> transactions
                </div>

                {pageSize !== -1 && totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="h-7 text-xs px-2 gap-1"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      Previous
                    </Button>

                    <div className="flex items-center gap-1 px-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(
                          (p) =>
                            p === 1 ||
                            p === totalPages ||
                            Math.abs(p - currentPage) <= 1
                        )
                        .map((p, i, arr) => {
                          const prev = arr[i - 1]
                          return (
                            <React.Fragment key={p}>
                              {prev && p - prev > 1 && (
                                <span className="px-1 text-muted-foreground">...</span>
                              )}
                              <Button
                                variant={currentPage === p ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setCurrentPage(p)}
                                className="h-7 w-7 p-0 text-xs"
                              >
                                {p}
                              </Button>
                            </React.Fragment>
                          )
                        })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      className="h-7 text-xs px-2 gap-1"
                    >
                      Next
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Column Visibility Customization Dialog */}
      <Dialog open={isColumnModalOpen} onOpenChange={setIsColumnModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontal className="w-4 h-4 text-primary" />
              Customize Collections Register Columns
            </DialogTitle>
          </DialogHeader>

          <div className="py-3 text-xs space-y-3">
            <p className="text-muted-foreground">
              Select which columns appear in your fee transactions register. Your preferences are saved automatically on this device.
            </p>

            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto p-1 border rounded-lg bg-muted/30">
              {ALL_PAYMENT_COLUMNS.map((col) => {
                const isChecked = Boolean(visibleColumns[col.id])
                const isAlways = Boolean(col.alwaysVisible)

                return (
                  <label
                    key={col.id}
                    className={`flex items-center gap-2 p-2 rounded border text-xs cursor-pointer select-none transition-colors ${
                      isChecked
                        ? 'bg-card border-primary/40'
                        : 'bg-muted/40 border-transparent text-muted-foreground'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isAlways}
                      onChange={() => toggleColumn(col.id)}
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
              <Button variant="ghost" size="sm" onClick={showAllColumns} className="text-xs h-8">
                Show All
              </Button>
              <Button variant="outline" size="sm" onClick={resetDefaultColumns} className="text-xs h-8">
                Reset Defaults
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button size="sm" onClick={() => setIsColumnModalOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                This will automatically restore the student's pending balance without deleting the
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
