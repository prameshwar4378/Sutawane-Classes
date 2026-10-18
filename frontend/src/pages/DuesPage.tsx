import React, { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useApp } from '@/context/AppContext'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ClockAlert,
  CreditCard,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  TrendingDown,
  User,
  Search,
  X,
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  RotateCcw,
  FileSpreadsheet,
  FileText,
  ChevronLeft,
  ChevronRight,
  Building2,
  CalendarDays,
} from 'lucide-react'
import { cn, formatCurrency, formatDateLong, formatDate, getTodayDateString, toInputDateString } from '@/lib/utils'
import { WhatsAppIcon, openWhatsApp, buildFeeReminderWhatsAppMessage } from '@/lib/whatsapp'
import { exportDuesToExcel, exportDuesToPDF, type DueExportItem } from '@/lib/exportUtils'

// Column Definition Schema
interface ColumnDef {
  id: string
  label: string
  alwaysVisible?: boolean
  defaultVisible: boolean
}

const ALL_DUES_COLUMNS: ColumnDef[] = [
  { id: 'srNo', label: '# / Sr No', defaultVisible: true },
  { id: 'studentName', label: 'Student Name', alwaysVisible: true, defaultVisible: true },
  { id: 'rollNo', label: 'Roll Number', defaultVisible: true },
  { id: 'standard', label: 'Class / Course', defaultVisible: true },
  { id: 'branch', label: 'Branch Location', defaultVisible: true },
  { id: 'session', label: 'Academic Session', defaultVisible: false },
  { id: 'dueDate', label: 'Due Date', defaultVisible: true },
  { id: 'parentPhone', label: 'Parent Mobile', defaultVisible: true },
  { id: 'amountDue', label: 'Session / Due Fee', defaultVisible: true },
  { id: 'amountPaid', label: 'Amount Paid', defaultVisible: true },
  { id: 'balanceRemaining', label: 'Remaining Balance', alwaysVisible: true, defaultVisible: true },
  { id: 'status', label: 'Due Status', defaultVisible: true },
  { id: 'actions', label: 'Actions Toolbar', alwaysVisible: true, defaultVisible: true },
]

