import React, { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
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
  User,
  Phone,
  MapPin,
  Calendar,
  Building2,
  GraduationCap,
  CreditCard,
  ClockAlert,
  Edit2,
  Archive,
  ArrowLeft,
  Camera,
  Printer,
  CheckCircle2,
  AlertCircle,
  IndianRupee,
} from 'lucide-react'
import { formatCurrency, formatDate, formatDateLong } from '@/lib/utils'

export const StudentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Dialog states
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false)
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null)
  const [toastMsg, setToastMsg] = useState('')

  // Edit form states
  const [fullName, setFullName] = useState('')
  const [rollNumber, setRollNumber] = useState('')
  const [standard, setStandard] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [studentPhone, setStudentPhone] = useState('')
  const [address, setAddress] = useState('')
  const [editError, setEditError] = useState('')

  // Fetch student detailed profile
  const { data: student, isLoading, isError, refetch } = useQuery({
    queryKey: ['student-profile', id],
    queryFn: () => api.get(`/students/${id}`),
    enabled: Boolean(id),
  })

  // Photo upload mutation
  const photoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('photo', file)
      return api.post(`/students/${id}/photo`, formData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-profile', id] })
      queryClient.invalidateQueries({ queryKey: ['students'] })
      showToast('Photograph updated successfully!')
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to upload photo', true)
    },
  })

  // Edit mutation
  const editMutation = useMutation({
    mutationFn: (data: any) => api.put(`/students/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-profile', id] })
      queryClient.invalidateQueries({ queryKey: ['students'] })
      setIsEditDialogOpen(false)
      showToast('Student profile updated successfully!')
    },
    onError: (err: any) => {
      setEditError(err.message || 'Failed to update profile')
    },
  })

  // Archive / Reactivate mutation
  const statusMutation = useMutation({
    mutationFn: (isActive: boolean) => api.patch(`/students/${id}/status`, { isActive }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['student-profile', id] })
      queryClient.invalidateQueries({ queryKey: ['students'] })
      setIsArchiveDialogOpen(false)
      showToast(variables ? 'Student reactivated successfully!' : 'Student archived safely without data loss!')
    },
  })

  const showToast = (msg: string, _isErr = false) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 4000)
  }

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      photoMutation.mutate(file)
    }
  }

  const openEditDialog = () => {
    if (!student) return
    setFullName(student.fullName || '')
    setRollNumber(student.currentAdmission?.rollNumber || '')
    setStandard(student.currentAdmission?.standard || 'Class 10')
    setParentPhone(student.parentPhone || '')
    setStudentPhone(student.studentPhone || '')
    setAddress(student.address || '')
    setEditError('')
    setIsEditDialogOpen(true)
  }

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim() || !parentPhone.trim()) {
      setEditError('Full name and parent phone are required.')
      return
    }

    editMutation.mutate({
      fullName: fullName.trim(),
      rollNumber: rollNumber.trim() || undefined,
      standard: standard.trim() || undefined,
      parentPhone: parentPhone.trim(),
      studentPhone: studentPhone.trim() || null,
      address: address.trim() || null,
    })
  }

  if (isLoading) {
    return (
      <div className="py-24 text-center">
        <p className="text-muted-foreground">Loading student profile details...</p>
      </div>
    )
  }

  if (isError || !student) {
    return (
      <div className="py-16 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
        <h2 className="text-xl font-bold">Student record not found</h2>
        <Button onClick={() => navigate('/students')} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Students List
        </Button>
      </div>
    )
  }

  const admission = student.currentAdmission
  const fee = student.feeSummary
  const isArchived = admission ? !admission.isActive : false

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 p-4 bg-foreground text-background rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {toastMsg}
        </div>
      )}

      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/students')}
            className="h-9 w-9"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {student.fullName}
              </h1>
              <Badge variant={isArchived ? 'outline' : 'success'}>
                {isArchived ? 'Archived / Inactive' : 'Active Student'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">
              ID: {student.studentCode} | Roll No: {admission?.rollNumber || '—'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => navigate('/fees/collect')}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <CreditCard className="w-4 h-4" />
            Collect Fees
          </Button>
          <Button onClick={openEditDialog} variant="outline" className="gap-2">
            <Edit2 className="w-4 h-4" />
            Edit Profile
          </Button>
          <Button
            variant="secondary"
            onClick={() => setIsArchiveDialogOpen(true)}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <Archive className="w-4 h-4" />
            {isArchived ? 'Reactivate' : 'Archive'}
          </Button>
        </div>
      </div>

      {/* Bio Profile Card & Fee Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Card: Student Bio & Photo */}
        <Card className="lg:col-span-1">
          <CardHeader className="text-center pb-2">
            {/* Photo Avatar */}
            <div className="relative mx-auto w-32 h-32 rounded-full overflow-hidden border-4 border-background shadow-md bg-muted flex items-center justify-center group">
              {student.photoUrl ? (
                <img
                  src={student.photoUrl}
                  alt={student.fullName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-16 h-16 text-muted-foreground/60" />
              )}
              {/* Photo Upload Overlay */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={photoMutation.isPending}
                className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity cursor-pointer text-xs"
              >
                <Camera className="w-5 h-5 mb-1" />
                <span>{photoMutation.isPending ? 'Uploading...' : 'Change Photo'}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                className="hidden"
              />
            </div>
            <CardTitle className="text-lg font-bold mt-3">{student.fullName}</CardTitle>
            <p className="text-xs text-muted-foreground font-mono">{student.studentCode}</p>
          </CardHeader>

          <CardContent className="space-y-3 pt-2 text-xs">
            <div className="p-3 bg-muted/40 rounded-lg space-y-2 border">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-muted-foreground">Class / Course:</span>
                <span className="font-semibold text-foreground ml-auto">{admission?.standard || '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-muted-foreground">Branch:</span>
                <span className="font-semibold text-foreground ml-auto">{admission?.branch?.name || '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span className="text-muted-foreground">Session:</span>
                <span className="font-semibold text-foreground ml-auto">{admission?.session?.displayName || '—'}</span>
              </div>
            </div>

            <div className="space-y-2 pt-1 border-t">
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground">Parent Phone:</span>
                <span className="font-mono font-medium ml-auto">{student.parentPhone}</span>
              </div>
              {student.studentPhone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">Student Phone:</span>
                  <span className="font-mono font-medium ml-auto">{student.studentPhone}</span>
                </div>
              )}
              {student.address && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Address:</span>
                  <span className="font-medium ml-auto text-right max-w-[170px]">{student.address}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground">Admitted On:</span>
                <span className="font-medium ml-auto">{formatDate(admission?.admissionDate)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Area: Fee Ledger Cards & Breakdown */}
        <div className="lg:col-span-2 space-y-6">
          {/* Fee KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-blue-200 bg-blue-50/30 dark:bg-blue-950/20">
              <CardHeader className="py-3 pb-1">
                <CardTitle className="text-xs font-semibold uppercase text-muted-foreground">
                  Agreed Total Fees
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {formatCurrency(fee.netPayable)}
                </div>
                {fee.totalDiscount > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    (Gross: {formatCurrency(fee.totalFees)} - Concession: {formatCurrency(fee.totalDiscount)})
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border-emerald-200 bg-emerald-50/30 dark:bg-emerald-950/20">
              <CardHeader className="py-3 pb-1">
                <CardTitle className="text-xs font-semibold uppercase text-muted-foreground">
                  Total Fees Paid
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">
                  {formatCurrency(fee.totalPaid)}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Confirmed collections
                </p>
              </CardContent>
            </Card>

            <Card className="border-rose-200 bg-rose-50/30 dark:bg-rose-950/20">
              <CardHeader className="py-3 pb-1">
                <CardTitle className="text-xs font-semibold uppercase text-muted-foreground">
                  Outstanding Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-rose-600">
                  {formatCurrency(fee.totalPending)}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Remaining installment dues
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Installment Breakdown Schedule */}
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-base font-semibold flex items-center justify-between">
                <span>Installment Schedule</span>
                <Badge variant={fee.totalPending === 0 ? 'success' : 'warning'}>
                  {fee.totalPending === 0 ? 'All Installments Cleared' : `${fee.totalPending > 0 ? 'Installments Pending' : ''}`}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {student.installments.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No installment plan configured.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Installment Label</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Amount Due</TableHead>
                      <TableHead>Amount Paid</TableHead>
                      <TableHead>Remaining</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {student.installments.map((inst: any) => (
                      <TableRow key={inst.id}>
                        <TableCell className="font-mono text-xs">{inst.installmentNo}</TableCell>
                        <TableCell className="font-medium text-foreground">{inst.label}</TableCell>
                        <TableCell className="text-xs">{formatDateLong(inst.dueDate)}</TableCell>
                        <TableCell className="font-semibold">{formatCurrency(inst.amountDue)}</TableCell>
                        <TableCell className="text-emerald-600 font-medium">
                          {formatCurrency(inst.amountPaid)}
                        </TableCell>
                        <TableCell className="text-rose-600 font-medium">
                          {formatCurrency(inst.balanceRemaining)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={
                              inst.status === 'PAID'
                                ? 'success'
                                : inst.status === 'PARTIAL'
                                ? 'warning'
                                : inst.status === 'OVERDUE'
                                ? 'danger'
                                : 'outline'
                            }
                          >
                            {inst.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Payment Receipts History */}
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-base font-semibold">Payment History & Receipts</CardTitle>
            </CardHeader>
            <CardContent>
              {student.payments.length === 0 ? (
                <div className="py-8 text-center border rounded-lg border-dashed">
                  <CreditCard className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-semibold">No payments recorded yet</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Click "Collect Fees" above to record the initial installment token.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Receipt No.</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Payment Mode</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {student.payments.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs font-bold text-foreground">
                          {p.receiptNumber}
                        </TableCell>
                        <TableCell className="text-xs">{formatDate(p.paymentDate)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{p.paymentMode}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                          {p.notes || '—'}
                        </TableCell>
                        <TableCell className="font-bold text-emerald-600">
                          {formatCurrency(p.totalAmount)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedReceipt(p)}
                            className="h-8 gap-1 text-xs"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Receipt
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Student Profile Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle>Edit Student Information</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {editError && (
                <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
                  {editError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Student Full Name *</label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Roll Number</label>
                  <Input
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Class / Course</label>
                  <Input
                    value={standard}
                    onChange={(e) => setStandard(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Parent Phone *</label>
                  <Input
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value)}
                    maxLength={10}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Student Phone</label>
                  <Input
                    value={studentPhone}
                    onChange={(e) => setStudentPhone(e.target.value)}
                    maxLength={10}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Address</label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={editMutation.isPending}>
                {editMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Archive / Deactivate Confirmation Dialog */}
      <AlertDialog open={isArchiveDialogOpen} onOpenChange={setIsArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isArchived ? 'Reactivate Student Admission?' : 'Archive Student Profile?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isArchived
                ? `This will restore ${student.fullName} as an active student in this academic session.`
                : `Archiving will remove ${student.fullName} from active student lists. All historical installment ledgers, payment transactions, and receipts will be safely preserved in the database permanently.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => statusMutation.mutate(isArchived)}
              className={isArchived ? 'bg-primary' : 'bg-destructive text-destructive-foreground'}
            >
              {isArchived ? 'Confirm Reactivation' : 'Confirm Safe Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Printable Receipt Modal Dialog */}
      <Dialog open={Boolean(selectedReceipt)} onOpenChange={() => setSelectedReceipt(null)}>
        <DialogContent className="max-w-md">
          {selectedReceipt && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>Fee Payment Receipt</span>
                  <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1.5">
                    <Printer className="w-3.5 h-3.5" />
                    Print
                  </Button>
                </DialogTitle>
              </DialogHeader>

              <div className="border p-4 rounded-lg bg-card text-xs space-y-3 font-mono print:border-none">
                <div className="text-center border-b pb-2">
                  <h3 className="font-bold text-sm text-foreground">SUTAWANE CLASSES</h3>
                  <p className="text-[10px] text-muted-foreground">Official Fee Receipt</p>
                </div>
                <div className="flex justify-between">
                  <span>Receipt #:</span>
                  <span className="font-bold">{selectedReceipt.receiptNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Student:</span>
                  <span className="font-semibold">{student.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Roll No:</span>
                  <span>{admission?.rollNumber || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Class:</span>
                  <span>{admission?.standard || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Payment Date:</span>
                  <span>{formatDate(selectedReceipt.paymentDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Payment Mode:</span>
                  <span>{selectedReceipt.paymentMode}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-bold text-sm text-emerald-600">
                  <span>Amount Paid:</span>
                  <span>{formatCurrency(selectedReceipt.totalAmount)}</span>
                </div>
                <div className="border-t pt-2 text-[10px] text-muted-foreground text-center">
                  Thank you! Computer generated official receipt.
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedReceipt(null)}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
