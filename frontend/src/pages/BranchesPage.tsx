import React, { useState } from 'react'
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
import { Building2, Plus, Edit2, CheckCircle2, XCircle } from 'lucide-react'

export const BranchesPage: React.FC = () => {
  const queryClient = useQueryClient()
  const { refetchMeta } = useApp()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null)

  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const { data: branches = [], isLoading } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: () => api.get('/branches'),
  })

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingBranch) {
        return api.put(`/branches/${editingBranch.id}`, data)
      } else {
        return api.post('/branches', data)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] })
      refetchMeta()
      closeDialog()
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to save branch')
    },
  })

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return api.patch(`/branches/${id}/status`, { isActive })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] })
      refetchMeta()
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
    setIsDialogOpen(true)
  }

  const closeDialog = () => {
    setIsDialogOpen(false)
    setEditingBranch(null)
    setErrorMsg('')
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            Branch Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your 5–6 coaching branches. All students, fees, and expenses are isolated per branch.
          </p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="w-4 h-4" />
          Add New Branch
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Active & Registered Branches</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Loading branches...</p>
          ) : branches.length === 0 ? (
            <div className="py-8 text-center border rounded-lg border-dashed">
              <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">No branches configured yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Add your main branch and satellite branches to get started.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
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
                {branches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-semibold text-foreground">{b.name}</TableCell>
                    <TableCell className="font-mono text-xs">{b.code}</TableCell>
                    <TableCell>{b.contactPerson || '—'}</TableCell>
                    <TableCell>{b.phone || '—'}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{b.address || '—'}</TableCell>
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
                        className="h-8 gap-1"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit
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
                        className="h-8"
                      >
                        {b.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog for Add / Edit */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>
                {editingBranch ? 'Edit Branch' : 'Add New Branch'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {errorMsg && (
                <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
                  {errorMsg}
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Branch Name *</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Nagpur Main Branch"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Branch Code (3-4 letters) *</label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. NGP"
                  maxLength={6}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Contact Person</label>
                  <Input
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="Branch Manager / Incharge"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Phone Number</label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="10-digit number"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Address</label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Full branch address"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : 'Save Branch'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