export const DuesPage: React.FC = () => {
  const navigate = useNavigate()
  const {
    selectedBranchId,
    selectedSessionId,
    branches,
    sessions,
    courses,
    currentBranch,
    currentSession,
    settings,
    activeLogoUrl,
  } = useApp()

  const queryClient = useQueryClient()

  // Modals & UI States
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const [editingDueItem, setEditingDueItem] = useState<any>(null)
  const [editDueDateInput, setEditDueDateInput] = useState<string>('')

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 4500)
  }

  // Update Due Date mutation
  const updateDueDateMutation = useMutation({
    mutationFn: (data: { installmentId: string; dueDate: string }) =>
      api.patch(`/fees/installments/${data.installmentId}/due-date`, { dueDate: data.dueDate }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dues-register-all'] })
      queryClient.invalidateQueries({ queryKey: ['students'] })
      queryClient.invalidateQueries({ queryKey: ['financial-stats'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] })
      setEditingDueItem(null)
      showToast('Fee due date updated successfully!')
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to update due date')
    },
  })

  // Column Visibility state persisted in localStorage
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('sutawane_dues_columns_v1')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        // fallback
      }
    }
    const initial: Record<string, boolean> = {}
    ALL_DUES_COLUMNS.forEach((col) => {
      initial[col.id] = col.defaultVisible
    })
    return initial
  })

  const toggleColumn = (id: string) => {
    setVisibleColumns((prev) => {
      const updated = { ...prev, [id]: !prev[id] }
      localStorage.setItem('sutawane_dues_columns_v1', JSON.stringify(updated))
      return updated
    })
  }

  const showAllColumns = () => {
    const updated: Record<string, boolean> = {}
    ALL_DUES_COLUMNS.forEach((col) => {
      updated[col.id] = true
    })
    setVisibleColumns(updated)
    localStorage.setItem('sutawane_dues_columns_v1', JSON.stringify(updated))
  }

  const resetDefaultColumns = () => {
    const updated: Record<string, boolean> = {}
    ALL_DUES_COLUMNS.forEach((col) => {
      updated[col.id] = col.defaultVisible
    })
    setVisibleColumns(updated)
    localStorage.setItem('sutawane_dues_columns_v1', JSON.stringify(updated))
  }

  const visibleColumnsCount = Object.values(visibleColumns).filter(Boolean).length

  // Filter States
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OVERDUE' | 'DUE' | 'PARTIAL' | 'UPCOMING'>('ALL')
  const [branchFilter, setBranchFilter] = useState<string>(() => selectedBranchId || 'ALL')
  const [sessionFilter, setSessionFilter] = useState<string>(() => (selectedSessionId && selectedSessionId !== 'ALL' ? selectedSessionId : 'ALL'))
  const [standardFilter, setStandardFilter] = useState<string>('ALL')
  const [datePreset, setDatePreset] = useState<string>('ALL')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  // Sync with global header branch/session changes
  useEffect(() => {
    if (selectedBranchId) {
      setBranchFilter(selectedBranchId)
    }
  }, [selectedBranchId])

  useEffect(() => {
    if (selectedSessionId) {
      setSessionFilter(selectedSessionId)
    }
  }, [selectedSessionId])

  // Sorting State
  const [sortField, setSortField] = useState<string>('dueDate')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(25)

  // Fetch all dues dynamically based on active in-page branch & session filters
  const { data: rawDues = [], isLoading } = useQuery<DueExportItem[]>({
    queryKey: ['dues-register-all', branchFilter, sessionFilter],
    queryFn: () =>
      api.get('/fees/dues', {
        branchId: branchFilter !== 'ALL' ? branchFilter : undefined,
        sessionId: sessionFilter !== 'ALL' && sessionFilter ? sessionFilter : undefined,
      }),
  })

  // Distinct standards list derived from courses and data
  const availableStandards = useMemo(() => {
    const set = new Set<string>()
    courses.forEach((c) => {
      if (c.name) set.add(c.name)
    })
    rawDues.forEach((d) => {
      if (d.student?.standard) set.add(d.student.standard)
    })
    return Array.from(set).sort()
  }, [courses, rawDues])

  // Helper to test if a due date falls in chosen date preset
  const isDateInPreset = (dueDateStr: string, preset: string, start?: string, end?: string): boolean => {
    if (!dueDateStr) return true
    if (preset === 'ALL') return true

    const targetDate = toInputDateString(dueDateStr)
    const today = getTodayDateString()

    if (preset === 'OVERDUE') {
      return targetDate < today
    }
    if (preset === 'TODAY') {
      return targetDate === today
    }
    if (preset === 'THIS_WEEK') {
      const now = new Date()
      const dayOfWeek = now.getDay()
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday)
      const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday + 6)
      return targetDate >= getTodayDateString(weekStart) && targetDate <= getTodayDateString(weekEnd)
    }
    if (preset === 'THIS_MONTH') {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return targetDate >= getTodayDateString(monthStart) && targetDate <= getTodayDateString(monthEnd)
    }
    if (preset === 'CUSTOM') {
      if (start && targetDate < start) return false
      if (end && targetDate > end) return false
      return true
    }
    return true
  }

  // Filter & Sort Pipeline
  const filteredAndSortedDues = useMemo(() => {
    let result = [...rawDues]

    // Status Filter
    if (statusFilter !== 'ALL') {
      result = result.filter((d) => d.status === statusFilter)
    }

    // Branch Filter
    if (branchFilter !== 'ALL') {
      result = result.filter((d: any) => {
        return (
          d.branchId === branchFilter ||
          d.student?.branchName?.toLowerCase() === branchFilter.toLowerCase()
        )
      })
    }

    // Session Filter
    if (sessionFilter !== 'ALL') {
      result = result.filter((d: any) => {
        return (
          d.sessionId === sessionFilter ||
          d.student?.sessionName?.toLowerCase() === sessionFilter.toLowerCase()
        )
      })
    }

    // Standard / Class Filter
    if (standardFilter !== 'ALL') {
      result = result.filter((d) => d.student?.standard === standardFilter)
    }

    // Date Range / Preset Filter
    if (datePreset !== 'ALL') {
      result = result.filter((d) => isDateInPreset(d.dueDate, datePreset, startDate, endDate))
    }

    // Search Query (Multi-word search across name, roll no, student code, phone, standard)
    if (searchQuery.trim()) {
      const tokens = searchQuery.toLowerCase().trim().split(/\s+/)
      result = result.filter((d) => {
        const targetString = [
          d.student?.fullName || '',
          d.student?.rollNumber || '',
          d.student?.studentCode || '',
          d.student?.standard || '',
          d.student?.parentPhone || '',
          d.student?.branchName || '',
          d.student?.sessionName || '',
          d.label || '',
        ].join(' ').toLowerCase()

        return tokens.every((token) => targetString.includes(token))
      })
    }

    // Sorting
    result.sort((a: any, b: any) => {
      let valA: any
      let valB: any

      switch (sortField) {
        case 'studentName':
          valA = a.student?.fullName || ''
          valB = b.student?.fullName || ''
          break
        case 'rollNo':
          valA = a.student?.rollNumber || ''
          valB = b.student?.rollNumber || ''
          break
        case 'standard':
          valA = a.student?.standard || ''
          valB = b.student?.standard || ''
          break
        case 'branch':
          valA = a.student?.branchName || ''
          valB = b.student?.branchName || ''
          break
        case 'session':
          valA = a.student?.sessionName || ''
          valB = b.student?.sessionName || ''
          break
        case 'dueDate':
          valA = new Date(a.dueDate).getTime()
          valB = new Date(b.dueDate).getTime()
          break
        case 'parentPhone':
          valA = a.student?.parentPhone || ''
          valB = b.student?.parentPhone || ''
          break
        case 'amountDue':
          valA = Number(a.amountDue || 0)
          valB = Number(b.amountDue || 0)
          break
        case 'amountPaid':
          valA = Number(a.amountPaid || 0)
          valB = Number(b.amountPaid || 0)
          break
        case 'balanceRemaining':
          valA = Number(a.balanceRemaining || 0)
          valB = Number(b.balanceRemaining || 0)
          break
        case 'status':
          valA = a.status || ''
          valB = b.status || ''
          break
        default:
          valA = new Date(a.dueDate).getTime()
          valB = new Date(b.dueDate).getTime()
          break
      }

      if (typeof valA === 'string') {
        valA = valA.toLowerCase()
        valB = (valB || '').toLowerCase()
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
      }

      const numA = Number(valA) || 0
      const numB = Number(valB) || 0
      return sortDirection === 'asc' ? numA - numB : numB - numA
    })

    return result
  }, [
    rawDues,
    statusFilter,
    branchFilter,
    sessionFilter,
    standardFilter,
    datePreset,
    startDate,
    endDate,
    searchQuery,
    sortField,
    sortDirection,
  ])

  // Summary Metrics computed across all dues
  const overdueList = useMemo(() => rawDues.filter((d) => d.status === 'OVERDUE'), [rawDues])
  const dueTodayList = useMemo(() => rawDues.filter((d) => d.status === 'DUE'), [rawDues])
  const partialList = useMemo(() => rawDues.filter((d) => d.status === 'PARTIAL'), [rawDues])
  const upcomingList = useMemo(() => rawDues.filter((d) => d.status === 'UPCOMING'), [rawDues])

  const totalPendingAmount = useMemo(
    () => rawDues.reduce((sum, d) => sum + (d.balanceRemaining || 0), 0),
    [rawDues]
  )
  const totalOverdueAmount = useMemo(
    () => overdueList.reduce((sum, d) => sum + (d.balanceRemaining || 0), 0),
    [overdueList]
  )
  const totalDueTodayAmount = useMemo(
    () => dueTodayList.reduce((sum, d) => sum + (d.balanceRemaining || 0), 0),
    [dueTodayList]
  )

  // Active filter indicator & reset
  const hasActiveFilters = Boolean(
    searchQuery ||
    statusFilter !== 'ALL' ||
    branchFilter !== 'ALL' ||
    sessionFilter !== 'ALL' ||
    standardFilter !== 'ALL' ||
    datePreset !== 'ALL' ||
    startDate ||
    endDate
  )

  const resetAllFilters = () => {
    setSearchQuery('')
    setStatusFilter('ALL')
    setBranchFilter('ALL')
    setSessionFilter('ALL')
    setStandardFilter('ALL')
    setDatePreset('ALL')
    setStartDate('')
    setEndDate('')
    setCurrentPage(1)
  }

  // Pagination Slice
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedDues.length / pageSize))
  const paginatedDues = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return filteredAndSortedDues.slice(startIndex, startIndex + pageSize)
  }, [filteredAndSortedDues, currentPage, pageSize])

  // Sort toggle handler
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const renderSortIcon = (field: string) => {
    if (sortField === field) {
      return sortDirection === 'asc' ? (
        <ArrowUp className="w-3.5 h-3.5 text-amber-300 font-bold" />
      ) : (
        <ArrowDown className="w-3.5 h-3.5 text-amber-300 font-bold" />
      )
    }
    return <ArrowUpDown className="w-3.5 h-3.5 text-white/50 group-hover:text-white/90" />
  }

  // Export handlers
  const handleExportExcel = () => {
    if (filteredAndSortedDues.length === 0) return
    exportDuesToExcel(filteredAndSortedDues, {
      branchName: currentBranch?.name,
      sessionName: currentSession?.name,
    })
    showToast(`Exported ${filteredAndSortedDues.length} dues records to Excel (.xlsx)`)
  }

  const handleExportPDF = async () => {
    if (filteredAndSortedDues.length === 0) return
    await exportDuesToPDF(filteredAndSortedDues, {
      instituteName: settings?.institute_name || currentBranch?.name || 'Sutawane Classes',
      branchName: currentBranch?.name,
      sessionName: currentSession?.name,
      logoUrl: activeLogoUrl || settings?.logo_url,
      tagline: settings?.tagline,
      address: currentBranch?.address || settings?.address,
      phone: currentBranch?.phone || settings?.phone,
      email: settings?.email,
    })
    showToast(`Exported ${filteredAndSortedDues.length} dues records to PDF (.pdf)`)
  }

  // WhatsApp Reminder handler
  const handleWhatsAppReminder = (d: DueExportItem) => {
    const phone = d.student?.parentPhone
    if (!phone) {
      alert(`No parent mobile number registered for ${d.student?.fullName || 'student'}`)
      return
    }
    const msg = buildFeeReminderWhatsAppMessage({
      instituteName: settings?.institute_name || currentBranch?.name || 'Sutawane Classes',
      studentName: d.student.fullName,
      rollNumber: d.student.rollNumber,
      standard: d.student.standard,
      pendingAmount: d.balanceRemaining,
      branchName: d.student.branchName || currentBranch?.name,
      helpline: settings?.phone || currentBranch?.phone,
    })
    openWhatsApp(phone, msg)
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 p-4 bg-foreground text-background rounded-xl shadow-xl flex items-center gap-2 text-sm font-medium animate-in fade-in slide-in-from-bottom-4 border">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {toastMsg}
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ClockAlert className="w-6 h-6 text-rose-600" />
            Student Fee Dues Register
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track student fee balances, identify overdue accounts, send WhatsApp reminders, and collect pending amounts.
          </p>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Column Visibility Toggle Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsColumnModalOpen(true)}
            className="gap-1.5 text-xs h-9"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Columns ({visibleColumnsCount}/{ALL_DUES_COLUMNS.length})</span>
          </Button>

          {/* Export to Excel Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={filteredAndSortedDues.length === 0}
            className="gap-1.5 text-xs h-9 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export Excel</span>
          </Button>

          {/* Export to PDF Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            disabled={filteredAndSortedDues.length === 0}
            className="gap-1.5 text-xs h-9 border-rose-500/40 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
          >
            <FileText className="w-3.5 h-3.5 text-rose-600" />
            <span>Export PDF</span>
          </Button>

          {/* Collect Fees Now Button */}
          <Button
            onClick={() => navigate('/fees/collect')}
            size="sm"
            className="gap-2 h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm"
          >
            <CreditCard className="w-4 h-4" />
            Collect Fees Now
          </Button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Overdue */}
        <Card
          onClick={() => {
            setStatusFilter('OVERDUE')
            setCurrentPage(1)
          }}
          className={cn(
            'border-rose-200 bg-rose-50/40 dark:bg-rose-950/20 shadow-sm cursor-pointer transition-all hover:shadow-md hover:border-rose-400',
            statusFilter === 'OVERDUE' && 'ring-2 ring-rose-500 shadow-md bg-rose-50/80 dark:bg-rose-950/40'
          )}
        >
          <CardHeader className="py-3 pb-1">
            <CardTitle className="text-xs font-semibold uppercase text-rose-700 dark:text-rose-300 flex items-center justify-between">
              <span>Overdue Dues</span>
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600">
              {formatCurrency(totalOverdueAmount)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {overdueList.length} accounts overdue
            </p>
          </CardContent>
        </Card>

        {/* Due Today */}
        <Card
          onClick={() => {
            setStatusFilter('DUE')
            setCurrentPage(1)
          }}
          className={cn(
            'border-amber-200 bg-amber-50/40 dark:bg-amber-950/20 shadow-sm cursor-pointer transition-all hover:shadow-md hover:border-amber-400',
            statusFilter === 'DUE' && 'ring-2 ring-amber-500 shadow-md bg-amber-50/80 dark:bg-amber-950/40'
          )}
        >
          <CardHeader className="py-3 pb-1">
            <CardTitle className="text-xs font-semibold uppercase text-amber-700 dark:text-amber-300 flex items-center justify-between">
              <span>Due Today</span>
              <Calendar className="w-4 h-4 text-amber-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {formatCurrency(totalDueTodayAmount)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {dueTodayList.length} accounts due today
            </p>
          </CardContent>
        </Card>

        {/* Partially Paid */}
        <Card
          onClick={() => {
            setStatusFilter('PARTIAL')
            setCurrentPage(1)
          }}
          className={cn(
            'border-blue-200 bg-blue-50/40 dark:bg-blue-950/20 shadow-sm cursor-pointer transition-all hover:shadow-md hover:border-blue-400',
            statusFilter === 'PARTIAL' && 'ring-2 ring-blue-500 shadow-md bg-blue-50/80 dark:bg-blue-950/40'
          )}
        >
          <CardHeader className="py-3 pb-1">
            <CardTitle className="text-xs font-semibold uppercase text-blue-700 dark:text-blue-300 flex items-center justify-between">
              <span>Partially Settled</span>
              <TrendingDown className="w-4 h-4 text-blue-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {partialList.length} Accounts
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Partial payments received
            </p>
          </CardContent>
        </Card>

        {/* Total Outstanding */}
        <Card
          onClick={() => {
            setStatusFilter('ALL')
            setCurrentPage(1)
          }}
          className={cn(
            'shadow-sm cursor-pointer transition-all hover:shadow-md hover:border-slate-400',
            statusFilter === 'ALL' && 'ring-2 ring-slate-800 dark:ring-slate-200 shadow-md'
          )}
        >
          <CardHeader className="py-3 pb-1">
            <CardTitle className="text-xs font-semibold uppercase text-muted-foreground flex items-center justify-between">
              <span>Total Outstanding Dues</span>
              <ClockAlert className="w-4 h-4 text-slate-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(totalPendingAmount)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Across {rawDues.length} pending accounts
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Filter Tabs */}
      <div className="flex items-center gap-2 bg-slate-100/90 dark:bg-slate-900/70 p-1.5 rounded-xl border border-slate-200/80 dark:border-slate-800 w-fit overflow-x-auto shadow-2xs">
        {/* All Pending */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter('ALL')
            setCurrentPage(1)
          }}
          className={cn(
            'inline-flex items-center gap-2 h-8 px-3 rounded-lg text-xs font-semibold border transition-all duration-150 select-none cursor-pointer',
            statusFilter === 'ALL'
              ? 'bg-slate-900 text-white border-slate-900 shadow-sm shadow-slate-900/25 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-white/80 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60'
          )}
        >
          <ClockAlert className={cn('w-3.5 h-3.5', statusFilter === 'ALL' ? 'text-white dark:text-slate-900' : 'text-slate-500')} />
          <span>All Pending</span>
          <span
            className={cn(
              'px-2 py-0.5 rounded-full text-[11px] font-bold min-w-[20px] text-center leading-none transition-colors',
              statusFilter === 'ALL'
                ? 'bg-white/20 text-white dark:bg-slate-800/30 dark:text-slate-900'
                : 'bg-slate-200/90 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
            )}
          >
            {rawDues.length}
          </span>
        </button>

        {/* Overdue */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter('OVERDUE')
            setCurrentPage(1)
          }}
          className={cn(
            'inline-flex items-center gap-2 h-8 px-3 rounded-lg text-xs font-semibold border transition-all duration-150 select-none cursor-pointer',
            statusFilter === 'OVERDUE'
              ? 'bg-rose-600 text-white border-rose-600 shadow-sm shadow-rose-600/30 dark:bg-rose-600 dark:border-rose-600'
              : 'border-transparent text-rose-700 hover:text-rose-800 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40'
          )}
        >
          <AlertTriangle className={cn('w-3.5 h-3.5', statusFilter === 'OVERDUE' ? 'text-white' : 'text-rose-500')} />
          <span>Overdue</span>
          <span
            className={cn(
              'px-2 py-0.5 rounded-full text-[11px] font-bold min-w-[20px] text-center leading-none transition-colors',
              statusFilter === 'OVERDUE'
                ? 'bg-white/25 text-white font-bold'
                : 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300'
            )}
          >
            {overdueList.length}
          </span>
        </button>

        {/* Due Today */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter('DUE')
            setCurrentPage(1)
          }}
          className={cn(
            'inline-flex items-center gap-2 h-8 px-3 rounded-lg text-xs font-semibold border transition-all duration-150 select-none cursor-pointer',
            statusFilter === 'DUE'
              ? 'bg-amber-600 text-white border-amber-600 shadow-sm shadow-amber-600/30 dark:bg-amber-600 dark:border-amber-600'
              : 'border-transparent text-amber-700 hover:text-amber-800 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40'
          )}
        >
          <Calendar className={cn('w-3.5 h-3.5', statusFilter === 'DUE' ? 'text-white' : 'text-amber-500')} />
          <span>Due Today</span>
          <span
            className={cn(
              'px-2 py-0.5 rounded-full text-[11px] font-bold min-w-[20px] text-center leading-none transition-colors',
              statusFilter === 'DUE'
                ? 'bg-white/25 text-white font-bold'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
            )}
          >
            {dueTodayList.length}
          </span>
        </button>

        {/* Partially Paid */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter('PARTIAL')
            setCurrentPage(1)
          }}
          className={cn(
            'inline-flex items-center gap-2 h-8 px-3 rounded-lg text-xs font-semibold border transition-all duration-150 select-none cursor-pointer',
            statusFilter === 'PARTIAL'
              ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-600/30 dark:bg-blue-600 dark:border-blue-600'
              : 'border-transparent text-blue-700 hover:text-blue-800 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40'
          )}
        >
          <TrendingDown className={cn('w-3.5 h-3.5', statusFilter === 'PARTIAL' ? 'text-white' : 'text-blue-500')} />
          <span>Partially Paid</span>
          <span
            className={cn(
              'px-2 py-0.5 rounded-full text-[11px] font-bold min-w-[20px] text-center leading-none transition-colors',
              statusFilter === 'PARTIAL'
                ? 'bg-white/25 text-white font-bold'
                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'
            )}
          >
            {partialList.length}
          </span>
        </button>

        {/* Upcoming Dues */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter('UPCOMING')
            setCurrentPage(1)
          }}
          className={cn(
            'inline-flex items-center gap-2 h-8 px-3 rounded-lg text-xs font-semibold border transition-all duration-150 select-none cursor-pointer',
            statusFilter === 'UPCOMING'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-600/30 dark:bg-emerald-600 dark:border-emerald-600'
              : 'border-transparent text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40'
          )}
        >
          <CalendarDays className={cn('w-3.5 h-3.5', statusFilter === 'UPCOMING' ? 'text-white' : 'text-emerald-500')} />
          <span>Upcoming Dues</span>
          <span
            className={cn(
              'px-2 py-0.5 rounded-full text-[11px] font-bold min-w-[20px] text-center leading-none transition-colors',
              statusFilter === 'UPCOMING'
                ? 'bg-white/25 text-white font-bold'
                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
            )}
          >
            {upcomingList.length}
          </span>
        </button>
      </div>

      {/* Advanced Filter Toolbar */}
      <div className="bg-card p-3.5 rounded-xl border shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Search Input with Clear Button */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              placeholder="Search by name, roll no, phone, standard..."
              className="pl-9 pr-8 h-9 text-xs bg-background"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setCurrentPage(1)
                }}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Academic Session Filter */}
          <div className="flex items-center gap-1.5 bg-background border rounded-md px-2.5">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <select
              value={sessionFilter}
              onChange={(e) => {
                setSessionFilter(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full h-9 bg-transparent text-xs font-medium focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Academic Sessions</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.displayName || s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Branch Filter */}
          <div className="flex items-center gap-1.5 bg-background border rounded-md px-2.5">
            <Building2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <select
              value={branchFilter}
              onChange={(e) => {
                setBranchFilter(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full h-9 bg-transparent text-xs font-medium focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Branch Locations</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Class / Standard Filter */}
          <div className="flex items-center gap-1.5 bg-background border rounded-md px-2.5">
            <Filter className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <select
              value={standardFilter}
              onChange={(e) => {
                setStandardFilter(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full h-9 bg-transparent text-xs font-medium focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Classes / Standards</option>
              {availableStandards.map((std) => (
                <option key={std} value={std}>
                  {std}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Secondary Filter Controls: Date Range Presets & Custom Range */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
          {/* Due Status Filter Dropdown */}
          <div className="flex items-center bg-background border rounded-md px-2.5">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any)
                setCurrentPage(1)
              }}
              className="w-full h-9 bg-transparent text-xs font-medium focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Statuses (Consolidated)</option>
              <option value="OVERDUE">Overdue Only</option>
              <option value="DUE">Due Today Only</option>
              <option value="PARTIAL">Partially Settled</option>
              <option value="UPCOMING">Upcoming Commitments</option>
            </select>
          </div>

          {/* Date Range Preset Selector */}
          <div className="flex items-center gap-1.5 bg-background border rounded-md px-2.5">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <select
              value={datePreset}
              onChange={(e) => {
                const val = e.target.value
                setDatePreset(val)
                if (val === 'CUSTOM') {
                  if (!startDate) setStartDate(getTodayDateString())
                  if (!endDate) setEndDate(getTodayDateString())
                }
                setCurrentPage(1)
              }}
              className="w-full h-9 bg-transparent text-xs font-medium focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Due Dates</option>
              <option value="OVERDUE">Overdue (Past Due)</option>
              <option value="TODAY">Due Today</option>
              <option value="THIS_WEEK">Due This Week</option>
              <option value="THIS_MONTH">Due This Month</option>
              <option value="CUSTOM">Custom Date Range...</option>
            </select>
          </div>

          {/* Custom Date Pickers when 'CUSTOM' preset is selected */}
          {datePreset === 'CUSTOM' ? (
            <>
              <div className="flex items-center gap-1.5 bg-background border rounded-md px-2">
                <span className="text-[11px] text-muted-foreground font-medium whitespace-nowrap">From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="w-full h-9 bg-transparent text-xs focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-1.5 bg-background border rounded-md px-2">
                <span className="text-[11px] text-muted-foreground font-medium whitespace-nowrap">To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="w-full h-9 bg-transparent text-xs focus:outline-none"
                />
              </div>
            </>
          ) : (
            <div className="hidden lg:block lg:col-span-2" />
          )}
        </div>

        {/* Tertiary Filter & Reset Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-medium">Page Size:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setCurrentPage(1)
              }}
              className="h-7 bg-background border rounded px-2 text-xs font-medium focus:outline-none cursor-pointer"
            >
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
              <option value={10000}>Show All</option>
            </select>
          </div>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetAllFilters}
              className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 gap-1 px-2"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset All Filters
            </Button>
          )}
        </div>
      </div>

      {/* Main Student Dues Table Card */}
      <Card className="shadow-sm overflow-hidden">
        <CardHeader className="py-3.5 px-4 bg-muted/20 border-b flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <span>Pending Student Dues</span>
            <Badge variant="outline" className="text-xs font-normal">
              Showing {paginatedDues.length} of {filteredAndSortedDues.length} entries
            </Badge>
          </CardTitle>
          <div className="text-xs text-muted-foreground font-mono">
            Scope: {currentBranch?.name || 'All Branches'}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Loading student fee dues register...
            </div>
          ) : filteredAndSortedDues.length === 0 ? (
            <div className="py-16 text-center border-dashed m-4 rounded-xl border">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-semibold text-emerald-600">No student dues pending in this filter view!</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {hasActiveFilters
                  ? 'No dues records match your active search and filter combinations.'
                  : 'All student fee commitments in this session and branch have been cleared.'}
              </p>
              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={resetAllFilters} className="mt-3 text-xs">
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="w-full">
                <TableHeader className="bg-[#28375C] text-white">
                  <TableRow className="border-b border-[#1b2640] hover:bg-[#28375C] bg-[#28375C]">
                    {/* Sr No Column */}
                    {visibleColumns.srNo && (
                      <TableHead className="w-12 px-3 text-center text-xs font-semibold text-white">#</TableHead>
                    )}

                    {/* Student Name Column */}
                    {visibleColumns.studentName && (
                      <TableHead
                        onClick={() => handleSort('studentName')}
                        className="cursor-pointer hover:text-white hover:bg-[#1f2c4a] transition-colors select-none min-w-[170px] text-white group"
                      >
                        <div className="flex items-center gap-1 font-semibold text-white">
                          <span>Student Name</span>
                          {renderSortIcon('studentName')}
                        </div>
                      </TableHead>
                    )}

                    {/* Roll No Column */}
                    {visibleColumns.rollNo && (
                      <TableHead
                        onClick={() => handleSort('rollNo')}
                        className="cursor-pointer hover:text-white hover:bg-[#1f2c4a] transition-colors select-none whitespace-nowrap text-white group"
                      >
                        <div className="flex items-center gap-1 text-white">
                          <span>Roll No</span>
                          {renderSortIcon('rollNo')}
                        </div>
                      </TableHead>
                    )}

                    {/* Class / Standard Column */}
                    {visibleColumns.standard && (
                      <TableHead
                        onClick={() => handleSort('standard')}
                        className="cursor-pointer hover:text-white hover:bg-[#1f2c4a] transition-colors select-none whitespace-nowrap text-white group"
                      >
                        <div className="flex items-center gap-1 text-white">
                          <span>Standard</span>
                          {renderSortIcon('standard')}
                        </div>
                      </TableHead>
                    )}

                    {/* Branch Column */}
                    {visibleColumns.branch && (
                      <TableHead
                        onClick={() => handleSort('branch')}
                        className="cursor-pointer hover:text-white hover:bg-[#1f2c4a] transition-colors select-none whitespace-nowrap text-white group"
                      >
                        <div className="flex items-center gap-1 text-white">
                          <span>Branch</span>
                          {renderSortIcon('branch')}
                        </div>
                      </TableHead>
                    )}

                    {/* Session Column */}
                    {visibleColumns.session && (
                      <TableHead
                        onClick={() => handleSort('session')}
                        className="cursor-pointer hover:text-white hover:bg-[#1f2c4a] transition-colors select-none whitespace-nowrap text-white group"
                      >
                        <div className="flex items-center gap-1 text-white">
                          <span>Session</span>
                          {renderSortIcon('session')}
                        </div>
                      </TableHead>
                    )}

                    {/* Due Date Column */}
                    {visibleColumns.dueDate && (
                      <TableHead
                        onClick={() => handleSort('dueDate')}
                        className="cursor-pointer hover:text-white hover:bg-[#1f2c4a] transition-colors select-none whitespace-nowrap text-white group"
                      >
                        <div className="flex items-center gap-1 text-white">
                          <span>Due Date</span>
                          {renderSortIcon('dueDate')}
                        </div>
                      </TableHead>
                    )}

                    {/* Parent Phone Column */}
                    {visibleColumns.parentPhone && (
                      <TableHead
                        onClick={() => handleSort('parentPhone')}
                        className="cursor-pointer hover:text-white hover:bg-[#1f2c4a] transition-colors select-none whitespace-nowrap text-white group"
                      >
                        <div className="flex items-center gap-1 text-white">
                          <span>Parent Phone</span>
                          {renderSortIcon('parentPhone')}
                        </div>
                      </TableHead>
                    )}

                    {/* Session Fee Column */}
                    {visibleColumns.amountDue && (
                      <TableHead
                        onClick={() => handleSort('amountDue')}
                        className="cursor-pointer hover:text-white hover:bg-[#1f2c4a] text-right whitespace-nowrap select-none text-white group"
                      >
                        <div className="flex items-center justify-end gap-1 text-white">
                          <span>Session Fee</span>
                          {renderSortIcon('amountDue')}
                        </div>
                      </TableHead>
                    )}

                    {/* Amount Paid Column */}
                    {visibleColumns.amountPaid && (
                      <TableHead
                        onClick={() => handleSort('amountPaid')}
                        className="cursor-pointer hover:text-white hover:bg-[#1f2c4a] text-right whitespace-nowrap select-none text-white group"
                      >
                        <div className="flex items-center justify-end gap-1 text-white">
                          <span>Amount Paid</span>
                          {renderSortIcon('amountPaid')}
                        </div>
                      </TableHead>
                    )}

                    {/* Remaining Balance Column */}
                    {visibleColumns.balanceRemaining && (
                      <TableHead
                        onClick={() => handleSort('balanceRemaining')}
                        className="cursor-pointer hover:text-white hover:bg-[#1f2c4a] text-right whitespace-nowrap select-none text-white group"
                      >
                        <div className="flex items-center justify-end gap-1 text-white">
                          <span>Remaining Balance</span>
                          {renderSortIcon('balanceRemaining')}
                        </div>
                      </TableHead>
                    )}

                    {/* Due Status Column */}
                    {visibleColumns.status && (
                      <TableHead
                        onClick={() => handleSort('status')}
                        className="cursor-pointer hover:text-white hover:bg-[#1f2c4a] text-center whitespace-nowrap select-none text-white group"
                      >
                        <div className="flex items-center justify-center gap-1 text-white">
                          <span>Status</span>
                          {renderSortIcon('status')}
                        </div>
                      </TableHead>
                    )}

                    {/* Action Column */}
                    {visibleColumns.actions && (
                      <TableHead className="text-right whitespace-nowrap pr-4 text-white font-semibold">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {paginatedDues.map((d: any, idx: number) => {
                    const rowNumber = (currentPage - 1) * pageSize + idx + 1
                    return (
                      <TableRow key={d.id} className="hover:bg-muted/40 transition-colors">
                        {/* Sr No */}
                        {visibleColumns.srNo && (
                          <TableCell className="text-center font-mono text-xs text-muted-foreground">
                            {rowNumber}
                          </TableCell>
                        )}

                        {/* Student Name */}
                        {visibleColumns.studentName && (
                          <TableCell className="font-semibold text-foreground">
                            <button
                              type="button"
                              onClick={() => navigate(`/students/${d.student.id}`)}
                              className="hover:underline text-left"
                            >
                              {d.student.fullName}
                            </button>
                            {d.student.studentCode && (
                              <div className="text-[10px] text-muted-foreground font-mono">
                                {d.student.studentCode}
                              </div>
                            )}
                          </TableCell>
                        )}

                        {/* Roll Number */}
                        {visibleColumns.rollNo && (
                          <TableCell className="font-mono text-xs font-semibold whitespace-nowrap">
                            {d.student.rollNumber || '—'}
                          </TableCell>
                        )}

                        {/* Class / Standard */}
                        {visibleColumns.standard && (
                          <TableCell className="text-xs whitespace-nowrap font-medium">
                            {d.student.standard || '—'}
                          </TableCell>
                        )}

                        {/* Branch */}
                        {visibleColumns.branch && (
                          <TableCell className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                            {d.student.branchName || '—'}
                          </TableCell>
                        )}

                        {/* Session */}
                        {visibleColumns.session && (
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap font-mono">
                            {d.student.sessionName || '—'}
                          </TableCell>
                        )}

                        {/* Due Date */}
                        {visibleColumns.dueDate && (
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {d.balanceRemaining <= 0 || !d.dueDate ? '—' : formatDateLong(d.dueDate)}
                          </TableCell>
                        )}

                        {/* Parent Phone */}
                        {visibleColumns.parentPhone && (
                          <TableCell className="font-mono text-xs whitespace-nowrap">
                            {d.student?.parentPhone || '—'}
                          </TableCell>
                        )}

                        {/* Session Fee */}
                        {visibleColumns.amountDue && (
                          <TableCell className="text-xs font-medium text-right whitespace-nowrap">
                            {formatCurrency(d.amountDue)}
                          </TableCell>
                        )}

                        {/* Amount Paid */}
                        {visibleColumns.amountPaid && (
                          <TableCell className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold text-right whitespace-nowrap">
                            {formatCurrency(d.amountPaid)}
                          </TableCell>
                        )}

                        {/* Remaining Balance */}
                        {visibleColumns.balanceRemaining && (
                          <TableCell className="text-xs font-bold text-rose-600 dark:text-rose-400 text-right whitespace-nowrap bg-rose-50/20 dark:bg-rose-950/10">
                            {formatCurrency(d.balanceRemaining)}
                          </TableCell>
                        )}

                        {/* Status */}
                        {visibleColumns.status && (
                          <TableCell className="text-center whitespace-nowrap">
                            <span
                              className={cn(
                                'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border shadow-2xs',
                                d.status === 'OVERDUE'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60'
                                  : d.status === 'DUE'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60'
                                  : d.status === 'PARTIAL'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/60'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60'
                              )}
                            >
                              {d.status === 'OVERDUE' && <AlertTriangle className="w-3 h-3 text-rose-600" />}
                              {d.status === 'DUE' && <Calendar className="w-3 h-3 text-amber-600" />}
                              {d.status === 'PARTIAL' && <TrendingDown className="w-3 h-3 text-blue-600" />}
                              {d.status === 'UPCOMING' && <CalendarDays className="w-3 h-3 text-emerald-600" />}
                              <span>{d.status}</span>
                            </span>
                          </TableCell>
                        )}

                        {/* Action Toolbar */}
                        {visibleColumns.actions && (
                          <TableCell className="text-right whitespace-nowrap pr-4">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingDueItem(d)
                                  setEditDueDateInput(toInputDateString(d.dueDate))
                                }}
                                title="Change Fee Due Date"
                                className="h-7 gap-1 text-xs border-primary/40 text-primary hover:bg-primary/10 px-2"
                              >
                                <Calendar className="w-3.5 h-3.5" />
                                <span className="hidden md:inline">Due Date</span>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleWhatsAppReminder(d)}
                                title="Send Fee Reminder via WhatsApp"
                                className="h-7 gap-1 text-xs border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 px-2"
                              >
                                <WhatsAppIcon className="w-3.5 h-3.5 text-[#25D366]" />
                                <span className="hidden md:inline">WhatsApp</span>
                              </Button>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => {
                                  const sId = d.student?.id
                                  const aId = d.admissionId || d.student?.admissionId || ''
                                  const amt = d.balanceRemaining || ''
                                  navigate(`/fees/collect?studentId=${sId}&admissionId=${aId}&amount=${amt}`)
                                }}
                                className="h-7 gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-2"
                                title={`Collect fees for ${d.student?.fullName}`}
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                                <span>Collect</span>
                              </Button>
                            </div>
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

        {/* Table Footer with Dynamic Pagination Controls */}
        <div className="p-3 bg-muted/20 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground">
          <div>
            Showing <strong className="text-foreground">{paginatedDues.length}</strong> of{' '}
            <strong className="text-foreground">{filteredAndSortedDues.length}</strong> filtered dues
          </div>

          <div className="flex items-center gap-2">
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

            <span className="text-xs font-medium px-2">
              Page {currentPage} of {totalPages}
            </span>

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
        </div>
      </Card>

      {/* Column Visibility Customization Dialog */}
      <Dialog open={isColumnModalOpen} onOpenChange={setIsColumnModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontal className="w-4 h-4 text-primary" />
              Customize Table Columns
            </DialogTitle>
          </DialogHeader>

          <div className="py-3 text-xs space-y-3">
            <p className="text-muted-foreground">
              Select which columns appear in your student fee dues table. Your column layout is automatically saved on this device.
            </p>

            <div className="grid grid-cols-2 gap-2.5 max-h-64 overflow-y-auto p-1 border rounded-lg bg-muted/30">
              {ALL_DUES_COLUMNS.map((col) => {
                const isChecked = Boolean(visibleColumns[col.id])
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
        </DialogContent>
      </Dialog>

      {/* Quick Edit Due Date Modal */}
      <Dialog open={Boolean(editingDueItem)} onOpenChange={(open) => !open && setEditingDueItem(null)}>
        <DialogContent className="max-w-md">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!editingDueItem || !editDueDateInput) return
              updateDueDateMutation.mutate({
                installmentId: editingDueItem.id,
                dueDate: editDueDateInput,
              })
            }}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Calendar className="w-4 h-4 text-primary" />
                <span>Change Fee Due Date</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4 text-xs">
              <div className="p-3 rounded-lg bg-muted/40 border space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Student:</span>
                  <span className="font-semibold text-foreground">{editingDueItem?.student?.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Roll No / Class:</span>
                  <span className="font-medium text-foreground">
                    {editingDueItem?.student?.rollNumber} • {editingDueItem?.student?.standard}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pending Balance:</span>
                  <span className="font-bold text-rose-600">
                    {formatCurrency(editingDueItem?.balanceRemaining || 0)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground block">
                  Select New Due Date *
                </label>
                <Input
                  type="date"
                  value={editDueDateInput}
                  onChange={(e) => setEditDueDateInput(e.target.value)}
                  className="h-10 text-sm font-medium"
                  required
                />
              </div>

              {/* Quick Presets */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-medium text-muted-foreground block">
                  Quick Date Presets:
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const d = new Date()
                      d.setDate(d.getDate() + 7)
                      setEditDueDateInput(toInputDateString(d))
                    }}
                    className="h-7 text-[11px] px-2.5"
                  >
                    +7 Days
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const d = new Date()
                      d.setDate(d.getDate() + 15)
                      setEditDueDateInput(toInputDateString(d))
                    }}
                    className="h-7 text-[11px] px-2.5"
                  >
                    +15 Days
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const d = new Date()
                      d.setDate(d.getDate() + 30)
                      setEditDueDateInput(toInputDateString(d))
                    }}
                    className="h-7 text-[11px] px-2.5"
                  >
                    +30 Days
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const now = new Date()
                      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
                      setEditDueDateInput(toInputDateString(lastDay))
                    }}
                    className="h-7 text-[11px] px-2.5"
                  >
                    End of Month
                  </Button>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground italic">
                When all fees are paid, this due date will automatically be blank (—) and won't trigger any overdue alerts.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingDueItem(null)}
                disabled={updateDueDateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={updateDueDateMutation.isPending}
                className="gap-1.5 bg-primary text-primary-foreground font-semibold"
              >
                <Calendar className="w-3.5 h-3.5" />
                {updateDueDateMutation.isPending ? 'Saving...' : 'Update Due Date'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
