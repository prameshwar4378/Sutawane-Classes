import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useApp, type AcademicSession } from '@/context/AppContext'
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
import { CalendarDays, Plus, CheckCircle, Star } from 'lucide-react'

export const SessionsPage: React.FC = () => {
  const queryClient = useQueryClient()
  const { refetchMeta } = useApp()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingSession, setEditingSession] = useState<AcademicSession | null>(null)

  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isCurrent, setIsCurrent] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const { data: sessions = [], isLoading } = useQuery<AcademicSession[]>({
    queryKey: ['sessions'],
    queryFn: () => api.get('/sessions'),
  })

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingSession) {
        return api.put(`/sessions/${editingSession.id}`, data)
      } else {
        return api.post('/sessions', data)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      refetchMeta()
      closeDialog()
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to save session')
    },
  })

  const setCurrentMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.patch(`/sessions/${id}/set-current`, {})
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      refetchMeta()
    },
  })

  const openCreateDialog = () => {
    setEditingSession(null)
    setName('')
    setDisplayName('')
    setStartDate('')
    setEndDate('')
    setIsCurrent(false)
    setErrorMsg('')
    setIsDialogOpen(true)
  }

  const closeDialog = () => {
    setIsDialogOpen(false)
    setEditingSession(null)
    setErrorMsg('')
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setErrorMsg('Session Name is required (e.g. 2026-27)')
      return
    }
    saveMutation.mutate({
      name: name.trim(),
      displayName: displayName.trim() || `Academic Session ${name.trim()}`,
      startDate: startDate || new Date().toISOString(),
      endDate: endDate || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
      isCurrent,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-emerald-600" />
            Academic Session Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage academic batches (2026–27, 2027–28). Historical records are preserved permanently.
          </p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="w-4 h-4" />
          Create New Session
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Configured Academic Years</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Loading sessions...</p>
          ) : sessions.length === 0 ? (
            <div className="py-8 text-center border rounded-lg border-dashed">
              <CalendarDays className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">No academic sessions found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Create your first academic session (e.g., 2026–27) to begin.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session Code</TableHead>
                  <TableHead>Display Title</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono font-bold text-foreground">{s.name}</TableCell>
                    <TableCell>{s.displayName}</TableCell>
                    <TableCell>{new Date(s.startDate).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(s.endDate).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {s.isCurrent ? (
                        <Badge variant="success" className="gap-1">
                          <Star className="w-3 h-3 fill-current" />
                          Current Active
                        </Badge>
                      ) : (
                        <Badge variant="outline">Archive / Past</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!s.isCurrent && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentMutation.mutate(s.id)}
                          disabled={setCurrentMutation.isPending}
                        >
                          Set as Current
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

      {/* Dialog for Add Session */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>Create Academic Session</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {errorMsg && (
                <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
                  {errorMsg}
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Session Name (e.g. 2026-27) *</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="2026-27"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Display Label</label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Academic Year 2026–2027"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Start Date</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">End Date</label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isCurrent"
                  checked={isCurrent}
                  onChange={(e) => setIsCurrent(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <label htmlFor="isCurrent" className="text-sm text-foreground cursor-pointer">
                  Set this as the current active academic session
                </label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : 'Create Session'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
