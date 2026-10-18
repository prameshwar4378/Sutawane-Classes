import React, { useState, useRef, useMemo, useEffect } from 'react'
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
  Receipt,
  Plus,
  Search,
  Filter,
  FileText,
  FileSpreadsheet,
  Paperclip,
  Trash2,
  Edit2,
  CheckCircle2,
  Eye,
  IndianRupee,
  Calendar,
  Building2,
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  Sparkles,
  Smartphone,
  X,
  CreditCard,
} from 'lucide-react'
import { formatCurrency, formatDate, formatDateLong, getTodayDateString, toInputDateString } from '@/lib/utils'
import { exportExpensesToExcel, exportExpensesToPDF, type ExpenseExportItem } from '@/lib/exportUtils'
import { ExpenseCategoryCombobox } from '@/components/ExpenseCategoryCombobox'

// Column Definition Schema
interface ColumnDef {
  id: string
  label: string
  alwaysVisible?: boolean
  defaultVisible: boolean
}

const ALL_EXPENSE_COLUMNS: ColumnDef[] = [
  { id: 'srNo', label: '# / Sr No', defaultVisible: true },
  { id: 'expenseDate', label: 'Voucher Date', defaultVisible: true },
  { id: 'category', label: 'Category', defaultVisible: true },
  { id: 'description', label: 'Description', alwaysVisible: true, defaultVisible: true },
  { id: 'branch', label: 'Branch Location', defaultVisible: true },
  { id: 'vendor', label: 'Vendor / Payee', defaultVisible: true },
  { id: 'paymentMode', label: 'Payment Mode', defaultVisible: true },
  { id: 'referenceNumber', label: 'Reference / Bill No', defaultVisible: true },
  { id: 'attachment', label: 'Bill Scan Document', defaultVisible: true },
  { id: 'amount', label: 'Expense Amount (₹)', alwaysVisible: true, defaultVisible: true },
  { id: 'actions', label: 'Actions Toolbar', alwaysVisible: true, defaultVisible: true },
]

