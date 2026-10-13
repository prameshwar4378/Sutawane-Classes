import React, { useState, useMemo, useRef, useEffect } from 'react'
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
  Users,
  UserPlus,
  Search,
  CreditCard,
  Eye,
  Archive,
  User,
  Filter,
  CheckCircle2,
  Sparkles,
  FileSpreadsheet,
  FileText,
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  MessageCircle,
  Building2,
  Calendar,
  IndianRupee,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  X,
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { exportStudentsToExcel, exportStudentsToPDF } from '@/lib/exportUtils'
import { PromoteStudentModal } from '@/components/PromoteStudentModal'
import { BatchPromoteModal } from '@/components/BatchPromoteModal'

// Column Definition Schema
interface ColumnDef {
  id: string
  label: string
  alwaysVisible?: boolean
  defaultVisible: boolean
}

const ALL_COLUMNS: ColumnDef[] = [
  { id: 'select', label: 'Select Checkbox', alwaysVisible: true, defaultVisible: true },
  { id: 'photo', label: 'Photo Avatar', defaultVisible: true },
  { id: 'rollNo', label: 'Roll Number', defaultVisible: true },
  { id: 'fullName', label: 'Student Name', alwaysVisible: true, defaultVisible: true },
  { id: 'standard', label: 'Class / Course', defaultVisible: true },
  { id: 'branch', label: 'Branch Location', defaultVisible: true },
  { id: 'session', label: 'Academic Session', defaultVisible: false },
  { id: 'parentPhone', label: 'Parent Mobile', defaultVisible: true },
  { id: 'studentPhone', label: 'Student Mobile', defaultVisible: false },
  { id: 'totalFees', label: 'Session Total Fees', defaultVisible: true },
  { id: 'paidFees', label: 'Session Paid Fees', defaultVisible: true },
  { id: 'pendingFees', label: 'Session Pending Fees', defaultVisible: true },
  { id: 'overallPending', label: 'Overall Pending Dues', defaultVisible: true },
  { id: 'status', label: 'Fee Status', defaultVisible: true },
  { id: 'actions', label: 'Actions Toolbar', alwaysVisible: true, defaultVisible: true },
]

