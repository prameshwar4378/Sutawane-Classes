import React, { useState } from 'react'
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
import { Users, UserPlus, Search, Phone, IndianRupee } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

export const StudentsPage: React.FC = () => {
  const queryClient = useQueryClient()
  const { selectedBranchId, branches } = useApp()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Form states
  const [fullName, setFullName] = useState('')
  const [rollNumber, setRollNumber] = useState('')
  const [standard, setStandard] = useState('Class 10')
  const [branchId, setBranchId] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [studentPhone, setStudentPhone] = useState('')
  const [address, setAddress] = useState('')
  const [totalFees, setTotalFees] = useState('25000')
  const [formError, setFormError] = useState('')

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['students', selectedBranchId],
    queryFn: () =>
      api.get('/students', {
        branchId: selectedBranchId !== 'ALL' ? selectedBranchId : undefined,
      }),
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/students', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      queryClient.invalidateQueries({ queryKey: ['financial-stats'] })
      closeDialog()
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to admit student')
    },
  })

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

  const closeDialog = () => {
    setIsDialogOpen(false)
    setFormError('')
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
      parentPhone: parentPhone.trim(),
      studentPhone: studentPhone.trim() || undefined,
      address: address.trim() || undefined,
      totalFees: Number(totalFees) || 0,
    })
  }

  const filteredStudents = students.filter((s: any) => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return true
    return (
      s.fullName?.toLowerCase().includes(q) ||
      s.rollNumber?.toLowerCase().includes(q) ||
      s.parentPhone?.includes(q) ||
      s.standard?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Student Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Admit students, maintain bio records, and track fee commitments.
          </p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <UserPlus className="w-4 h-4" />
          New Admission
        </Button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex items-center gap-3 bg-card p-3 rounded-xl border">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by student name, roll number, phone or class..."
            className="pl-9 bg-background"
          />
        </div>
      </div>

      {/* Student Table */}
      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base font-semibold">
            Enrolled Students ({filteredStudents.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading student records...</p>
          ) : filteredStudents.length === 0 ? (
            <div className="py-12 text-center border rounded-lg border-dashed">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm font-semibold">No students found</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {searchQuery
                  ? 'No records match your search filter.'
                  : 'Start by clicking "New Admission" above to enroll your first student.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Roll No.</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Standard / Course</TableHead>
                  <TableHead>Parent Phone</TableHead>
                  <TableHead>Total Agreed Fees</TableHead>
                  <TableHead>Paid Fees</TableHead>
                  <TableHead>Pending Dues</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs font-semibold">{s.rollNumber}</TableCell>
                    <TableCell className="font-medium text-foreground">{s.fullName}</TableCell>
                    <TableCell>{s.standard}</TableCell>
                    <TableCell className="font-mono text-xs">{s.parentPhone}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(s.totalFees)}</TableCell>
                    <TableCell className="text-emerald-600 font-medium">
                      {formatCurrency(s.paidFees || 0)}
                    </TableCell>
                    <TableCell className="text-rose-600 font-medium">
                      {formatCurrency(s.pendingFees || 0)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          s.pendingFees === 0
                            ? 'success'
                            : s.paidFees > 0
                            ? 'warning'
                            : 'danger'
                        }
                      >
                        {s.pendingFees === 0 ? 'Settled' : s.paidFees > 0 ? 'Partial' : 'Unpaid'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Admission Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>Student Admission Form</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
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
                  <label className="text-xs font-semibold">Class / Standard *</label>
                  <select
                    value={standard}
                    onChange={(e) => setStandard(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
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
                  <label className="text-xs font-semibold">Parent Phone (10 digits) *</label>
                  <Input
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value)}
                    placeholder="9876543210"
                    maxLength={10}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Student Phone (Optional)</label>
                  <Input
                    value={studentPhone}
                    onChange={(e) => setStudentPhone(e.target.value)}
                    placeholder="9876543210"
                    maxLength={10}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Agreed Total Fees (₹) *</label>
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
                <label className="text-xs font-semibold">Address (Optional)</label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Local residential area"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Saving...' : 'Complete Admission'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
