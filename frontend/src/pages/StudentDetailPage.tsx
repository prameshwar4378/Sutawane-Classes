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
  Sparkles,
  History,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import { formatCurrency, formatDate, formatDateLong } from '@/lib/utils'
import { PromoteStudentModal } from '@/components/PromoteStudentModal'
import { FeeReceiptModal, type ReceiptData } from '@/components/FeeReceiptModal'
import { useApp } from '@/context/AppContext'
import {
  WhatsAppIcon,
  openWhatsApp,
  buildReceiptWhatsAppMessage,
  buildAdmissionWhatsAppMessage,
  buildFeeReminderWhatsAppMessage,
} from '@/lib/whatsapp'

export const StudentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const { courses, settings } = useApp()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Dialog states
  const [selectedAdmissionId, setSelectedAdmissionId] = useState<string>('')
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false)
  const [isPromoteDialogOpen, setIsPromoteDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
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

  // Fetch student detailed profile (scoped by selected admission session if set)
  const { data: student, isLoading, isError, refetch } = useQuery({
    queryKey: ['student-profile', id, selectedAdmissionId],
    queryFn: () => api.get(`/students/${id}`, { admissionId: selectedAdmissionId || undefined }),
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

  // Permanent student deletion mutation
  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/students/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      navigate('/students', {
        state: {
          toast: `Student "${student?.fullName || 'Record'}" and all associated fee records were permanently deleted.`
        }
      })
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to delete student', true)
      setIsDeleteDialogOpen(false)
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

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => setIsPromoteDialogOpen(true)}
            variant="outline"
            className="gap-2 border-amber-500 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 font-medium"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            Promote to Next Session
          </Button>
          <Button
            onClick={() => {
              const pendingAmt = fee?.overallPendingAmount ?? fee?.totalPending ?? admission?.pendingFees ?? ''
              navigate(
                `/fees/collect?studentId=${student.id}&admissionId=${admission?.id || ''}&amount=${pendingAmt}`
              )
            }}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            title={`Collect fees for ${student.fullName}`}
          >
            <CreditCard className="w-4 h-4" />
            Collect Fees
          </Button>
          {student.parentPhone && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const msg = buildAdmissionWhatsAppMessage({
                  instituteName: settings?.institute_name,
                  studentName: student.fullName,
                  rollNumber: admission?.rollNumber || student.studentCode,
                  standard: admission?.standard || '',
                  sessionName: admission?.session?.displayName || admission?.session?.name,
                  branchName: admission?.branch?.name,
                  totalFees: admission?.feePlan?.totalFees || 0,
                  helpline: settings?.phone,
                })
                openWhatsApp(student.parentPhone, msg)
              }}
              className="gap-2 text-emerald-600 border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
              title="Send admission details to registered parent via WhatsApp"
            >
              <WhatsAppIcon className="w-4 h-4" />
              <span>WhatsApp Admission</span>
            </Button>
          )}
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
          <Button
            variant="destructive"
            onClick={() => {
              setDeleteConfirmText('')
              setIsDeleteDialogOpen(true)
            }}
            className="gap-2 bg-rose-600 hover:bg-rose-700 text-white"
            title="Permanently delete student and all linked fee/admission records"
          >
            <Trash2 className="w-4 h-4" />
            Delete Student
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
                {student.parentPhone && (
                  <button
                    type="button"
                    onClick={() => {
                      const msg = `Hello from ${settings?.institute_name || 'Sutawane Classes'} regarding ${student.fullName}.`
                      openWhatsApp(student.parentPhone, msg)
                    }}
                    className="p-1 rounded text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                    title="Open WhatsApp chat with parent"
                  >
                    <WhatsAppIcon className="w-3.5 h-3.5" />
                  </button>
                )}
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
          {/* Multi-Session Admission Switcher Tabs */}
          {student.allAdmissions && student.allAdmissions.length > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-muted/40 rounded-lg border">
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <Calendar className="w-4 h-4 text-primary" />
                <span>Inspect Session Admission:</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {student.allAdmissions.map((adm: any) => {
                  const isSelected = (selectedAdmissionId || student.currentAdmission?.id) === adm.id
                  return (
                    <Button
                      key={adm.id}
                      size="sm"
                      variant={isSelected ? 'default' : 'outline'}
                      onClick={() => setSelectedAdmissionId(adm.id)}
                      className="text-xs h-7 gap-1"
                    >
                      <span>{adm.sessionName} ({adm.standard})</span>
                      {adm.pendingFees > 0 ? (
                        <Badge variant="danger" className="text-[9px] py-0 px-1">
                          Due: {formatCurrency(adm.pendingFees)}
                        </Badge>
                      ) : (
                        <Badge variant="success" className="text-[9px] py-0 px-1">
                          Settled
                        </Badge>
                      )}
                    </Button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Fee KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border-blue-200 bg-blue-50/30 dark:bg-blue-950/20">
              <CardHeader className="py-2.5 pb-1 px-3">
                <CardTitle className="text-[10px] font-semibold uppercase text-muted-foreground">
                  Session Agreed Fee
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-2.5">
                <div className="text-xl font-bold text-foreground">
                  {formatCurrency(fee.netPayable)}
                </div>
                {fee.totalDiscount > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    (Disc: {formatCurrency(fee.totalDiscount)})
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border-emerald-200 bg-emerald-50/30 dark:bg-emerald-950/20">
              <CardHeader className="py-2.5 pb-1 px-3">
                <CardTitle className="text-[10px] font-semibold uppercase text-muted-foreground">
                  Session Fees Paid
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-2.5">
                <div className="text-xl font-bold text-emerald-600">
                  {formatCurrency(fee.totalPaid)}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  This session only
                </p>
              </CardContent>
            </Card>

            <Card className="border-rose-200 bg-rose-50/30 dark:bg-rose-950/20">
              <CardHeader className="py-2.5 pb-1 px-3">
                <CardTitle className="text-[10px] font-semibold uppercase text-muted-foreground">
                  Session Remaining
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-2.5">
                <div className="text-xl font-bold text-rose-600">
                  {formatCurrency(fee.totalPending)}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Current session due
                </p>
              </CardContent>
            </Card>

            <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/30">
              <CardHeader className="py-2.5 pb-1 px-3">
                <CardTitle className="text-[10px] font-bold uppercase text-amber-800 dark:text-amber-300">
                  Overall Outstanding
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-2.5">
                <div className="text-xl font-extrabold text-amber-800 dark:text-amber-200">
                  {formatCurrency(fee.overallPendingAmount ?? fee.totalPending)}
                </div>
                {fee.previousDuesPending > 0 && (
                  <p className="text-[10px] text-rose-600 font-medium mt-0.5">
                    (Incl. {formatCurrency(fee.previousDuesPending)} prior)
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Fee Payment Progress & Flexible Summary */}
          <Card>
            <CardHeader className="py-3 px-4 bg-muted/20 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-primary" />
                  Fee Settlement Progress
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Flexible payments active — pay any amount at any time without fixed installment restrictions.
                </p>
              </div>
              <Badge variant={fee.totalPending === 0 ? 'success' : 'warning'}>
                {fee.totalPending === 0 ? 'Fully Paid & Settled' : `${formatCurrency(fee.totalPending)} Remaining`}
              </Badge>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>
                  Progress:{' '}
                  {Math.min(
                    100,
                    fee.netPayable > 0 ? Math.round((fee.totalPaid / fee.netPayable) * 100) : 0
                  )}
                  % Paid
                </span>
                <span className="text-muted-foreground font-mono">
                  {formatCurrency(fee.totalPaid)} / {formatCurrency(fee.netPayable)}
                </span>
              </div>
              {/* Progress Bar */}
              <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-emerald-600 h-2.5 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      fee.netPayable > 0 ? Math.round((fee.totalPaid / fee.netPayable) * 100) : 0
                    )}%`,
                  }}
                />
              </div>
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
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Click "Collect Fees" to record a fee payment for {student.fullName}.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => {
                      const pendingAmt = fee?.overallPendingAmount ?? fee?.totalPending ?? admission?.pendingFees ?? ''
                      navigate(
                        `/fees/collect?studentId=${student.id}&admissionId=${admission?.id || ''}&amount=${pendingAmt}`
                      )
                    }}
                    className="mt-3 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    Collect Fees Now
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-[#28375C] text-white">
                    <TableRow className="border-b border-[#1b2640] hover:bg-[#28375C] bg-[#28375C]">
                      <TableHead className="text-white font-semibold">Receipt No.</TableHead>
                      <TableHead className="text-white font-semibold">Date</TableHead>
                      <TableHead className="text-white font-semibold">Payment Mode</TableHead>
                      <TableHead className="text-white font-semibold">Notes</TableHead>
                      <TableHead className="text-white font-semibold">Amount</TableHead>
                      <TableHead className="text-right text-white font-semibold pr-4">Action</TableHead>
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
                          {student.parentPhone && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const msg = buildReceiptWhatsAppMessage({
                                  instituteName: settings?.institute_name,
                                  studentName: student.fullName,
                                  rollNumber: admission?.rollNumber,
                                  standard: admission?.standard,
                                  receiptNumber: p.receiptNumber,
                                  totalAmount: p.totalAmount,
                                  paymentDate: p.paymentDate,
                                  paymentMode: p.paymentMode,
                                  referenceNumber: p.referenceNumber,
                                  remainingBalance: admission?.balanceRemaining,
                                  branchName: admission?.branch?.name,
                                  helpline: settings?.phone,
                                })
                                openWhatsApp(student.parentPhone, msg)
                              }}
                              className="h-8 gap-1 text-xs text-emerald-600 border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 ml-1"
                              title="Send receipt to registered parent via WhatsApp"
                            >
                              <WhatsAppIcon className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">WhatsApp</span>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Previous Session Carried-Forward Dues Card */}
          {student.previousSessionDues && student.previousSessionDues.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/20 dark:bg-amber-950/10">
              <CardHeader className="py-4">
                <CardTitle className="text-base font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <ClockAlert className="w-4 h-4" />
                  Carried-Forward Dues from Previous Sessions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader className="bg-[#28375C] text-white">
                    <TableRow className="border-b border-[#1b2640] hover:bg-[#28375C] bg-[#28375C]">
                      <TableHead className="text-white font-semibold">Original Session</TableHead>
                      <TableHead className="text-white font-semibold">Description / Reference</TableHead>
                      <TableHead className="text-white font-semibold">Carried Amount</TableHead>
                      <TableHead className="text-white font-semibold">Recovered</TableHead>
                      <TableHead className="text-white font-semibold">Balance Due</TableHead>
                      <TableHead className="text-right text-white font-semibold pr-4">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {student.previousSessionDues.map((due: any) => (
                      <TableRow key={due.id}>
                        <TableCell className="font-semibold text-foreground">
                          {due.originalSessionName || 'Prior Session'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {due.description || 'Carried forward unpaid tuition'}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {formatCurrency(due.outstandingAmount)}
                        </TableCell>
                        <TableCell className="text-emerald-600 font-medium">
                          {formatCurrency(due.collectedAmount)}
                        </TableCell>
                        <TableCell className="text-rose-600 font-bold">
                          {formatCurrency(due.balanceRemaining)}
                        </TableCell>
                        <TableCell className="text-right space-x-1.5 whitespace-nowrap">
                          <Badge variant={due.balanceRemaining === 0 ? 'success' : 'danger'}>
                            {due.balanceRemaining === 0 ? 'Settled' : 'Pending Recovery'}
                          </Badge>
                          {due.balanceRemaining > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                navigate(
                                  `/fees/collect?studentId=${student.id}&previousDueId=${due.id}&amount=${due.balanceRemaining}`
                                )
                              }
                              className="h-6 px-1.5 text-[10px] text-emerald-700 border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 gap-1 font-medium"
                              title="Collect this carried due"
                            >
                              <CreditCard className="w-3 h-3 text-emerald-600" />
                              Collect
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Academic Journey / Multi-Session History Card */}
          {student.allAdmissions && student.allAdmissions.length > 0 && (
            <Card>
              <CardHeader className="py-4">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <History className="w-4 h-4 text-primary" />
                  Academic Session Progression History ({student.allAdmissions.length} Sessions)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader className="bg-[#28375C] text-white">
                    <TableRow className="border-b border-[#1b2640] hover:bg-[#28375C] bg-[#28375C]">
                      <TableHead className="text-white font-semibold">Academic Session</TableHead>
                      <TableHead className="text-white font-semibold">Class / Standard</TableHead>
                      <TableHead className="text-white font-semibold">Branch</TableHead>
                      <TableHead className="text-white font-semibold">Roll Number</TableHead>
                      <TableHead className="text-white font-semibold">Enrolled Date</TableHead>
                      <TableHead className="text-right text-white font-semibold pr-4">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {student.allAdmissions.map((adm: any) => (
                      <TableRow key={adm.id}>
                        <TableCell className="font-semibold text-foreground">
                          {adm.sessionName}
                        </TableCell>
                        <TableCell className="font-medium">{adm.standard}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{adm.branchName}</TableCell>
                        <TableCell className="font-mono text-xs">{adm.rollNumber}</TableCell>
                        <TableCell className="text-xs">{formatDate(adm.admissionDate)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={adm.isActive ? 'success' : 'outline'}>
                            {adm.isActive ? 'Active Batch' : 'Completed / Archived'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
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
                  <select
                    value={standard}
                    onChange={(e) => setStandard(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none"
                  >
                    {standard && !courses.some((c) => c.name.toLowerCase() === standard.toLowerCase()) && (
                      <option value={standard}>{standard} (Current)</option>
                    )}
                    {courses.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name} {c.code ? `(${c.code})` : ''} {!c.isActive ? '(Archived)' : ''}
                      </option>
                    ))}
                  </select>
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
                : `Archiving will remove ${student.fullName} from active student lists. All historical financial ledgers, payment transactions, and receipts will be safely preserved in the database permanently.`}
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

      {/* Strict Permanent Deletion Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md border-rose-500/30">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <AlertDialogTitle className="text-base font-bold text-rose-700 dark:text-rose-400">
                  Strict Warning: Permanent Student Deletion
                </AlertDialogTitle>
                <p className="text-xs text-muted-foreground font-normal">
                  This action is completely destructive and CANNOT be undone.
                </p>
              </div>
            </div>
            <div className="space-y-3 pt-3 text-xs text-foreground">
              <div className="p-3 bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-lg space-y-1.5 text-rose-950 dark:text-rose-200 text-left">
                <p className="font-semibold text-xs flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  All of the following records will be permanently erased:
                </p>
                <div className="pl-4 text-[11px] space-y-1">
                  <p>• Student Profile: <strong>{student.fullName}</strong> (ID: {student.studentCode}, Roll: {admission?.rollNumber || '—'})</p>
                  <p>• All Academic Admissions & Session Progression records</p>
                  <p>• All Fee Commitments, Plans & Installment schedules</p>
                  <p>• All Fee Payment Transactions, Allocations & Official Receipts</p>
                  <p>• All Prior Dues & Outstanding Ledgers</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-left">
                If you only wish to hide this student from active lists while preserving financial receipts for accounting audits, click <strong>Cancel</strong> and choose <strong>Archive</strong> instead.
              </p>

              <div className="space-y-1.5 pt-1 text-left">
                <label className="text-[11px] font-semibold text-foreground block">
                  To confirm permanent deletion, type <span className="font-mono font-bold text-rose-600 select-all">DELETE</span> below:
                </label>
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type DELETE here"
                  className="h-9 text-xs border-rose-300 focus-visible:ring-rose-500 font-mono tracking-wider"
                  autoFocus
                />
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0 pt-2">
            <AlertDialogCancel
              onClick={() => {
                setIsDeleteDialogOpen(false)
                setDeleteConfirmText('')
              }}
              disabled={deleteMutation.isPending}
              className="text-xs"
            >
              Cancel & Keep Student
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteConfirmText.trim().toUpperCase() !== 'DELETE' || deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
              className="gap-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {deleteMutation.isPending ? 'Deleting Student & Records...' : 'Permanently Delete Everything'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Official A4 Dual-Copy Printable Receipt Modal */}
      <FeeReceiptModal
        receipt={
          selectedReceipt && student
            ? {
                receiptNumber: selectedReceipt.receiptNumber,
                paymentDate: selectedReceipt.paymentDate,
                totalAmount: selectedReceipt.totalAmount,
                paymentMode: selectedReceipt.paymentMode,
                referenceNumber: selectedReceipt.referenceNumber,
                notes: selectedReceipt.notes,
                isReversed: selectedReceipt.isReversed,
                reversalReason: selectedReceipt.reversalReason,
                studentName: student.fullName,
                studentCode: student.studentCode,
                rollNumber: admission?.rollNumber,
                standard: admission?.standard,
                branchName: admission?.branch?.name,
                branchCode: admission?.branch?.code,
                sessionName: admission?.session?.name,
                remainingBalance: admission?.balanceRemaining,
                allocations: selectedReceipt.allocations,
              }
            : null
        }
        onClose={() => setSelectedReceipt(null)}
      />

      {/* Promote Student Modal */}
      {student && (
        <PromoteStudentModal
          isOpen={isPromoteDialogOpen}
          onClose={() => setIsPromoteDialogOpen(false)}
          studentId={student.id}
          studentName={student.fullName}
          currentAdmission={admission}
          onSuccess={(msg) => {
            showToast(msg)
            refetch()
          }}
        />
      )}
    </div>
  )
}