export const StudentsPage: React.FC = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { selectedBranchId, selectedSessionId, branches, sessions, currentBranch, currentSession } = useApp()

  // Modals & UI States
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<any>(null)
  const [toastMsg, setToastMsg] = useState('')

  // Promotion States
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isBatchPromoteOpen, setIsBatchPromoteOpen] = useState(false)
  const [studentToPromote, setStudentToPromote] = useState<any>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [sessionFilter, setSessionFilter] = useState<string>('CURRENT')
  const [standardFilter, setStandardFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'true' | 'false'>('true')
  const [feeStatusFilter, setFeeStatusFilter] = useState<'ALL' | 'PAID' | 'PARTIAL' | 'UNPAID' | 'HAS_DUES'>('ALL')

  // Search Suggestions State
  const [isSearchSuggestionsOpen, setIsSearchSuggestionsOpen] = useState(false)
  const [searchHighlightIndex, setSearchHighlightIndex] = useState(-1)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // Sorting
  const [sortField, setSortField] = useState<string>('fullName')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(25)

  // Column Visibility state persisted in localStorage
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('sutawane_student_columns_v2')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        // fallback
      }
    }
    const initial: Record<string, boolean> = {}
    ALL_COLUMNS.forEach((col) => {
      initial[col.id] = col.defaultVisible
    })
    return initial
  })

  // Form states for new student admission
  const [fullName, setFullName] = useState('')
  const [rollNumber, setRollNumber] = useState('')
  const [standard, setStandard] = useState('Class 10')
  const [branchId, setBranchId] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [studentPhone, setStudentPhone] = useState('')
  const [address, setAddress] = useState('')
  const [totalFees, setTotalFees] = useState('25000')
  const [formError, setFormError] = useState('')

  // Compute active sessionId for backend query
  const effectiveSessionId = useMemo(() => {
    if (sessionFilter === 'ALL') return undefined
    if (sessionFilter === 'CURRENT') return selectedSessionId || undefined
    return sessionFilter
  }, [sessionFilter, selectedSessionId])

  // Query students from backend
  const { data: rawStudents = [], isLoading } = useQuery({
    queryKey: ['students', selectedBranchId, effectiveSessionId, standardFilter, statusFilter, searchQuery],
    queryFn: () =>
      api.get('/students', {
        branchId: selectedBranchId !== 'ALL' ? selectedBranchId : undefined,
        sessionId: effectiveSessionId,
        standard: standardFilter !== 'ALL' ? standardFilter : undefined,
        isActive: statusFilter,
        search: searchQuery.trim() || undefined,
      }),
  })

  // Auto-suggestions matching query (respects current branch and session filters)
  const searchSuggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    return rawStudents
      .filter((s: any) => {
        return (
          s.fullName?.toLowerCase().includes(q) ||
          s.rollNumber?.toLowerCase().includes(q) ||
          s.parentPhone?.includes(q) ||
          (s.studentCode && s.studentCode.toLowerCase().includes(q))
        )
      })
      .slice(0, 8)
  }, [rawStudents, searchQuery])

  // Click outside to close search suggestions dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchSuggestionsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Create admission mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/students', data),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      queryClient.invalidateQueries({ queryKey: ['financial-stats'] })
      setIsDialogOpen(false)
      showToast('Student admitted successfully!')
      if (res?.student?.id) {
        navigate(`/students/${res.student.id}`)
      }
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to admit student')
    },
  })

  // Archive / status toggle mutation
  const archiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/students/${id}/status`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      queryClient.invalidateQueries({ queryKey: ['financial-stats'] })
      setArchiveTarget(null)
      showToast('Student status updated successfully!')
    },
  })

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 4000)
  }

  // Column toggle helper
  const toggleColumn = (id: string) => {
    setVisibleColumns((prev) => {
      const updated = { ...prev, [id]: !prev[id] }
      localStorage.setItem('sutawane_student_columns_v2', JSON.stringify(updated))
      return updated
    })
  }

  const showAllColumns = () => {
    const updated: Record<string, boolean> = {}
    ALL_COLUMNS.forEach((col) => {
      updated[col.id] = true
    })
    setVisibleColumns(updated)
    localStorage.setItem('sutawane_student_columns_v2', JSON.stringify(updated))
  }

  const resetDefaultColumns = () => {
    const updated: Record<string, boolean> = {}
    ALL_COLUMNS.forEach((col) => {
      updated[col.id] = col.defaultVisible
    })
    setVisibleColumns(updated)
    localStorage.setItem('sutawane_student_columns_v2', JSON.stringify(updated))
  }

  // Selection helpers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = (visibleItems: any[]) => {
    const visibleIds = visibleItems.map((s) => s.id)
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id))

    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)))
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])))
    }
  }

  // Sort toggle handler
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Filter & Sort Pipeline
  const filteredAndSortedStudents = useMemo(() => {
    let result = [...rawStudents]

    // Fee status filter
    if (feeStatusFilter !== 'ALL') {
      result = result.filter((s) => {
        if (feeStatusFilter === 'PAID') return s.pendingFees === 0 && s.totalFees > 0
        if (feeStatusFilter === 'PARTIAL') return s.paidFees > 0 && s.pendingFees > 0
        if (feeStatusFilter === 'UNPAID') return s.paidFees === 0 && s.totalFees > 0
        if (feeStatusFilter === 'HAS_DUES') {
          return (s.overallPendingAmount && s.overallPendingAmount > 0) || s.pendingFees > 0
        }
        return true
      })
    }

    // Sort
    result.sort((a, b) => {
      let valA = a[sortField]
      let valB = b[sortField]

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
  }, [rawStudents, feeStatusFilter, sortField, sortDirection])

  // Summary Metrics computed from all currently filtered records
  const metrics = useMemo(() => {
    const totalCount = filteredAndSortedStudents.length
    const totalSessionFees = filteredAndSortedStudents.reduce((sum, s) => sum + (s.totalFees || 0), 0)
    const totalSessionPaid = filteredAndSortedStudents.reduce((sum, s) => sum + (s.paidFees || 0), 0)
    const totalSessionPending = filteredAndSortedStudents.reduce((sum, s) => sum + (s.pendingFees || 0), 0)
    const totalOverallPending = filteredAndSortedStudents.reduce(
      (sum, s) => sum + (s.overallPendingAmount !== undefined ? s.overallPendingAmount : s.pendingFees || 0),
      0
    )

    return {
      totalCount,
      totalSessionFees,
      totalSessionPaid,
      totalSessionPending,
      totalOverallPending,
    }
  }, [filteredAndSortedStudents])

  // Pagination Slice
  const totalPages = Math.ceil(filteredAndSortedStudents.length / pageSize) || 1
  const paginatedStudents = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return filteredAndSortedStudents.slice(startIndex, startIndex + pageSize)
  }, [filteredAndSortedStudents, currentPage, pageSize])

  const selectedStudentsList = useMemo(() => {
    return rawStudents.filter((s: any) => selectedIds.includes(s.id))
  }, [rawStudents, selectedIds])

  // Export handlers
  const handleExportExcel = () => {
    exportStudentsToExcel(filteredAndSortedStudents, {
      branchName: currentBranch?.name,
      sessionName: currentSession?.name,
    })
    showToast(`Exported ${filteredAndSortedStudents.length} student records to Excel (.xlsx)`)
  }

  const handleExportPDF = () => {
    exportStudentsToPDF(filteredAndSortedStudents, {
      branchName: currentBranch?.name,
      sessionName: currentSession?.name,
    })
    showToast(`Generated official PDF report for ${filteredAndSortedStudents.length} students`)
  }

  // 1-Click WhatsApp Reminder
  const handleSendWhatsAppReminder = (student: any) => {
    const phone = student.parentPhone?.replace(/\D/g, '')
    if (!phone || phone.length < 10) {
      showToast('Parent mobile number is invalid or missing.')
      return
    }

    const currentPending = formatCurrency(student.pendingFees || 0)
    const overallPending = formatCurrency(student.overallPendingAmount ?? student.pendingFees ?? 0)
    const branchText = student.branchName ? ` (${student.branchName})` : ''

    const message = encodeURIComponent(
      `Dear Parent, greetings from Sutawane Classes${branchText}.\n\nThis is a friendly fee reminder for *${student.fullName}* (Roll No: *${student.rollNumber}*, Course: *${student.standard}*).\n\n- Current Session Pending: *${currentPending}*\n- Overall Total Outstanding: *${overallPending}*\n\nKindly clear the outstanding dues at the center office or via UPI at your earliest convenience. Thank you!\n— Sutawane Classes`
    )

    window.open(`https://wa.me/91${phone}?text=${message}`, '_blank')
  }

  // Form Reset and Open
  const openCreateDialog = () => {
    setFullName('')
    setRollNumber(`SC-${Math.floor(1000 + Math.random() * 9000)}`)
    setStandard('Class 10')
    setBranchId(selectedBranchId !== 'ALL' ? selectedBranchId : branches[0]?.id || '')
    setParentPhone('')
    setStudentPhone('')
    setAddress('')
    setTotalFees('25000')
    setFormError('')
    setIsDialogOpen(true)
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim() || !rollNumber.trim() || !parentPhone.trim()) {
      setFormError('Name, Roll Number, and Parent Phone are required.')
      return
    }

    if (!/^\d{10}$/.test(parentPhone.trim())) {
      setFormError('Parent phone must be a valid 10-digit number.')
      return
    }

    createMutation.mutate({
      fullName: fullName.trim(),
      rollNumber: rollNumber.trim(),
      standard: standard.trim(),
      branchId: branchId || undefined,
      sessionId: selectedSessionId || undefined,
      parentPhone: parentPhone.trim(),
      studentPhone: studentPhone.trim() || undefined,
      address: address.trim() || undefined,
      totalFees: Number(totalFees) || 0,
    })
  }

  const resetAllFilters = () => {
    setSearchQuery('')
    setStandardFilter('ALL')
    setStatusFilter('true')
    setFeeStatusFilter('ALL')
    setSessionFilter('CURRENT')
    setCurrentPage(1)
  }

  const visibleColumnsCount = Object.values(visibleColumns).filter(Boolean).length

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
            <Users className="w-6 h-6 text-primary" />
            Student Master Management
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Manage student enrollments, photographs, multi-session fee commitments, and track overall outstanding balances.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Column Visibility Toggle Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsColumnModalOpen(true)}
            className="gap-1.5 text-xs h-9"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Columns ({visibleColumnsCount}/{ALL_COLUMNS.length})</span>
          </Button>

          {/* Export to Excel Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={filteredAndSortedStudents.length === 0}
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
            disabled={filteredAndSortedStudents.length === 0}
            className="gap-1.5 text-xs h-9 border-rose-500/40 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
          >
            <FileText className="w-3.5 h-3.5 text-rose-600" />
            <span>Export PDF</span>
          </Button>

          {/* New Admission Button */}
          <Button onClick={openCreateDialog} size="sm" className="gap-2 h-9">
            <UserPlus className="w-4 h-4" />
            New Admission
          </Button>
        </div>
      </div>

      {/* Financial KPI Summary Cards Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Total Students Card */}
        <Card className="p-3 bg-card border shadow-sm">
          <div className="text-[11px] font-semibold text-muted-foreground flex items-center justify-between">
            <span>Enrolled Students</span>
            <Users className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="text-xl font-bold text-foreground mt-1">{metrics.totalCount}</div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Matching active filters</p>
        </Card>

        {/* Selected Session Total Fees Card */}
        <Card className="p-3 bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40 shadow-sm">
          <div className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 flex items-center justify-between">
            <span>Session Total Fees</span>
            <IndianRupee className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-bold text-blue-900 dark:text-blue-100 mt-1">
            {formatCurrency(metrics.totalSessionFees)}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Committed tuition value</p>
        </Card>

        {/* Selected Session Paid Fees Card */}
        <Card className="p-3 bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 shadow-sm">
          <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
            <span>Session Paid Fees</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">
            {formatCurrency(metrics.totalSessionPaid)}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Confirmed inflows</p>
        </Card>

        {/* Selected Session Pending Fees Card */}
        <Card className="p-3 bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 shadow-sm">
          <div className="text-[11px] font-semibold text-rose-700 dark:text-rose-300 flex items-center justify-between">
            <span>Session Pending Fees</span>
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="text-xl font-bold text-rose-700 dark:text-rose-400 mt-1">
            {formatCurrency(metrics.totalSessionPending)}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Current session dues</p>
        </Card>

        {/* Overall Pending Dues Card */}
        <Card className="col-span-2 sm:col-span-1 p-3 bg-amber-50/50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 shadow-sm">
          <div className="text-[11px] font-bold text-amber-800 dark:text-amber-300 flex items-center justify-between">
            <span>Overall Pending Amount</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-xl font-extrabold text-amber-800 dark:text-amber-200 mt-1">
            {formatCurrency(metrics.totalOverallPending)}
          </div>
          <p className="text-[10px] text-amber-700/80 dark:text-amber-400/80 mt-0.5 font-medium">
            All sessions + prior dues
          </p>
        </Card>
      </div>

      {/* Advanced Filter Toolbar */}
      <div className="bg-card p-3.5 rounded-xl border shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {/* Search Input with Auto-Suggestions Popup */}
          <div ref={searchContainerRef} className="relative sm:col-span-2 lg:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setIsSearchSuggestionsOpen(true)
                setCurrentPage(1)
              }}
              onFocus={() => {
                if (searchQuery.trim()) setIsSearchSuggestionsOpen(true)
              }}
              onKeyDown={(e) => {
                if (!isSearchSuggestionsOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                  setIsSearchSuggestionsOpen(true)
                  return
                }
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setSearchHighlightIndex((prev) => (prev < searchSuggestions.length - 1 ? prev + 1 : 0))
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setSearchHighlightIndex((prev) => (prev > 0 ? prev - 1 : searchSuggestions.length - 1))
                } else if (e.key === 'Enter') {
                  if (searchHighlightIndex >= 0 && searchHighlightIndex < searchSuggestions.length) {
                    e.preventDefault()
                    setSearchQuery(searchSuggestions[searchHighlightIndex].fullName)
                    setIsSearchSuggestionsOpen(false)
                  }
                } else if (e.key === 'Escape') {
                  setIsSearchSuggestionsOpen(false)
                }
              }}
              placeholder={`Search by name, roll no, phone in ${selectedBranchId === 'ALL' ? 'All Branches' : currentBranch?.name || 'branch'}...`}
              className="pl-9 pr-8 h-9 text-xs bg-background"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setIsSearchSuggestionsOpen(false)
                }}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Auto-Suggestions Popup */}
            {isSearchSuggestionsOpen && searchQuery.trim() && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-popover text-popover-foreground border rounded-lg shadow-xl overflow-hidden max-h-72 overflow-y-auto divide-y divide-border animate-in fade-in slide-in-from-top-1">
                <div className="p-1.5 bg-muted/40 text-[10px] font-semibold text-muted-foreground flex items-center justify-between px-3">
                  <span>
                    Matching Students in {selectedBranchId === 'ALL' ? 'All Branches' : currentBranch?.name || 'Branch'} ({searchSuggestions.length})
                  </span>
                  <span className="text-[10px]">Click to filter table or jump to actions</span>
                </div>

                {searchSuggestions.length === 0 ? (
                  <div className="p-3 text-center text-xs text-muted-foreground">
                    No students matching "{searchQuery}" in {selectedBranchId === 'ALL' ? 'All Branches' : currentBranch?.name || 'selected branch'}.
                  </div>
                ) : (
                  searchSuggestions.map((s: any, idx: number) => {
                    const isHighlighted = idx === searchHighlightIndex
                    const overallDue = s.overallPendingAmount !== undefined ? s.overallPendingAmount : s.pendingFees || 0
                    return (
                      <div
                        key={s.id}
                        className={`p-2 px-3 flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer ${
                          isHighlighted ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50'
                        }`}
                        onMouseEnter={() => setSearchHighlightIndex(idx)}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          setSearchQuery(s.fullName)
                          setIsSearchSuggestionsOpen(false)
                        }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-full overflow-hidden bg-muted flex items-center justify-center border text-[9px] flex-shrink-0">
                            {s.photoUrl ? (
                              <img src={s.photoUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-3 h-3 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold truncate text-foreground flex items-center gap-1.5">
                              <span>{s.fullName}</span>
                              <span className="font-mono text-[10px] text-muted-foreground">({s.rollNumber})</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                              <span>{s.standard}</span>
                              {selectedBranchId === 'ALL' && (
                                <>
                                  <span>•</span>
                                  <span className="text-primary font-medium">{s.branchName}</span>
                                </>
                              )}
                              <span>•</span>
                              <span className="font-mono">Ph: {s.parentPhone}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {overallDue > 0 ? (
                            <Badge variant="danger" className="text-[10px] py-0 px-1.5 font-semibold">
                              Due: {formatCurrency(overallDue)}
                            </Badge>
                          ) : (
                            <Badge variant="success" className="text-[10px] py-0 px-1.5 font-semibold">
                              Cleared
                            </Badge>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onMouseDown={(e) => {
                              e.stopPropagation()
                              navigate(`/students/${s.id}`)
                            }}
                            className="h-6 px-1.5 text-[10px] gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            Profile
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onMouseDown={(e) => {
                              e.stopPropagation()
                              navigate('/fees/collect')
                            }}
                            className="h-6 px-1.5 text-[10px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            <CreditCard className="w-3 h-3" />
                            Fee
                          </Button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
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
              <option value="CURRENT">Active Session ({currentSession?.name || 'Selected'})</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.displayName || s.name}
                </option>
              ))}
              <option value="ALL">All Academic Sessions Consolidated</option>
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
              <option value="Class 8">Class 8</option>
              <option value="Class 9">Class 9</option>
              <option value="Class 10">Class 10</option>
              <option value="Class 11 Science">Class 11 Science</option>
              <option value="Class 12 Science">Class 12 Science</option>
              <option value="Class 11 Commerce">Class 11 Commerce</option>
              <option value="Class 12 Commerce">Class 12 Commerce</option>
              <option value="MHT-CET / JEE Foundation">MHT-CET / JEE</option>
            </select>
          </div>

          {/* Fee Payment Status Filter */}
          <div className="flex items-center bg-background border rounded-md px-2.5">
            <select
              value={feeStatusFilter}
              onChange={(e) => {
                setFeeStatusFilter(e.target.value as any)
                setCurrentPage(1)
              }}
              className="w-full h-9 bg-transparent text-xs font-medium focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Fee Statuses</option>
              <option value="PAID">Fully Settled (Zero Dues)</option>
              <option value="PARTIAL">Partially Paid</option>
              <option value="UNPAID">Unpaid (Zero Paid)</option>
              <option value="HAS_DUES">Has Outstanding Dues (&gt; ₹0)</option>
            </select>
          </div>
        </div>

        {/* Secondary Filter & Reset Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-medium">Record Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any)
                setCurrentPage(1)
              }}
              className="h-7 bg-background border rounded px-2 text-xs font-medium focus:outline-none"
            >
              <option value="true">Active Students Only</option>
              <option value="false">Archived / Inactive Only</option>
              <option value="ALL">All (Active &amp; Archived)</option>
            </select>

            <span className="text-muted-foreground font-medium ml-3">Page Size:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setCurrentPage(1)
              }}
              className="h-7 bg-background border rounded px-2 text-xs font-medium focus:outline-none"
            >
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
              <option value={1000}>Show All</option>
            </select>
          </div>

          {(searchQuery || standardFilter !== 'ALL' || feeStatusFilter !== 'ALL' || statusFilter !== 'true' || sessionFilter !== 'CURRENT') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetAllFilters}
              className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 gap-1 px-2"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset All Filters
            </Button>
          )}
        </div>
      </div>

      {/* Batch Actions Bar (Shows when checkboxes are selected) */}
      {selectedIds.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl animate-in fade-in">
          <div className="flex items-center gap-2">
            <Badge variant="warning" className="px-2.5 py-1 text-xs font-bold">
              {selectedIds.length} Selected
            </Badge>
            <span className="text-xs font-semibold text-foreground">
              students selected for batch promotion or bulk operations
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setIsBatchPromoteOpen(true)}
              className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-sm h-8"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Batch Promote ({selectedIds.length}) to Next Session
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedIds([])}
              className="text-xs h-8"
            >
              Deselect All
            </Button>
          </div>
        </div>
      )}

      {/* Main Student Records Table Card */}
      <Card className="shadow-sm overflow-hidden">
        <CardHeader className="py-3.5 px-4 bg-muted/20 border-b flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <span>Students Master Directory</span>
            <Badge variant="outline" className="text-xs font-normal">
              Showing {paginatedStudents.length} of {filteredAndSortedStudents.length} entries
            </Badge>
          </CardTitle>
          <div className="text-xs text-muted-foreground font-mono">
            Scope: {currentBranch?.name || 'All Branches'}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Loading student directory and financial ledgers...
            </div>
          ) : filteredAndSortedStudents.length === 0 ? (
            <div className="py-16 text-center border-dashed m-4 rounded-xl border">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
              <p className="text-sm font-semibold text-foreground">No matching students found</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {searchQuery || standardFilter !== 'ALL' || feeStatusFilter !== 'ALL'
                  ? 'No records match your active search and filter combinations.'
                  : 'Start by clicking "New Admission" above to enroll your first student.'}
              </p>
              {(searchQuery || standardFilter !== 'ALL' || feeStatusFilter !== 'ALL') && (
                <Button variant="outline" size="sm" onClick={resetAllFilters} className="mt-3 text-xs">
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="w-full">
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    {/* Select Checkbox Column */}
                    {visibleColumns.select && (
                      <TableHead className="w-10 px-3">
                        <input
                          type="checkbox"
                          checked={
                            paginatedStudents.length > 0 &&
                            paginatedStudents.every((s) => selectedIds.includes(s.id))
                          }
                          onChange={() => toggleSelectAll(paginatedStudents)}
                          className="w-4 h-4 rounded text-primary border-gray-300 focus:ring-primary cursor-pointer"
                          title="Select / Deselect All Visible On This Page"
                        />
                      </TableHead>
                    )}

                    {/* Photo Column */}
                    {visibleColumns.photo && <TableHead className="w-12 px-2 text-center">Photo</TableHead>}

                    {/* Roll No Column */}
                    {visibleColumns.rollNo && (
                      <TableHead
                        onClick={() => handleSort('rollNumber')}
                        className="cursor-pointer hover:text-foreground transition-colors select-none whitespace-nowrap"
                      >
                        <div className="flex items-center gap-1">
                          <span>Roll No.</span>
                          {sortField === 'rollNumber' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-40" />
                          )}
                        </div>
                      </TableHead>
                    )}

                    {/* Student Name Column */}
                    {visibleColumns.fullName && (
                      <TableHead
                        onClick={() => handleSort('fullName')}
                        className="cursor-pointer hover:text-foreground transition-colors select-none min-w-[160px]"
                      >
                        <div className="flex items-center gap-1 font-semibold text-foreground">
                          <span>Student Name</span>
                          {sortField === 'fullName' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-40" />
                          )}
                        </div>
                      </TableHead>
                    )}

                    {/* Standard / Class Column */}
                    {visibleColumns.standard && (
                      <TableHead
                        onClick={() => handleSort('standard')}
                        className="cursor-pointer hover:text-foreground transition-colors select-none whitespace-nowrap"
                      >
                        <div className="flex items-center gap-1">
                          <span>Standard</span>
                          {sortField === 'standard' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-40" />
                          )}
                        </div>
                      </TableHead>
                    )}

                    {/* Branch Column */}
                    {visibleColumns.branch && <TableHead className="whitespace-nowrap">Branch</TableHead>}

                    {/* Academic Session Column */}
                    {visibleColumns.session && <TableHead className="whitespace-nowrap">Session</TableHead>}

                    {/* Parent Phone Column */}
                    {visibleColumns.parentPhone && <TableHead className="whitespace-nowrap">Parent Phone</TableHead>}

                    {/* Student Phone Column */}
                    {visibleColumns.studentPhone && <TableHead className="whitespace-nowrap">Student Phone</TableHead>}

                    {/* Selected Session Total Fees Column */}
                    {visibleColumns.totalFees && (
                      <TableHead
                        onClick={() => handleSort('totalFees')}
                        className="cursor-pointer hover:text-foreground text-right whitespace-nowrap select-none"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Session Total Fees</span>
                          {sortField === 'totalFees' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-40" />
                          )}
                        </div>
                      </TableHead>
                    )}

                    {/* Selected Session Paid Fees Column */}
                    {visibleColumns.paidFees && (
                      <TableHead
                        onClick={() => handleSort('paidFees')}
                        className="cursor-pointer hover:text-foreground text-right whitespace-nowrap select-none"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Session Paid</span>
                          {sortField === 'paidFees' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-40" />
                          )}
                        </div>
                      </TableHead>
                    )}

                    {/* Selected Session Pending Fees Column */}
                    {visibleColumns.pendingFees && (
                      <TableHead
                        onClick={() => handleSort('pendingFees')}
                        className="cursor-pointer hover:text-foreground text-right whitespace-nowrap select-none"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Session Pending</span>
                          {sortField === 'pendingFees' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-40" />
                          )}
                        </div>
                      </TableHead>
                    )}

                    {/* Overall Session Pending Amount Column */}
                    {visibleColumns.overallPending && (
                      <TableHead
                        onClick={() => handleSort('overallPendingAmount')}
                        className="cursor-pointer hover:text-foreground text-right whitespace-nowrap select-none bg-amber-500/5 font-bold"
                      >
                        <div className="flex items-center justify-end gap-1 text-amber-800 dark:text-amber-300">
                          <span>Overall Pending Amount</span>
                          {sortField === 'overallPendingAmount' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-600" /> : <ArrowDown className="w-3 h-3 text-amber-600" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-40" />
                          )}
                        </div>
                      </TableHead>
                    )}

                    {/* Fee Status Column */}
                    {visibleColumns.status && <TableHead className="whitespace-nowrap text-center">Status</TableHead>}

                    {/* Actions Column */}
                    {visibleColumns.actions && <TableHead className="text-right pr-4 min-w-[210px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {paginatedStudents.map((s: any) => {
                    const isSelected = selectedIds.includes(s.id)
                    const overallPending = s.overallPendingAmount !== undefined ? s.overallPendingAmount : s.pendingFees || 0
                    const hasPriorDues = s.previousDuesPending && s.previousDuesPending > 0

                    return (
                      <TableRow
                        key={s.id}
                        className={`hover:bg-muted/40 transition-colors ${
                          isSelected ? 'bg-amber-500/10' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        {visibleColumns.select && (
                          <TableCell className="px-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(s.id)}
                              className="w-4 h-4 rounded text-primary border-gray-300 focus:ring-primary cursor-pointer"
                            />
                          </TableCell>
                        )}

                        {/* Photo Thumbnail */}
                        {visibleColumns.photo && (
                          <TableCell className="px-2 text-center">
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-muted flex items-center justify-center border text-xs mx-auto">
                              {s.photoUrl ? (
                                <img
                                  src={s.photoUrl}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <User className="w-4 h-4 text-muted-foreground" />
                              )}
                            </div>
                          </TableCell>
                        )}

                        {/* Roll Number */}
                        {visibleColumns.rollNo && (
                          <TableCell className="font-mono text-xs font-semibold whitespace-nowrap">
                            {s.rollNumber}
                          </TableCell>
                        )}

                        {/* Student Name */}
                        {visibleColumns.fullName && (
                          <TableCell className="font-semibold text-foreground">
                            <button
                              type="button"
                              onClick={() => navigate(`/students/${s.id}`)}
                              className="hover:underline text-left"
                            >
                              {s.fullName}
                            </button>
                            {s.studentCode && (
                              <div className="text-[10px] text-muted-foreground font-mono">
                                {s.studentCode}
                              </div>
                            )}
                          </TableCell>
                        )}

                        {/* Standard */}
                        {visibleColumns.standard && (
                          <TableCell className="text-xs whitespace-nowrap font-medium">
                            {s.standard}
                          </TableCell>
                        )}

                        {/* Branch */}
                        {visibleColumns.branch && (
                          <TableCell className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                            {s.branchName}
                          </TableCell>
                        )}

                        {/* Session */}
                        {visibleColumns.session && (
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap font-mono">
                            {s.sessionName}
                          </TableCell>
                        )}

                        {/* Parent Phone */}
                        {visibleColumns.parentPhone && (
                          <TableCell className="font-mono text-xs whitespace-nowrap">
                            {s.parentPhone}
                          </TableCell>
                        )}

                        {/* Student Phone */}
                        {visibleColumns.studentPhone && (
                          <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                            {s.studentPhone || '—'}
                          </TableCell>
                        )}

                        {/* Selected Session Total Fees */}
                        {visibleColumns.totalFees && (
                          <TableCell className="font-medium text-right text-xs whitespace-nowrap">
                            {formatCurrency(s.totalFees)}
                          </TableCell>
                        )}

                        {/* Selected Session Paid Fees */}
                        {visibleColumns.paidFees && (
                          <TableCell className="text-right text-xs font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                            {formatCurrency(s.paidFees)}
                          </TableCell>
                        )}

                        {/* Selected Session Pending Fees */}
                        {visibleColumns.pendingFees && (
                          <TableCell className="text-right text-xs font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                            {formatCurrency(s.pendingFees || 0)}
                          </TableCell>
                        )}

                        {/* Overall Pending Amount */}
                        {visibleColumns.overallPending && (
                          <TableCell className="text-right text-xs bg-amber-500/5 whitespace-nowrap">
                            <div className="font-extrabold text-amber-800 dark:text-amber-200">
                              {formatCurrency(overallPending)}
                            </div>
                            {hasPriorDues && (
                              <div className="text-[10px] text-rose-600 font-medium">
                                (Incl. {formatCurrency(s.previousDuesPending)} prior)
                              </div>
                            )}
                          </TableCell>
                        )}

                        {/* Status */}
                        {visibleColumns.status && (
                          <TableCell className="text-center whitespace-nowrap">
                            <Badge
                              variant={
                                !s.isActive
                                  ? 'outline'
                                  : s.pendingFees === 0
                                  ? 'success'
                                  : s.paidFees > 0
                                  ? 'warning'
                                  : 'danger'
                              }
                            >
                              {!s.isActive
                                ? 'Archived'
                                : s.pendingFees === 0
                                ? 'Settled'
                                : s.paidFees > 0
                                ? 'Partial'
                                : 'Unpaid'}
                            </Badge>
                          </TableCell>
                        )}

                        {/* Actions Toolbar */}
                        {visibleColumns.actions && (
                          <TableCell className="text-right pr-4 whitespace-nowrap space-x-1">
                            {/* 1-Click WhatsApp Reminder Button */}
                            {s.parentPhone && (overallPending > 0 || s.pendingFees > 0) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSendWhatsAppReminder(s)}
                                className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-500/40"
                                title="Send Fee Due Reminder via WhatsApp"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </Button>
                            )}

                            {/* Promote Button */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setStudentToPromote(s)}
                              className="h-7 px-2 text-xs border-amber-500/60 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                              title="Promote to Next Academic Session"
                            >
                              <Sparkles className="w-3 h-3 mr-1 text-amber-500" />
                              Promote
                            </Button>

                            {/* Profile View */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/students/${s.id}`)}
                              className="h-7 px-2 text-xs"
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              Profile
                            </Button>

                            {/* Collect Fees */}
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => navigate('/fees/collect')}
                              className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              <CreditCard className="w-3 h-3 mr-1" />
                              Fee
                            </Button>

                            {/* Archive toggle */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setArchiveTarget(s)}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                              title={s.isActive ? 'Archive Student' : 'Reactivate Student'}
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </Button>
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
        <div className="p-3 bg-muted/20 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground">
          <div>
            Showing <strong className="text-foreground">{paginatedStudents.length}</strong> of{' '}
            <strong className="text-foreground">{filteredAndSortedStudents.length}</strong> filtered records
            {selectedIds.length > 0 && ` (${selectedIds.length} currently selected)`}
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
              Select which columns appear in your student management table. Your layout preferences are automatically saved on this device.
            </p>

            <div className="grid grid-cols-2 gap-2.5 max-h-64 overflow-y-auto p-1 border rounded-lg bg-muted/30">
              {ALL_COLUMNS.map((col) => {
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

          <DialogFooter>
            <Button size="sm" onClick={() => setIsColumnModalOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Student Admission Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>Student Admission Form</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4 text-xs">
              {formError && (
                <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
                  {formError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Student Full Name *</label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Rahul S. Sharma"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Roll Number *</label>
                  <Input
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Class / Course *</label>
                  <select
                    value={standard}
                    onChange={(e) => setStandard(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none"
                  >
                    <option value="Class 8">Class 8</option>
                    <option value="Class 9">Class 9</option>
                    <option value="Class 10">Class 10</option>
                    <option value="Class 11 Science">Class 11 Science</option>
                    <option value="Class 12 Science">Class 12 Science</option>
                    <option value="Class 11 Commerce">Class 11 Commerce</option>
                    <option value="Class 12 Commerce">Class 12 Commerce</option>
                    <option value="MHT-CET / JEE Foundation">MHT-CET / JEE</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Parent Phone *</label>
                  <Input
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value)}
                    placeholder="10-digit mobile"
                    maxLength={10}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Student Phone</label>
                  <Input
                    value={studentPhone}
                    onChange={(e) => setStudentPhone(e.target.value)}
                    placeholder="10-digit mobile"
                    maxLength={10}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Branch Location *</label>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold flex items-center justify-between">
                  <span>Agreed Total Fees (₹) *</span>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    3 installments generated (40% / 30% / 30%)
                  </span>
                </label>
                <Input
                  type="number"
                  value={totalFees}
                  onChange={(e) => setTotalFees(e.target.value)}
                  min={0}
                  step={500}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Address</label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Residential address"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Saving...' : 'Complete Admission'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Archive / Reactivate Confirmation Dialog */}
      <AlertDialog open={Boolean(archiveTarget)} onOpenChange={() => setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {archiveTarget?.isActive ? 'Archive Student?' : 'Reactivate Student?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {archiveTarget?.isActive
                ? `Archiving ${archiveTarget?.fullName} will safely remove them from the active batch list. All historical financial ledgers, receipts, and installments will be permanently preserved.`
                : `Reactivating ${archiveTarget?.fullName} will restore them to active status in this academic session.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                archiveMutation.mutate({
                  id: archiveTarget.id,
                  isActive: !archiveTarget.isActive,
                })
              }
              className={archiveTarget?.isActive ? 'bg-destructive text-destructive-foreground' : 'bg-primary'}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Single Student Promotion Modal */}
      {studentToPromote && (
        <PromoteStudentModal
          isOpen={Boolean(studentToPromote)}
          onClose={() => setStudentToPromote(null)}
          studentId={studentToPromote.id}
          studentName={studentToPromote.fullName}
          currentAdmission={{
            id: studentToPromote.admissionId,
            rollNumber: studentToPromote.rollNumber,
            standard: studentToPromote.standard,
            branch: {
              id: studentToPromote.branchId,
              name: studentToPromote.branchName,
              code: studentToPromote.branchCode,
            },
            session: {
              id: studentToPromote.sessionId,
              name: studentToPromote.sessionName,
            },
          }}
          onSuccess={(msg) => {
            showToast(msg)
            queryClient.invalidateQueries({ queryKey: ['students'] })
          }}
        />
      )}

      {/* Batch Promotion Modal */}
      <BatchPromoteModal
        isOpen={isBatchPromoteOpen}
        onClose={() => setIsBatchPromoteOpen(false)}
        selectedStudents={selectedStudentsList}
        onSuccess={(msg) => {
          showToast(msg)
          setSelectedIds([])
          queryClient.invalidateQueries({ queryKey: ['students'] })
        }}
      />
    </div>
  )
}
