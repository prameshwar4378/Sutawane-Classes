import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useApp, type Course } from '@/context/AppContext'
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
  BookOpen,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Users,
  Search,
  RotateCw,
  AlertCircle,
  GraduationCap,
  Sparkles,
} from 'lucide-react'

export const CoursesPage: React.FC = () => {
  const queryClient = useQueryClient()
  const { refetchCourses } = useApp()

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Form states
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [defaultFee, setDefaultFee] = useState('')
  const [sortOrder, setSortOrder] = useState('0')
  const [isActive, setIsActive] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [toastMsg, setToastMsg] = useState('')

  const { data: courses = [], isLoading, refetch } = useQuery<Course[]>({
    queryKey: ['courses'],
    queryFn: () => api.get('/courses'),
  })

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 4000)
  }

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingCourse) {
        return api.put(`/courses/${editingCourse.id}`, payload)
      } else {
        return api.post('/courses', payload)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] })
      refetchCourses()
      closeDialog()
      showToast(editingCourse ? 'Course updated successfully!' : 'New course created successfully!')
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to save course')
    },
  })

  // Toggle active status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: boolean }) => {
      return api.put(`/courses/${id}`, { isActive: newStatus })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] })
      refetchCourses()
      showToast('Course status updated!')
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to update course status')
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/courses/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] })
      refetchCourses()
      setCourseToDelete(null)
      showToast('Course deleted successfully!')
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to delete course')
    },
  })

  const openCreateDialog = () => {
    setEditingCourse(null)
    setName('')
    setCode('')
    setDescription('')
    setDefaultFee('')
    setSortOrder(String((courses.length + 1) * 10))
    setIsActive(true)
    setErrorMsg('')
    setIsDialogOpen(true)
  }

  const openEditDialog = (c: Course) => {
    setEditingCourse(c)
    setName(c.name)
    setCode(c.code || '')
    setDescription(c.description || '')
    setDefaultFee(c.defaultFee !== null && c.defaultFee !== undefined ? String(c.defaultFee) : '')
    setSortOrder(String(c.sortOrder || 0))
    setIsActive(c.isActive)
    setErrorMsg('')
    setIsDialogOpen(true)
  }

  const closeDialog = () => {
    setIsDialogOpen(false)
    setEditingCourse(null)
    setErrorMsg('')
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setErrorMsg('Course / Class name is required')
      return
    }

    saveMutation.mutate({
      name: name.trim(),
      code: code.trim() ? code.trim().toUpperCase() : null,
      description: description.trim() || null,
      defaultFee: defaultFee ? Number(defaultFee) : null,
      sortOrder: Number(sortOrder) || 0,
      isActive,
    })
  }

  // Filtered courses
  const filteredCourses = courses.filter((c) => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return true
    return (
      c.name.toLowerCase().includes(q) ||
      (c.code && c.code.toLowerCase().includes(q)) ||
      (c.description && c.description.toLowerCase().includes(q))
    )
  })

  // KPI calculations
  const totalCourses = courses.length
  const activeCount = courses.filter((c) => c.isActive).length
  const inactiveCount = totalCourses - activeCount
  const totalEnrolled = courses.reduce((sum, c) => sum + (c.enrolledCount || 0), 0)

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 bg-foreground text-background px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {toastMsg}
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" />
            Classes & Courses Management
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure dynamic standards, coaching programs, fee schedules, and view enrolled students.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetch()
              refetchCourses()
            }}
            className="gap-1.5"
          >
            <RotateCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
          <Button onClick={openCreateDialog} size="sm" className="gap-1.5 bg-primary">
            <Plus className="w-4 h-4" />
            Add New Course
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Courses</p>
                <p className="text-2xl font-bold text-foreground mt-0.5">{totalCourses}</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <BookOpen className="w-4 h-4" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Active Offerings</p>
                <p className="text-2xl font-bold text-emerald-600 mt-0.5">{activeCount}</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Inactive / Archived</p>
                <p className="text-2xl font-bold text-muted-foreground mt-0.5">{inactiveCount}</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <XCircle className="w-4 h-4" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Enrolled Students</p>
                <p className="text-2xl font-bold text-primary mt-0.5">{totalEnrolled}</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Course List & Search */}
      <Card>
        <CardHeader className="py-4 border-b">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-primary" />
              All Standard Classes & Courses ({filteredCourses.length})
            </CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Search classes or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs h-9"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-[#28375C] text-white">
                <TableRow className="border-b border-[#1b2640] hover:bg-[#28375C] bg-[#28375C]">
                  <TableHead className="w-16 text-center text-white font-semibold">Order</TableHead>
                  <TableHead className="text-white font-semibold">Class / Course Name</TableHead>
                  <TableHead className="text-white font-semibold">Code</TableHead>
                  <TableHead className="text-white font-semibold">Default Fee</TableHead>
                  <TableHead className="text-white font-semibold">Enrolled</TableHead>
                  <TableHead className="text-white font-semibold">Status</TableHead>
                  <TableHead className="text-white font-semibold">Description</TableHead>
                  <TableHead className="text-right text-white font-semibold pr-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-sm">
                      Loading courses and curriculum...
                    </TableCell>
                  </TableRow>
                ) : filteredCourses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <BookOpen className="w-8 h-8 text-muted-foreground/50" />
                        <p className="text-sm font-medium">No courses found matching your criteria</p>
                        <Button variant="outline" size="sm" onClick={openCreateDialog} className="mt-2">
                          <Plus className="w-4 h-4 mr-1" /> Add Your First Course
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCourses.map((c) => (
                    <TableRow key={c.id} className="hover:bg-muted/40">
                      <TableCell className="text-center font-mono text-xs text-muted-foreground">
                        {c.sortOrder}
                      </TableCell>
                      <TableCell className="font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          <span>{c.name}</span>
                          {!c.isActive && (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground py-0">
                              Archived
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {c.code ? (
                          <Badge variant="secondary" className="font-mono text-[11px]">
                            {c.code}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell className="font-semibold text-foreground">
                        {c.defaultFee !== null && c.defaultFee !== undefined ? (
                          <span>₹{c.defaultFee.toLocaleString('en-IN')}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs font-normal">Custom</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="bg-primary/5 text-primary border-primary/20 gap-1 text-xs font-medium"
                        >
                          <Users className="w-3 h-3" />
                          {c.enrolledCount || 0}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {c.isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/10 text-gray-500 border border-gray-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                            Inactive
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">
                        {c.description || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs"
                            onClick={() => openEditDialog(c)}
                            title="Edit course details"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-muted-foreground mr-1" />
                            Edit
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs"
                            onClick={() =>
                              toggleStatusMutation.mutate({ id: c.id, newStatus: !c.isActive })
                            }
                            title={c.isActive ? 'Deactivate course' : 'Activate course'}
                          >
                            {c.isActive ? (
                              <span className="text-amber-600 flex items-center gap-1">
                                <XCircle className="w-3.5 h-3.5" />
                                Deactivate
                              </span>
                            ) : (
                              <span className="text-emerald-600 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Activate
                              </span>
                            )}
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            onClick={() => setCourseToDelete(c)}
                            title="Delete course"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add / Edit Course Modal */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              {editingCourse ? 'Edit Class / Course' : 'Create New Class / Course'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 py-2">
            {errorMsg && (
              <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-md flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Class / Course Name *
              </label>
              <Input
                placeholder="e.g. Class 10, Class 11 Science, MHT-CET Foundation"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <p className="text-[11px] text-muted-foreground">
                This exact name will appear in admission forms, filters, and fee receipts.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Course Code</label>
                <Input
                  placeholder="e.g. C10, C11-SCI"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="font-mono uppercase"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Default Session Fee (₹)
                </label>
                <Input
                  type="number"
                  placeholder="e.g. 25000"
                  min="0"
                  step="500"
                  value={defaultFee}
                  onChange={(e) => setDefaultFee(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Sort Order</label>
                <Input
                  type="number"
                  placeholder="e.g. 1, 2, 3..."
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Controls order in dropdowns.
                </p>
              </div>

              <div className="space-y-1.5 flex flex-col justify-end">
                <label className="flex items-center gap-2 cursor-pointer pt-2">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-xs font-semibold text-foreground">
                    Active & Available for Admissions
                  </span>
                </label>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Description & Notes</label>
              <textarea
                placeholder="Optional course details, syllabus overview, or batch timings..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full text-xs rounded-md border border-input bg-background p-2.5 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={closeDialog}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saveMutation.isPending}
                className="bg-primary"
              >
                {saveMutation.isPending ? 'Saving...' : editingCourse ? 'Update Course' : 'Create Course'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete / Deactivate Warning Dialog */}
      {courseToDelete && (
        <Dialog open={Boolean(courseToDelete)} onOpenChange={(open) => !open && setCourseToDelete(null)}>
          <DialogContent className="sm:max-w-[450px]">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2 text-rose-600">
                <AlertCircle className="w-5 h-5 text-rose-600" />
                Delete Course: {courseToDelete.name}
              </DialogTitle>
            </DialogHeader>

            <div className="py-3 text-xs space-y-3">
              {(courseToDelete.enrolledCount || 0) > 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-md space-y-2">
                  <p className="font-semibold text-amber-900">
                    Cannot delete this course because {courseToDelete.enrolledCount} student admission(s) are currently enrolled in it.
                  </p>
                  <p>
                    To protect historical admission records and financial ledgers, courses with active or past enrollments cannot be deleted.
                  </p>
                  <p className="font-medium text-amber-950">
                    Recommendation: Deactivate this course instead so that it will be hidden from new admission forms.
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  Are you sure you want to delete <strong className="text-foreground">{courseToDelete.name}</strong>? This action cannot be undone.
                </p>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCourseToDelete(null)}
              >
                Close
              </Button>

              {(courseToDelete.enrolledCount || 0) > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  onClick={() => {
                    toggleStatusMutation.mutate({ id: courseToDelete.id, newStatus: false })
                    setCourseToDelete(null)
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  Deactivate Course Instead
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(courseToDelete.id)}
                >
                  {deleteMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
export default CoursesPage
