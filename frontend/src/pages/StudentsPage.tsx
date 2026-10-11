import React, { useState } from 'react'
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
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { PromoteStudentModal } from '@/components/PromoteStudentModal'
import { BatchPromoteModal } from '@/components/BatchPromoteModal'

export const StudentsPage: React.FC = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { selectedBranchId, branches } = useApp()

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [standardFilter, setStandardFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'true' | 'false'>('true')
  const [toastMsg, setToastMsg] = useState('')

  // Promotion states
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isBatchPromoteOpen, setIsBatchPromoteOpen] = useState(false)
  const [studentToPromote, setStudentToPromote] = useState<any>(null)

  // Form states for new admission
  const [fullName, setFullName] = useState('')
  const [rollNumber, setRollNumber] = useState('')
  const [standard, setStandard] = useState('Class 10')
  const [branchId, setBranchId] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [studentPhone, setStudentPhone] = useState('')
  const [address, setAddress] = useState('')
  const [totalFees, setTotalFees] = useState('25000')
  const [formError, setFormError] = useState('')

  // Query students
  const { data: students = [], isLoading } = useQuery({
    queryKey: ['students', selectedBranchId, standardFilter, statusFilter, searchQuery],
    queryFn: () =>
      api.get('/students', {
        branchId: selectedBranchId !== 'ALL' ? selectedBranchId : undefined,
        standard: standardFilter !== 'ALL' ? standardFilter : undefined,
        isActive: statusFilter,
        search: searchQuery || undefined,
      }),
  })

  // Create admission mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/students', data),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      queryClient.invalidateQueries({ queryKey: ['financial-stats'] })
      setIsDialogOpen(false)
      showToast('Student admitted successfully!')
      // Navigate to the newly created student profile
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

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === students.length && students.length > 0) {
      setSelectedIds([])
    } else {
      setSelectedIds(students.map((s: any) => s.id))
    }
  }

  const selectedStudentsList = students.filter((s: any) => selectedIds.includes(s.id))

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
      parentPhone: parentPhone.trim(),
      studentPhone: studentPhone.trim() || undefined,
      address: address.trim() || undefined,
      totalFees: Number(totalFees) || 0,
    })
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Student Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Admit students, maintain bio records, manage photographs, and track fee commitments.
          </p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <UserPlus className="w-4 h-4" />
          New Admission
        </Button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-card p-3 rounded-xl border">
        {/* Search Input */}
        <div className="relative md:col-span-2">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by student name, roll number, phone or ID..."
            className="pl-9 bg-background"
          />
        </div>

        {/* Class / Standard Filter */}
        <div className="flex items-center gap-1.5 bg-background border rounded-md px-2.5">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <select
            value={standardFilter}
            onChange={(e) => setStandardFilter(e.target.value)}
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

        {/* Active / Archive Status Filter */}
        <div className="flex items-center bg-background border rounded-md px-2.5">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full h-9 bg-transparent text-xs font-medium focus:outline-none cursor-pointer"
          >
            <option value="true">Active Students Only</option>
            <option value="false">Archived / Inactive Only</option>
            <option value="ALL">All (Active & Archived)</option>
          </select>
        </div>
      </div>

      {/* Batch Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <div className="flex items-center gap-2">
            <Badge variant="warning" className="px-2.5 py-1 text-xs font-bold">
              {selectedIds.length} Selected
            </Badge>
            <span className="text-xs font-semibold text-foreground">
              students chosen for next-session promotion or batch operations
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setIsBatchPromoteOpen(true)}
              className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Batch Promote ({selectedIds.length}) to Next Session
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedIds([])}
              className="text-xs"
            >
              Deselect All
            </Button>
          </div>
        </div>
      )}

      {/* Student Records Table */}
      <Card>
        <CardHeader className="py-4 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">
            Registered Students ({students.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading student records...</p>
          ) : students.length === 0 ? (
            <div className="py-12 text-center border rounded-lg border-dashed">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm font-semibold">No students found</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {searchQuery || standardFilter !== 'ALL'
                  ? 'No records match your active search and class filters.'
                  : 'Start by clicking "New Admission" above to enroll your first student.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <input
                      type="checkbox"
                      checked={students.length > 0 && selectedIds.length === students.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded text-primary border-gray-300 focus:ring-primary cursor-pointer"
                      title="Select / Deselect All Visible"
                    />
                  </TableHead>
                  <TableHead className="w-12">Photo</TableHead>
                  <TableHead>Roll No.</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Standard</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Parent Phone</TableHead>
                  <TableHead>Total Fees</TableHead>
                  <TableHead>Balance Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((s: any) => (
                  <TableRow
                    key={s.id}
                    className={`hover:bg-muted/40 transition-colors ${
                      selectedIds.includes(s.id) ? 'bg-amber-500/10' : ''
                    }`}
                  >
                    {/* Checkbox Column */}
                    <TableCell className="w-8">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(s.id)}
                        onChange={() => toggleSelect(s.id)}
                        className="w-4 h-4 rounded text-primary border-gray-300 focus:ring-primary cursor-pointer"
                      />
                    </TableCell>

                    {/* Photo Thumbnail */}
                    <TableCell>
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-muted flex items-center justify-center border text-xs">
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

                    <TableCell className="font-mono text-xs font-semibold">{s.rollNumber}</TableCell>
                    <TableCell className="font-semibold text-foreground">
                      <button
                        type="button"
                        onClick={() => navigate(`/students/${s.id}`)}
                        className="hover:underline text-left"
                      >
                        {s.fullName}
                      </button>
                    </TableCell>
                    <TableCell>{s.standard}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-medium">
                      {s.branchName}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{s.parentPhone}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(s.totalFees)}</TableCell>
                    <TableCell className="text-rose-600 font-bold">
                      {formatCurrency(s.pendingFees || 0)}
                    </TableCell>
                    <TableCell>
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
                    <TableCell className="text-right space-x-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setStudentToPromote(s)}
                        className="h-8 gap-1 text-xs border-amber-500/60 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                        title="Promote to Next Session"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        Promote
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/students/${s.id}`)}
                        className="h-8 gap-1 text-xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Profile
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate('/fees/collect')}
                        className="h-8 gap-1 text-xs"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        Fee
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setArchiveTarget(s)}
                        className="h-8 px-2 text-muted-foreground hover:text-foreground"
                        title={s.isActive ? 'Archive Student' : 'Reactivate Student'}
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </Button>
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
                  <label className="text-xs font-semibold">Class / Course *</label>
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
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
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
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  An initial 3-installment plan (40% admission, 30% month 2, 30% month 3) will be auto-generated.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Address</label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Local residential area"
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
