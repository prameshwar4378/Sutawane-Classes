import React, { useState, useRef } from 'react'
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
  Receipt,
  Plus,
  Search,
  Filter,
  FileText,
  Paperclip,
  Trash2,
  Edit2,
  CheckCircle2,
  Eye,
  IndianRupee,
  Calendar,
} from 'lucide-react'
import { formatCurrency, formatDate, formatDateLong } from '@/lib/utils'

export const ExpensesPage: React.FC = () => {
  const queryClient = useQueryClient()
  const { selectedBranchId, branches } = useApp()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [paymentModeFilter, setPaymentModeFilter] = useState('ALL')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

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
  const [branchId, setBranchId] = useState('')
  const [paymentMode, setPaymentMode] = useState('UPI')
  const [vendor, setVendor] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split('T')[0])
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)

  // 1. Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: () => api.get('/expenses/categories'),
  })

  // 2. Fetch expenses list with filters
  const { data: expenses = [], isLoading } = useQuery({
    queryKey: [
      'expenses-list',
      selectedBranchId,
      categoryFilter,
      paymentModeFilter,
      startDate,
      endDate,
      searchQuery,
    ],
    queryFn: () =>
      api.get('/expenses', {
        branchId: selectedBranchId !== 'ALL' ? selectedBranchId : undefined,
        categoryId: categoryFilter !== 'ALL' ? categoryFilter : undefined,
        paymentMode: paymentModeFilter !== 'ALL' ? paymentModeFilter : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        search: searchQuery || undefined,
      }),
  })

  // 3. Fetch summary stats
  const { data: summaryStats } = useQuery({
    queryKey: ['expenses-summary', selectedBranchId, startDate, endDate],
    queryFn: () =>
      api.get('/expenses/stats/summary', {
        branchId: selectedBranchId !== 'ALL' ? selectedBranchId : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
  })

  // Create / Edit mutation
  const saveExpenseMutation = useMutation({
    mutationFn: async (data: any) => {
      const formData = new FormData()
      formData.append('description', data.description)
      formData.append('amount', String(data.amount))
      formData.append('categoryId', data.categoryId)
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
      queryClient.invalidateQueries({ queryKey: ['expenses-list'] })
      queryClient.invalidateQueries({ queryKey: ['expenses-summary'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] })
      closeDialog()
      showToast(editingExpense ? 'Expense updated successfully!' : 'Expense recorded successfully!')
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to save expense')
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses-list'] })
      queryClient.invalidateQueries({ queryKey: ['expenses-summary'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] })
      setDeleteTarget(null)
      showToast('Expense voucher deleted.')
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to delete expense', true)
    },
  })

  const showToast = (msg: string, isErr = false) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 4000)
  }

  const openCreateDialog = () => {
    setEditingExpense(null)
    setDescription('')
    setAmount('')
    setCategoryId(categories[0]?.id || '')
    setBranchId(selectedBranchId !== 'ALL' ? selectedBranchId : branches[0]?.id || '')
    setPaymentMode('UPI')
    setVendor('')
    setReferenceNumber('')
    setExpenseDate(new Date().toISOString().split('T')[0])
    setAttachmentFile(null)
    setFormError('')
    setIsDialogOpen(true)
  }

  const openEditDialog = (exp: any) => {
    setEditingExpense(exp)
    setDescription(exp.description)
    setAmount(String(exp.amount))
    setCategoryId(exp.categoryId)
    setBranchId(exp.branchId)
    setPaymentMode(exp.paymentMode)
    setVendor(exp.vendor || '')
    setReferenceNumber(exp.referenceNumber || '')
    setExpenseDate(new Date(exp.expenseDate).toISOString().split('T')[0])
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

    saveExpenseMutation.mutate({
      description: description.trim(),
      amount: numAmount,
      categoryId: categoryId || categories[0]?.id,
      branchId: branchId || branches[0]?.id,
      paymentMode,
      vendor: vendor.trim() || null,
      referenceNumber: referenceNumber.trim() || null,
      expenseDate,
      attachment: attachmentFile || undefined,
    })
  }

  const totalExpenseAmount = expenses.reduce((sum: number, ex: any) => sum + (ex.amount || 0), 0)

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 p-4 bg-foreground text-background rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {toastMsg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Receipt className="w-6 h-6 text-primary" />
            Branch Expense & Overheads Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Log overheads (Rent, Salaries, Electricity, Internet, Maintenance, Marketing) with bill scans.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="p-2.5 px-4 bg-rose-50 border border-rose-200 dark:bg-rose-950/30 rounded-lg text-right">
            <span className="text-[11px] text-rose-700 dark:text-rose-300 block font-medium">
              Filtered Total Expenses
            </span>
            <span className="text-xl font-bold text-rose-600">
              {formatCurrency(totalExpenseAmount)}
            </span>
          </div>
          <Button onClick={openCreateDialog} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Expense Voucher
          </Button>
        </div>
      </div>

      {/* Category Spending Cards */}
      {summaryStats?.byCategory && summaryStats.byCategory.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {summaryStats.byCategory.map((cat: any, i: number) => (
            <div
              key={i}
              className="p-2.5 bg-card border rounded-lg hover:border-primary/50 transition-colors flex flex-col justify-between"
            >
              <span className="text-[11px] text-muted-foreground font-medium truncate">{cat.name}</span>
              <span className="text-xs font-bold text-foreground mt-1">
                {formatCurrency(cat.total)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 bg-card p-3 rounded-xl border text-xs">
        {/* Search */}
        <div className="relative md:col-span-2">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search description, vendor, reference..."
            className="pl-9 h-9 text-xs bg-background"
          />
        </div>

        {/* Category Filter */}
        <div className="flex items-center bg-background border rounded-md px-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
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

        {/* Payment Mode */}
        <div className="flex items-center bg-background border rounded-md px-2">
          <select
            value={paymentModeFilter}
            onChange={(e) => setPaymentModeFilter(e.target.value)}
            className="w-full h-9 bg-transparent text-xs font-medium focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Payment Modes</option>
            <option value="UPI">UPI</option>
            <option value="CASH">Cash</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="CHEQUE">Cheque</option>
          </select>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-9 text-[11px] bg-background"
            title="Start Date"
          />
          <span className="text-muted-foreground">-</span>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-9 text-[11px] bg-background"
            title="End Date"
          />
        </div>
      </div>

      {/* Expenses Table */}
      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base font-semibold">
            Recorded Vouchers ({expenses.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading expenses...</p>
          ) : expenses.length === 0 ? (
            <div className="py-12 text-center border rounded-lg border-dashed">
              <Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold">No expense records found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Click "Add Expense Voucher" to record your center overheads.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Vendor / Payee</TableHead>
                  <TableHead>Mode / Ref</TableHead>
                  <TableHead>Bill Scan</TableHead>
                  <TableHead>Amount (₹)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((exp: any) => (
                  <TableRow key={exp.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell className="text-xs">{formatDate(exp.expenseDate)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[11px]">
                        {exp.category?.name}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">{exp.description}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-medium">
                      {exp.branch?.name}
                    </TableCell>
                    <TableCell className="text-xs">{exp.vendor || '—'}</TableCell>
                    <TableCell className="text-xs">
                      <span>{exp.paymentMode}</span>
                      {exp.referenceNumber && (
                        <span className="text-muted-foreground font-mono block text-[10px]">
                          {exp.referenceNumber}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {exp.attachments && exp.attachments.length > 0 ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedAttachment(exp.attachments[0])}
                          className="h-7 px-2 text-primary gap-1 text-xs"
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                          View Bill
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-bold text-rose-600">
                      {formatCurrency(exp.amount)}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(exp)}
                        className="h-8 px-2"
                        title="Edit Expense"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(exp)}
                        className="h-8 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                        title="Delete Expense"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
                  <label className="text-xs font-semibold">Expense Category *</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none"
                    required
                  >
                    {categories.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Branch Location *</label>
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
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
                  <label className="text-xs font-semibold">Expense Date *</label>
                  <Input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
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
                  placeholder="e.g. Bill # 49201"
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
              className="bg-destructive text-destructive-foreground"
            >
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