export const ExpensesPage: React.FC = () => {
  const queryClient = useQueryClient()
  const { selectedBranchId, branches, currentBranch, settings, activeLogoUrl } = useApp()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Column Visibility state persisted in localStorage
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('sutawane_expenses_columns_v1')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        // fallback
      }
    }
    const initial: Record<string, boolean> = {}
    ALL_EXPENSE_COLUMNS.forEach((col) => {
      initial[col.id] = col.defaultVisible
    })
    return initial
  })

  const toggleColumn = (id: string) => {
    setVisibleColumns((prev) => {
      const updated = { ...prev, [id]: !prev[id] }
      localStorage.setItem('sutawane_expenses_columns_v1', JSON.stringify(updated))
      return updated
    })
  }

  const showAllColumns = () => {
    const updated: Record<string, boolean> = {}
    ALL_EXPENSE_COLUMNS.forEach((col) => {
      updated[col.id] = true
    })
    setVisibleColumns(updated)
    localStorage.setItem('sutawane_expenses_columns_v1', JSON.stringify(updated))
  }

  const resetDefaultColumns = () => {
    const updated: Record<string, boolean> = {}
    ALL_EXPENSE_COLUMNS.forEach((col) => {
      updated[col.id] = col.defaultVisible
    })
    setVisibleColumns(updated)
    localStorage.setItem('sutawane_expenses_columns_v1', JSON.stringify(updated))
  }

  const visibleColumnsCount = Object.values(visibleColumns).filter(Boolean).length

  // Filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [paymentModeFilter, setPaymentModeFilter] = useState('ALL')
  const [branchFilter, setBranchFilter] = useState<string>(() => selectedBranchId || 'ALL')
  const [datePreset, setDatePreset] = useState('ALL')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Sync with global header branch changes
  useEffect(() => {
    if (selectedBranchId) {
      setBranchFilter(selectedBranchId)
    }
  }, [selectedBranchId])

  // Sorting state
  const [sortField, setSortField] = useState('expenseDate')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(25)

  // Dialog & Modal states
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<any>(null)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [selectedAttachment, setSelectedAttachment] = useState<any>(null)
  const [toastMsg, setToastMsg] = useState('')
  const [formError, setFormError] = useState('')

  // Form states
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [categoryName, setCategoryName] = useState('')
  const [formBranchId, setFormBranchId] = useState('')
  const [paymentMode, setPaymentMode] = useState('UPI')
  const [vendor, setVendor] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [expenseDate, setExpenseDate] = useState(() => getTodayDateString())
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)

  // 1. Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: () => api.get('/expenses/categories'),
  })

  // 2. Fetch expenses list dynamically based on active in-page branch filter
  const { data: rawExpenses = [], isLoading } = useQuery<ExpenseExportItem[]>({
    queryKey: ['expenses-list-all', branchFilter],
    queryFn: () =>
      api.get('/expenses', {
        branchId: branchFilter !== 'ALL' ? branchFilter : undefined,
      }),
  })

  // Toast handler
  const showToast = (msg: string, _isErr = false) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 4500)
  }

  // Create / Edit mutation
  const saveExpenseMutation = useMutation({
    mutationFn: async (data: any) => {
      const formData = new FormData()
      formData.append('description', data.description)
      formData.append('amount', String(data.amount))
      if (data.categoryId) formData.append('categoryId', data.categoryId)
      if (data.categoryName) formData.append('categoryName', data.categoryName)
      formData.append('branchId', data.branchId)
      formData.append('paymentMode', data.paymentMode)
      formData.append('expenseDate', data.expenseDate)
      if (data.vendor) formData.append('vendor', data.vendor)
      if (data.referenceNumber) formData.append('referenceNumber', data.referenceNumber)
      if (data.attachment) formData.append('attachment', data.attachment)

      if (editingExpense) {
        return api.put(`/expenses/${editingExpense.id}`, data)
      } else {
        return api.post('/expenses', formData)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses-list-all'] })
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] })
      queryClient.invalidateQueries({ queryKey: ['daily-report'] })
      closeDialog()
      showToast(editingExpense ? 'Expense updated successfully!' : 'Expense voucher recorded successfully!')
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to save expense')
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses-list-all'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] })
      queryClient.invalidateQueries({ queryKey: ['daily-report'] })
      setDeleteTarget(null)
      showToast('Expense voucher permanently deleted.')
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to delete expense', true)
    },
  })

  const openCreateDialog = () => {
    setEditingExpense(null)
    setDescription('')
    setAmount('')
    setCategoryId(categories[0]?.id || '')
    setCategoryName(categories[0]?.name || '')
    setFormBranchId(selectedBranchId !== 'ALL' ? selectedBranchId : branches[0]?.id || '')
    setPaymentMode('UPI')
    setVendor('')
    setReferenceNumber('')
    setExpenseDate(getTodayDateString())
    setAttachmentFile(null)
    setFormError('')
    setIsDialogOpen(true)
  }

  const openEditDialog = (exp: any) => {
    setEditingExpense(exp)
    setDescription(exp.description)
    setAmount(String(exp.amount))
    setCategoryId(exp.categoryId || exp.category?.id || '')
    setCategoryName(exp.category?.name || '')
    setFormBranchId(exp.branchId || exp.branch?.id || '')
    setPaymentMode(exp.paymentMode)
    setVendor(exp.vendor || '')
    setReferenceNumber(exp.referenceNumber || '')
    setExpenseDate(toInputDateString(exp.expenseDate))
    setAttachmentFile(null)
    setFormError('')
    setIsDialogOpen(true)
  }

  const closeDialog = () => {
    setIsDialogOpen(false)
    setEditingExpense(null)
    setAttachmentFile(null)
    setFormError('')
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    const numAmount = Number(amount)
    if (!description.trim() || !numAmount || numAmount <= 0) {
      setFormError('Valid description and positive amount are required')
      return
    }

    if (!categoryId && !categoryName.trim()) {
      setFormError('Please select or type an expense category')
      return
    }

    saveExpenseMutation.mutate({
      description: description.trim(),
      amount: numAmount,
      categoryId: categoryId || undefined,
      categoryName: categoryName.trim() || undefined,
      branchId: formBranchId || branches[0]?.id,
      paymentMode,
      vendor: vendor.trim() || null,
      referenceNumber: referenceNumber.trim() || null,
      expenseDate,
      attachment: attachmentFile || undefined,
    })
  }

  // Date preset helper
  const isDateInPreset = (dateStr: string, preset: string, start?: string, end?: string): boolean => {
    if (!dateStr) return true
    if (preset === 'ALL') return true

    const targetDate = toInputDateString(dateStr)
    const today = getTodayDateString()

    if (preset === 'TODAY') {
      return targetDate === today
    }
    if (preset === 'YESTERDAY') {
      const y = new Date()
      y.setDate(y.getDate() - 1)
      return targetDate === getTodayDateString(y)
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
    if (preset === 'LAST_MONTH') {
      const now = new Date()
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
      return targetDate >= getTodayDateString(lastMonthStart) && targetDate <= getTodayDateString(lastMonthEnd)
    }
    if (preset === 'THIS_YEAR') {
      const now = new Date()
      const yearStart = new Date(now.getFullYear(), 0, 1)
      const yearEnd = new Date(now.getFullYear(), 11, 31)
      return targetDate >= getTodayDateString(yearStart) && targetDate <= getTodayDateString(yearEnd)
    }
    if (preset === 'CUSTOM') {
      if (start && targetDate < start) return false
      if (end && targetDate > end) return false
      return true
    }
    return true
  }

  // Filter & Sort Pipeline
  const filteredAndSortedExpenses = useMemo(() => {
    let result = [...rawExpenses]

    // Category Filter
    if (categoryFilter !== 'ALL') {
      result = result.filter((e) => {
        return (
          e.categoryId === categoryFilter ||
          e.category?.id === categoryFilter ||
          e.category?.name?.toLowerCase() === categoryFilter.toLowerCase()
        )
      })
    }

    // Payment Mode Filter
    if (paymentModeFilter !== 'ALL') {
      result = result.filter((e) => e.paymentMode === paymentModeFilter)
    }

    // Branch Filter
    if (branchFilter !== 'ALL') {
      result = result.filter((e: any) => {
        return (
          e.branchId === branchFilter ||
          e.branch?.id === branchFilter ||
          e.branch?.name?.toLowerCase() === branchFilter.toLowerCase()
        )
      })
    }

    // Date Preset Filter
    if (datePreset !== 'ALL') {
      result = result.filter((e) => isDateInPreset(e.expenseDate, datePreset, startDate, endDate))
    }

    // Multi-token Search Query
    if (searchQuery.trim()) {
      const tokens = searchQuery.toLowerCase().trim().split(/\s+/)
      result = result.filter((e) => {
        const targetString = [
          e.description || '',
          e.vendor || '',
          e.referenceNumber || '',
          e.category?.name || '',
          e.branch?.name || '',
          e.paymentMode || '',
        ].join(' ').toLowerCase()

        return tokens.every((token) => targetString.includes(token))
      })
    }

    // Sorting
    result.sort((a: any, b: any) => {
      let valA: any
      let valB: any

      switch (sortField) {
        case 'expenseDate':
          valA = new Date(a.expenseDate).getTime()
          valB = new Date(b.expenseDate).getTime()
          break
        case 'category':
          valA = a.category?.name || ''
          valB = b.category?.name || ''
          break
        case 'description':
          valA = a.description || ''
          valB = b.description || ''
          break
        case 'branch':
          valA = a.branch?.name || ''
          valB = b.branch?.name || ''
          break
        case 'vendor':
          valA = a.vendor || ''
          valB = b.vendor || ''
          break
        case 'paymentMode':
          valA = a.paymentMode || ''
          valB = b.paymentMode || ''
          break
        case 'referenceNumber':
          valA = a.referenceNumber || ''
          valB = b.referenceNumber || ''
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
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
      }

      const numA = Number(valA) || 0
      const numB = Number(valB) || 0
      return sortDirection === 'asc' ? numA - numB : numB - numA
    })

    return result
  }, [
    rawExpenses,
    categoryFilter,
    paymentModeFilter,
    branchFilter,
    datePreset,
    startDate,
    endDate,
    searchQuery,
    sortField,
    sortDirection,
  ])

  // Summary Metrics computed from all currently filtered records
  const metrics = useMemo(() => {
    const totalCount = filteredAndSortedExpenses.length
    const totalAmount = filteredAndSortedExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)

    const upiTotal = filteredAndSortedExpenses
      .filter((e) => e.paymentMode === 'UPI')
      .reduce((sum, e) => sum + (e.amount || 0), 0)

    const cashTotal = filteredAndSortedExpenses
      .filter((e) => e.paymentMode === 'CASH')
      .reduce((sum, e) => sum + (e.amount || 0), 0)

    const bankTotal = filteredAndSortedExpenses
      .filter((e) => e.paymentMode === 'BANK_TRANSFER' || e.paymentMode === 'CHEQUE')
      .reduce((sum, e) => sum + (e.amount || 0), 0)

    // Category breakdown
    const categoryMap = new Map<string, { id: string; name: string; total: number; count: number }>()
    filteredAndSortedExpenses.forEach((e) => {
      const catName = e.category?.name || 'General Overheads'
      const catId = e.categoryId || e.category?.id || 'gen'
      const existing = categoryMap.get(catName) || { id: catId, name: catName, total: 0, count: 0 }
      existing.total += e.amount || 0
      existing.count += 1
      categoryMap.set(catName, existing)
    })

    const categoryBreakdown = Array.from(categoryMap.values()).sort((a, b) => b.total - a.total)
    const topCategory = categoryBreakdown[0] || null

    return {
      totalCount,
      totalAmount,
      upiTotal,
      cashTotal,
      bankTotal,
      categoryBreakdown,
      topCategory,
    }
  }, [filteredAndSortedExpenses])

  // Active filter indicator & reset
  const hasActiveFilters = Boolean(
    searchQuery ||
    categoryFilter !== 'ALL' ||
    paymentModeFilter !== 'ALL' ||
    branchFilter !== 'ALL' ||
    datePreset !== 'ALL' ||
    startDate ||
    endDate
  )

  const resetAllFilters = () => {
    setSearchQuery('')
    setCategoryFilter('ALL')
    setPaymentModeFilter('ALL')
    setBranchFilter('ALL')
    setDatePreset('ALL')
    setStartDate('')
    setEndDate('')
    setCurrentPage(1)
  }

  // Pagination Slice
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedExpenses.length / pageSize))
  const paginatedExpenses = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return filteredAndSortedExpenses.slice(startIndex, startIndex + pageSize)
  }, [filteredAndSortedExpenses, currentPage, pageSize])

  // Sort toggle handler
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection(field === 'expenseDate' || field === 'amount' ? 'desc' : 'asc')
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
    if (filteredAndSortedExpenses.length === 0) return
    exportExpensesToExcel(filteredAndSortedExpenses, {
      branchName: currentBranch?.name,
      dateRangeLabel: datePreset !== 'ALL' ? datePreset : undefined,
    })
    showToast(`Exported ${filteredAndSortedExpenses.length} expense vouchers to Excel (.xlsx)`)
  }

  const handleExportPDF = async () => {
    if (filteredAndSortedExpenses.length === 0) return
    await exportExpensesToPDF(filteredAndSortedExpenses, {
      instituteName: settings?.institute_name || currentBranch?.name || 'Sutawane Classes',
      branchName: currentBranch?.name,
      dateRangeLabel: datePreset !== 'ALL' ? datePreset : undefined,
      logoUrl: activeLogoUrl || settings?.logo_url,
      tagline: settings?.tagline,
    })
    showToast(`Exported ${filteredAndSortedExpenses.length} expense vouchers to PDF (.pdf)`)
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
            <Receipt className="w-6 h-6 text-primary" />
            Branch Expense & Overheads Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Log overheads (Rent, Salaries, Electricity, Internet, Maintenance, Marketing) with bill scans.
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
            <span>Columns ({visibleColumnsCount}/{ALL_EXPENSE_COLUMNS.length})</span>
          </Button>

          {/* Export to Excel Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={filteredAndSortedExpenses.length === 0}
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
            disabled={filteredAndSortedExpenses.length === 0}
            className="gap-1.5 text-xs h-9 border-rose-500/40 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
          >
            <FileText className="w-3.5 h-3.5 text-rose-600" />
            <span>Export PDF</span>
          </Button>

          {/* Add Expense Voucher Button */}
          <Button onClick={openCreateDialog} size="sm" className="gap-2 h-9 shadow-sm">
            <Plus className="w-4 h-4" />
            Add Expense Voucher
          </Button>
        </div>
      </div>

      {/* Financial KPI Summary Cards Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Total Vouchers Card */}
        <Card className="p-3 bg-card border shadow-sm">
          <div className="text-[11px] font-semibold text-muted-foreground flex items-center justify-between">
            <span>Recorded Vouchers</span>
            <Receipt className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="text-xl font-bold text-foreground mt-1">{metrics.totalCount}</div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Matching active filters</p>
        </Card>

        {/* Filtered Total Outflow Card */}
        <Card className="p-3 bg-rose-50/50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/40 shadow-sm">
          <div className="text-[11px] font-semibold text-rose-700 dark:text-rose-300 flex items-center justify-between">
            <span>Filtered Expenses</span>
            <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">
            {formatCurrency(metrics.totalAmount)}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Total center overheads</p>
        </Card>

        {/* Top Category Spending Card */}
        <Card className="p-3 bg-card border shadow-sm">
          <div className="text-[11px] font-semibold text-muted-foreground flex items-center justify-between">
            <span>Top Category</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-foreground mt-1 truncate">
            {metrics.topCategory ? metrics.topCategory.name : '—'}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {metrics.topCategory ? formatCurrency(metrics.topCategory.total) : 'No expenses recorded'}
          </p>
        </Card>

        {/* UPI & Digital Card */}
        <Card className="p-3 bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40 shadow-sm">
          <div className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 flex items-center justify-between">
            <span>UPI & Online</span>
            <Smartphone className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-xl font-bold text-blue-900 dark:text-blue-100 mt-1">
            {formatCurrency(metrics.upiTotal)}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Instant digital settlements</p>
        </Card>

        {/* Cash & Bank Outflow Card */}
        <Card className="col-span-2 sm:col-span-1 p-3 bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 shadow-sm">
          <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
            <span>Cash & Bank Wire</span>
            <Building2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">
            {formatCurrency(metrics.cashTotal + metrics.bankTotal)}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Physical cash & transfers</p>
        </Card>
      </div>

      {/* Category Pills Strip */}
      {metrics.categoryBreakdown.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={() => {
              setCategoryFilter('ALL')
              setCurrentPage(1)
            }}
            className={`px-3 py-1.5 rounded-lg border font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
              categoryFilter === 'ALL'
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-card hover:bg-muted text-muted-foreground'
            }`}
          >
            <span>All Categories</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                categoryFilter === 'ALL'
                  ? 'bg-primary-foreground/20 text-white'
                  : 'bg-muted text-foreground'
              }`}
            >
              {formatCurrency(metrics.totalAmount)}
            </span>
          </button>

          {metrics.categoryBreakdown.map((cat) => {
            const isSelected = categoryFilter === cat.id || categoryFilter === cat.name
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setCategoryFilter(isSelected ? 'ALL' : cat.id)
                  setCurrentPage(1)
                }}
                className={`px-3 py-1.5 rounded-lg border font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-card hover:bg-muted text-foreground'
                }`}
              >
                <span>{cat.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                    isSelected
                      ? 'bg-primary-foreground/20 text-white'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {formatCurrency(cat.total)}
                </span>
              </button>
            )
          })}
        </div>
      )}

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
              placeholder="Search description, vendor, ref no..."
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

          {/* Category Dropdown Filter */}
          <div className="flex items-center gap-1.5 bg-background border rounded-md px-2.5">
            <Filter className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full h-9 bg-transparent text-xs font-medium focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Mode Filter */}
          <div className="flex items-center gap-1.5 bg-background border rounded-md px-2.5">
            <CreditCard className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <select
              value={paymentModeFilter}
              onChange={(e) => {
                setPaymentModeFilter(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full h-9 bg-transparent text-xs font-medium focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Payment Modes</option>
              <option value="UPI">UPI (GPay/PhonePe)</option>
              <option value="CASH">Cash in Hand</option>
              <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
              <option value="CHEQUE">Cheque</option>
            </select>
          </div>

          {/* Branch Location Filter */}
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
        </div>

        {/* Secondary Date Range Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
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
              <option value="ALL">All Voucher Dates</option>
              <option value="TODAY">Recorded Today</option>
              <option value="YESTERDAY">Recorded Yesterday</option>
              <option value="THIS_WEEK">This Week</option>
              <option value="THIS_MONTH">This Month</option>
              <option value="LAST_MONTH">Last Month</option>
              <option value="THIS_YEAR">This Fiscal Year</option>
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

      {/* Main Expenses Table Card */}
      <Card className="shadow-sm overflow-hidden">
        <CardHeader className="py-3.5 px-4 bg-muted/20 border-b flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <span>Recorded Expense Vouchers</span>
            <Badge variant="outline" className="text-xs font-normal">
              Showing {paginatedExpenses.length} of {filteredAndSortedExpenses.length} entries
            </Badge>
          </CardTitle>
          <div className="text-xs text-muted-foreground font-mono">
            Scope: {currentBranch?.name || 'All Branches'}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Loading expense vouchers and spending ledgers...
            </div>
          ) : filteredAndSortedExpenses.length === 0 ? (
            <div className="py-16 text-center border-dashed m-4 rounded-xl border">
              <Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
              <p className="text-sm font-semibold text-foreground">No matching expense vouchers found</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {hasActiveFilters
                  ? 'No records match your active search and filter combinations.'
                  : 'Click "Add Expense Voucher" above to record your center overheads.'}
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
                    {/* Sr No */}
                    {visibleColumns.srNo && (
                      <TableHead className="w-12 px-3 text-center text-xs font-semibold text-white">#</TableHead>
                    )}

                    {/* Voucher Date */}
                    {visibleColumns.expenseDate && (
                      <TableHead
                        onClick={() => handleSort('expenseDate')}
                        className="cursor-pointer hover:text-white hover:bg-[#1f2c4a] transition-colors select-none whitespace-nowrap text-white group"
                      >
                        <div className="flex items-center gap-1 text-white">
                          <span>Date</span>
                          {renderSortIcon('expenseDate')}
                        </div>
                      </TableHead>
                    )}

                    {/* Category */}
                    {visibleColumns.category && (
                      <TableHead
                        onClick={() => handleSort('category')}
                        className="cursor-pointer hover:text-white hover:bg-[#1f2c4a] transition-colors select-none whitespace-nowrap text-white group"
                      >
                        <div className="flex items-center gap-1 text-white">
                          <span>Category</span>
                          {renderSortIcon('category')}
                        </div>
                      </TableHead>
                    )}

                    {/* Description */}
                    {visibleColumns.description && (
                      <TableHead
                        onClick={() => handleSort('description')}
                        className="cursor-pointer hover:text-white hover:bg-[#1f2c4a] transition-colors select-none min-w-[200px] text-white group"
                      >
                        <div className="flex items-center gap-1 font-semibold text-white">
                          <span>Description</span>
                          {renderSortIcon('description')}
                        </div>
                      </TableHead>
                    )}

                    {/* Branch */}
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

                    {/* Vendor / Payee */}
                    {visibleColumns.vendor && (
                      <TableHead
                        onClick={() => handleSort('vendor')}
                        className="cursor-pointer hover:text-white hover:bg-[#1f2c4a] transition-colors select-none whitespace-nowrap text-white group"
                      >
                        <div className="flex items-center gap-1 text-white">
                          <span>Vendor / Payee</span>
                          {renderSortIcon('vendor')}
                        </div>
                      </TableHead>
                    )}

                    {/* Payment Mode */}
                    {visibleColumns.paymentMode && (
                      <TableHead
                        onClick={() => handleSort('paymentMode')}
                        className="cursor-pointer hover:text-white hover:bg-[#1f2c4a] transition-colors select-none whitespace-nowrap text-white group"
                      >
                        <div className="flex items-center gap-1 text-white">
                          <span>Mode</span>
                          {renderSortIcon('paymentMode')}
                        </div>
                      </TableHead>
                    )}

                    {/* Reference / Bill No */}
                    {visibleColumns.referenceNumber && (
                      <TableHead
                        onClick={() => handleSort('referenceNumber')}
                        className="cursor-pointer hover:text-white hover:bg-[#1f2c4a] transition-colors select-none whitespace-nowrap text-white group"
                      >
                        <div className="flex items-center gap-1 text-white">
                          <span>Ref / UTR</span>
                          {renderSortIcon('referenceNumber')}
                        </div>
                      </TableHead>
                    )}

                    {/* Bill Scan Document */}
                    {visibleColumns.attachment && (
                      <TableHead className="text-center whitespace-nowrap text-white">Bill Scan</TableHead>
                    )}

                    {/* Amount */}
                    {visibleColumns.amount && (
                      <TableHead
                        onClick={() => handleSort('amount')}
                        className="cursor-pointer hover:text-white hover:bg-[#1f2c4a] text-right whitespace-nowrap select-none text-white group"
                      >
                        <div className="flex items-center justify-end gap-1 text-white">
                          <span>Amount (₹)</span>
                          {renderSortIcon('amount')}
                        </div>
                      </TableHead>
                    )}

                    {/* Actions */}
                    {visibleColumns.actions && (
                      <TableHead className="text-right whitespace-nowrap pr-4 text-white font-semibold">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {paginatedExpenses.map((exp: any, idx: number) => {
                    const rowNumber = (currentPage - 1) * pageSize + idx + 1
                    return (
                      <TableRow key={exp.id} className="hover:bg-muted/40 transition-colors">
                        {/* Sr No */}
                        {visibleColumns.srNo && (
                          <TableCell className="text-center font-mono text-xs text-muted-foreground">
                            {rowNumber}
                          </TableCell>
                        )}

                        {/* Date */}
                        {visibleColumns.expenseDate && (
                          <TableCell className="text-xs whitespace-nowrap font-medium text-foreground">
                            {formatDate(exp.expenseDate)}
                          </TableCell>
                        )}

                        {/* Category */}
                        {visibleColumns.category && (
                          <TableCell className="whitespace-nowrap">
                            <Badge variant="outline" className="text-xs font-normal">
                              {exp.category?.name || 'General'}
                            </Badge>
                          </TableCell>
                        )}

                        {/* Description */}
                        {visibleColumns.description && (
                          <TableCell className="font-semibold text-foreground">
                            <div>{exp.description}</div>
                            {exp.vendor && (
                              <div className="text-[10px] text-muted-foreground font-normal">
                                Paid to: {exp.vendor}
                              </div>
                            )}
                          </TableCell>
                        )}

                        {/* Branch */}
                        {visibleColumns.branch && (
                          <TableCell className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                            {exp.branch?.name || '—'}
                          </TableCell>
                        )}

                        {/* Vendor / Payee */}
                        {visibleColumns.vendor && (
                          <TableCell className="text-xs whitespace-nowrap">
                            {exp.vendor || '—'}
                          </TableCell>
                        )}

                        {/* Payment Mode */}
                        {visibleColumns.paymentMode && (
                          <TableCell className="whitespace-nowrap">
                            <Badge
                              variant={
                                exp.paymentMode === 'UPI'
                                  ? 'default'
                                  : exp.paymentMode === 'CASH'
                                  ? 'success'
                                  : exp.paymentMode === 'BANK_TRANSFER'
                                  ? 'secondary'
                                  : 'warning'
                              }
                              className="text-[11px]"
                            >
                              {exp.paymentMode}
                            </Badge>
                          </TableCell>
                        )}

                        {/* Reference / UTR */}
                        {visibleColumns.referenceNumber && (
                          <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                            {exp.referenceNumber || '—'}
                          </TableCell>
                        )}

                        {/* Bill Scan Document */}
                        {visibleColumns.attachment && (
                          <TableCell className="text-center whitespace-nowrap">
                            {exp.attachments && exp.attachments.length > 0 ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedAttachment(exp.attachments[0])}
                                className="h-7 px-2 text-primary border-primary/30 hover:bg-primary/10 gap-1 text-xs"
                                title="View uploaded receipt / bill scan"
                              >
                                <Paperclip className="w-3.5 h-3.5" />
                                <span>Bill Scan</span>
                              </Button>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                        )}

                        {/* Amount */}
                        {visibleColumns.amount && (
                          <TableCell className="text-right text-xs font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                            {formatCurrency(exp.amount)}
                          </TableCell>
                        )}

                        {/* Actions Toolbar */}
                        {visibleColumns.actions && (
                          <TableCell className="text-right whitespace-nowrap pr-4">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(exp)}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                title="Edit Expense Voucher"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteTarget(exp)}
                                className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                title="Delete Expense Voucher"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
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

        {/* Table Footer with Pagination Controls */}
        <div className="p-3 bg-muted/20 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground">
          <div>
            Showing <strong className="text-foreground">{paginatedExpenses.length}</strong> of{' '}
            <strong className="text-foreground">{filteredAndSortedExpenses.length}</strong> filtered vouchers
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
              Select which columns appear in your expense management ledger. Your layout preferences are automatically saved on this device.
            </p>

            <div className="grid grid-cols-2 gap-2.5 max-h-64 overflow-y-auto p-1 border rounded-lg bg-muted/30">
              {ALL_EXPENSE_COLUMNS.map((col) => {
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

      {/* Add / Edit Expense Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>
                {editingExpense ? 'Edit Expense Voucher' : 'Record Center Overhead / Expense'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {formError && (
                <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
                  {formError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Expense Description *</label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. October Electricity Bill / Xerox paper bundle"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Amount (₹) *</label>
                  <Input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 4500"
                    min={1}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold">Expense Category *</label>
                    <span className="text-[10px] text-muted-foreground font-medium">Auto-suggest or type new</span>
                  </div>
                  <ExpenseCategoryCombobox
                    value={categoryId}
                    categoryName={categoryName}
                    onChange={(selectedId, selectedName) => {
                      setCategoryId(selectedId)
                      setCategoryName(selectedName)
                    }}
                    required
                    placeholder="Search or type new category..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Branch Location *</label>
                  <select
                    value={formBranchId}
                    onChange={(e) => setFormBranchId(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none"
                    required
                  >
                    {branches.map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold">Expense Date *</label>
                    <button
                      type="button"
                      onClick={() => setExpenseDate(getTodayDateString())}
                      className="text-[10px] text-primary hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Calendar className="w-3 h-3" />
                      Today
                    </button>
                  </div>
                  <Input
                    type="date"
                    value={expenseDate || getTodayDateString()}
                    onChange={(e) => setExpenseDate(e.target.value || getTodayDateString())}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Vendor / Recipient</label>
                  <Input
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    placeholder="e.g. Landlord / MSEB"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none"
                  >
                    <option value="UPI">UPI (GPay/PhonePe)</option>
                    <option value="CASH">Cash in Hand</option>
                    <option value="BANK_TRANSFER">Bank Transfer (NEFT)</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Reference / UTR / Bill No.</label>
                <Input
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="e.g. Bill # 49201 / UTR Ref"
                />
              </div>

              {/* File Attachment Upload */}
              {!editingExpense && (
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>Attach Bill Scan / Photo (Optional)</span>
                    {attachmentFile && (
                      <span className="text-[11px] text-emerald-600 font-normal">
                        {attachmentFile.name}
                      </span>
                    )}
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-muted-foreground file:mr-2 file:py-1 file:px-2 file:rounded file:border file:text-xs file:bg-muted"
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveExpenseMutation.isPending}>
                {saveExpenseMutation.isPending ? 'Saving...' : 'Save Expense'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bill Attachment Viewer Dialog */}
      <Dialog open={Boolean(selectedAttachment)} onOpenChange={() => setSelectedAttachment(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-primary" />
              Attached Bill Document: {selectedAttachment?.fileName}
            </DialogTitle>
          </DialogHeader>

          <div className="p-4 bg-muted/20 border rounded-lg flex items-center justify-center max-h-[70vh] overflow-auto">
            {selectedAttachment?.mimeType?.includes('pdf') ? (
              <div className="text-center space-y-3 py-8">
                <FileText className="w-16 h-16 text-rose-600 mx-auto" />
                <p className="text-xs font-medium">PDF Document: {selectedAttachment?.fileName}</p>
                <Button
                  onClick={() => window.open(selectedAttachment.filePath, '_blank')}
                  size="sm"
                  className="gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Open PDF in New Tab
                </Button>
              </div>
            ) : (
              <img
                src={selectedAttachment?.filePath}
                alt="Bill attachment scan"
                className="max-w-full rounded shadow-sm object-contain"
              />
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedAttachment(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Delete Expense Voucher?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Are you sure you want to delete the expense voucher for{' '}
              <strong>"{deleteTarget?.description}"</strong> of{' '}
              <strong>{formatCurrency(deleteTarget?.amount || 0)}</strong>? Any linked bill attachments will
              also be permanently removed from disk.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
