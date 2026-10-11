import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useApp } from '@/context/AppContext'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Receipt, Plus, IndianRupee, Calendar } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

export const ExpensesPage: React.FC = () => {
  const queryClient = useQueryClient()
  const { selectedBranchId, branches } = useApp()
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Rent')
  const [paymentMode, setPaymentMode] = useState('UPI')
  const [vendor, setVendor] = useState('')
  const [branchId, setBranchId] = useState('')

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses', selectedBranchId],
    queryFn: () =>
      api.get('/expenses', {
        branchId: selectedBranchId !== 'ALL' ? selectedBranchId : undefined,
      }).catch(() => []),
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/expenses', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      setIsDialogOpen(false)
      setDescription('')
      setAmount('')
      setVendor('')
    },
  })

  const openCreateDialog = () => {
    setDescription('')
    setAmount('')
    setVendor('')
    setBranchId(selectedBranchId !== 'ALL' ? selectedBranchId : branches[0]?.id || '')
    setIsDialogOpen(true)
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim() || !amount) return

    createMutation.mutate({
      description: description.trim(),
      amount: Number(amount),
      category,
      paymentMode,
      vendor: vendor.trim() || undefined,
      branchId: branchId || undefined,
    })
  }

  const totalExpense = expenses.reduce((sum: number, ex: any) => sum + (ex.amount || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Receipt className="w-6 h-6 text-primary" />
            Branch Expense Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Record branch overheads: rent, electricity, teacher salaries, stationery, marketing.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="p-2.5 px-4 bg-muted/50 border rounded-lg text-right">
            <span className="text-xs text-muted-foreground block font-medium">Total Expenses</span>
            <span className="text-lg font-bold text-foreground">{formatCurrency(totalExpense)}</span>
          </div>
          <Button onClick={openCreateDialog} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Expense
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Recorded Branch Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading expenses...</p>
          ) : expenses.length === 0 ? (
            <div className="py-12 text-center border rounded-lg border-dashed">
              <Receipt className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold">No expenses recorded yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Click "Add Expense" to record rent, bills, or maintenance.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Vendor / Payee</TableHead>
                  <TableHead>Payment Mode</TableHead>
                  <TableHead className="text-right">Amount (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((ex: any) => (
                  <TableRow key={ex.id}>
                    <TableCell>{new Date(ex.expenseDate).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{ex.category?.name || ex.category}</Badge>
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{ex.description}</TableCell>
                    <TableCell>{ex.vendor || '—'}</TableCell>
                    <TableCell>{ex.paymentMode}</TableCell>
                    <TableCell className="text-right font-bold text-rose-600">
                      {formatCurrency(ex.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog for Add Expense */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>Record Branch Expense</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Expense Description *</label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Center Electricity Bill for October"
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
                  <label className="text-xs font-semibold">Category *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
                  >
                    <option value="Rent">Center Rent</option>
                    <option value="Salaries">Faculty & Staff Salary</option>
                    <option value="Electricity">Electricity & Water</option>
                    <option value="Internet">Internet & Phone</option>
                    <option value="Stationery">Printing & Study Material</option>
                    <option value="Maintenance">Repairs & Maintenance</option>
                    <option value="Marketing">Marketing & Banners</option>
                    <option value="Miscellaneous">Miscellaneous</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Vendor / Recipient</label>
                  <Input
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    placeholder="e.g. MSEDCL or Landlord"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
                  >
                    <option value="UPI">UPI</option>
                    <option value="CASH">Cash</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Saving...' : 'Save Expense'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
