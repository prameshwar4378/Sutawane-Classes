import React, { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useApp, type Branch } from '@/context/AppContext'
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
  Building2,
  Plus,
  Edit2,
  CheckCircle2,
  XCircle,
  Upload,
  Trash2,
  Image as ImageIcon,
  AlertCircle,
} from 'lucide-react'

export const BranchesPage: React.FC = () => {
  const queryClient = useQueryClient()
  const { refetchMeta, settings } = useApp()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null)

  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [toastMsg, setToastMsg] = useState('')

  // Branch logo staging state
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null)
  const [pendingLogoPreview, setPendingLogoPreview] = useState<string | null>(null)

  const { data: branches = [], isLoading } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: () => api.get('/branches'),
  })

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 4000)
  }

  // Save Branch mutation
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      let branchResult: Branch
      if (editingBranch) {
        branchResult = await api.put(`/branches/${editingBranch.id}`, data)
      } else {
        branchResult = await api.post('/branches', data)
      }

      // If a pending logo file was selected, upload it now
      if (pendingLogoFile && branchResult.id) {
        const formData = new FormData()
        formData.append('logo', pendingLogoFile)
        await api.post(`/branches/${branchResult.id}/logo`, formData)
      }

      return branchResult
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] })
      refetchMeta()
      closeDialog()
      showToast(editingBranch ? 'Branch updated successfully!' : 'New branch created successfully!')
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to save branch')
    },
  })

  // Direct Branch Logo Upload mutation (for editing branch)
  const uploadLogoMutation = useMutation({
    mutationFn: async ({ branchId, file }: { branchId: string; file: File }) => {
      const formData = new FormData()
      formData.append('logo', file)
      return api.post(`/branches/${branchId}/logo`, formData)
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['branches'] })
      refetchMeta()
      setPendingLogoPreview(res.logoUrl)
      setPendingLogoFile(null)
      showToast('Branch-specific logo uploaded successfully!')
      if (editingBranch) {
        setEditingBranch({ ...editingBranch, logoUrl: res.logoUrl })
      }
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to upload branch logo')
    },
  })

  // Remove Branch Logo mutation
  const removeLogoMutation = useMutation({
    mutationFn: async (branchId: string) => {
      return api.delete(`/branches/${branchId}/logo`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] })
      refetchMeta()
      setPendingLogoPreview(null)
      setPendingLogoFile(null)
      if (editingBranch) {
        setEditingBranch({ ...editingBranch, logoUrl: null })
      }
      showToast('Branch logo removed. Will now use Master Institute Logo.')
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to remove branch logo')
    },
  })

  // Toggle active status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return api.patch(`/branches/${id}/status`, { isActive })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] })
      refetchMeta()
      showToast('Branch status updated successfully!')
    },
  })

  const openCreateDialog = () => {
    setEditingBranch(null)
    setName('')
    setCode('')
    setAddress('')
    setPhone('')
    setContactPerson('')
    setErrorMsg('')
    setPendingLogoFile(null)
    setPendingLogoPreview(null)
    setIsDialogOpen(true)
  }

  const openEditDialog = (b: Branch) => {
    setEditingBranch(b)
    setName(b.name)
    setCode(b.code)
    setAddress(b.address || '')
    setPhone(b.phone || '')
    setContactPerson(b.contactPerson || '')
    setErrorMsg('')
    setPendingLogoFile(null)
    setPendingLogoPreview(b.logoUrl || null)
    setIsDialogOpen(true)
  }

  const closeDialog = () => {
    setIsDialogOpen(false)
    setEditingBranch(null)
    setErrorMsg('')
    setPendingLogoFile(null)
    setPendingLogoPreview(null)
  }

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrorMsg('Logo file size must not exceed 5 MB')
        return
      }

      // If currently editing an existing branch, upload immediately
      if (editingBranch) {
        uploadLogoMutation.mutate({ branchId: editingBranch.id, file })
      } else {
        // Stage for upload after branch creation
        setPendingLogoFile(file)
        const reader = new FileReader()
        reader.onloadend = () => {
          setPendingLogoPreview(reader.result as string)
        }
        reader.readAsDataURL(file)
      }
    }
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !code.trim()) {
      setErrorMsg('Branch Name and Code are required')
      return
    }
    saveMutation.mutate({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      address: address.trim() || null,
      phone: phone.trim() || null,
      contactPerson: contactPerson.trim() || null,
    })
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            Branch &amp; Center Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your 5–6 coaching branches, customize individual branch logos, and isolate academic data.
          </p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="w-4 h-4" />
          Add New Branch
        </Button>
      </div>

      {/* Branches Table */}
      <Card>
        <CardHeader className="py-4 border-b bg-muted/20">
          <CardTitle className="text-base font-semibold">Active &amp; Registered Branches</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading branches...</p>
          ) : branches.length === 0 ? (
            <div className="py-12 text-center border rounded-lg border-dashed m-4">
              <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">No branches configured yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Add your main branch and satellite branches to get started.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-16">Logo</TableHead>
                  <TableHead>Branch Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Contact Person</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branches.map((b) => {
                  const effectiveLogo = b.logoUrl || settings?.logo_url
                  const hasCustomLogo = Boolean(b.logoUrl)

                  return (
                    <TableRow key={b.id} className="hover:bg-muted/40 transition-colors">
                      {/* Logo Column */}
                      <TableCell>
                        <div className="w-9 h-9 rounded-lg border bg-background flex items-center justify-center overflow-hidden p-0.5 shadow-xs">
                          {effectiveLogo ? (
                            <img
                              src={effectiveLogo}
                              alt=""
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <Building2 className="w-4 h-4 text-muted-foreground/60" />
                          )}
                        </div>
                      </TableCell>

                      {/* Name with Logo Badge */}
                      <TableCell>
                        <div className="font-semibold text-foreground flex items-center gap-2">
                          <span>{b.name}</span>
                          {hasCustomLogo ? (
                            <Badge variant="outline" className="text-[9px] py-0 px-1 border-primary/40 text-primary">
                              Branch Logo
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] py-0 px-1 text-muted-foreground font-normal">
                              Master Logo
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="font-mono text-xs font-semibold">{b.code}</TableCell>
                      <TableCell className="text-xs">{b.contactPerson || '—'}</TableCell>
                      <TableCell className="text-xs font-mono">{b.phone || '—'}</TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{b.address || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={b.isActive ? 'success' : 'outline'}>
                          {b.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(b)}
                          className="h-8 gap-1 text-xs"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Edit / Logo
                        </Button>
                        <Button
                          variant={b.isActive ? 'secondary' : 'default'}
                          size="sm"
                          onClick={() =>
                            toggleStatusMutation.mutate({
                              id: b.id,
                              isActive: !b.isActive,
                            })
                          }
                          className="h-8 text-xs"
                        >
                          {b.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Branch Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Building2 className="w-4 h-4 text-primary" />
                {editingBranch ? 'Edit Branch Details & Logo' : 'Register New Coaching Branch'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-3 text-xs">
              {errorMsg && (
                <div className="p-3 bg-destructive/10 text-destructive border border-destructive/20 text-xs rounded-md flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Branch-Specific Logo Upload Section */}
              <div className="p-3 bg-muted/40 rounded-xl border space-y-2">
                <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-primary" />
                    Branch-Specific Logo (Optional)
                  </span>
                  {pendingLogoPreview ? (
                    <Badge variant="outline" className="text-[10px] py-0 text-primary border-primary/40">
                      Custom Logo
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] py-0 text-muted-foreground font-normal">
                      Using Master Logo
                    </Badge>
                  )}
                </label>

                <div className="flex items-center gap-3">
                  {/* Logo Preview */}
                  <div className="w-16 h-16 rounded-lg border-2 border-dashed bg-background flex items-center justify-center overflow-hidden p-1 flex-shrink-0">
                    {pendingLogoPreview ? (
                      <img
                        src={pendingLogoPreview}
                        alt="Branch Logo"
                        className="w-full h-full object-contain"
                      />
                    ) : settings?.logo_url ? (
                      <img
                        src={settings.logo_url}
                        alt="Master Logo"
                        className="w-full h-full object-contain opacity-60"
                        title="Currently using default master logo"
                      />
                    ) : (
                      <Building2 className="w-6 h-6 text-muted-foreground/40" />
                    )}
                  </div>

                  <div className="space-y-1.5 flex-1 text-[11px]">
                    <p className="text-muted-foreground">
                      {pendingLogoPreview
                        ? 'Custom logo is active for this branch.'
                        : 'If no logo is uploaded, the common master logo from Settings is used.'}
                    </p>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png, image/jpeg, image/webp, image/svg+xml"
                      onChange={handleLogoFileChange}
                      className="hidden"
                    />

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadLogoMutation.isPending}
                        className="h-7 text-[11px] gap-1 px-2.5"
                      >
                        <Upload className="w-3 h-3" />
                        {pendingLogoPreview ? 'Change Logo' : 'Upload Custom Logo'}
                      </Button>

                      {pendingLogoPreview && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (editingBranch) {
                              removeLogoMutation.mutate(editingBranch.id)
                            } else {
                              setPendingLogoFile(null)
                              setPendingLogoPreview(null)
                            }
                          }}
                          disabled={removeLogoMutation.isPending}
                          className="h-7 text-[11px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Revert to Master
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Branch Name & Code */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-semibold">Branch Name *</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Nagpur Central Branch"
                    required
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Code *</label>
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="NGP"
                    maxLength={6}
                    required
                    className="font-mono text-xs uppercase"
                  />
                </div>
              </div>

              {/* Contact Person & Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Contact Person</label>
                  <Input
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="Branch Manager / Admin"
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Contact Phone</label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="10-digit mobile"
                    className="text-xs"
                  />
                </div>
              </div>

              {/* Address */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Branch Physical Address</label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street location, city, pin code"
                  className="text-xs"
                />
              </div>
            </div>

            <DialogFooter className="pt-2 border-t">
              <Button type="button" variant="outline" size="sm" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : editingBranch ? 'Update Branch' : 'Create Branch'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
