import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useApp } from '@/context/AppContext'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  User,
  X,
  Building2,
  GraduationCap,
  IndianRupee,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export interface StudentSearchItem {
  id: string
  admissionId?: string
  studentCode?: string
  fullName: string
  photoUrl?: string | null
  rollNumber: string
  standard: string
  branchId: string
  branchName: string
  branchCode?: string
  sessionId?: string
  sessionName?: string
  parentPhone: string
  studentPhone?: string | null
  totalFees: number
  paidFees: number
  pendingFees: number
  overallPendingAmount?: number
  isActive: boolean
}

interface StudentSearchAutocompleteProps {
  onSelectStudent: (student: StudentSearchItem) => void
  selectedStudent: StudentSearchItem | null
  onClearSelection: () => void
  branchId?: string | 'ALL'
  sessionId?: string
  placeholder?: string
  label?: string
  className?: string
  autoFocus?: boolean
  required?: boolean
}

export const StudentSearchAutocomplete: React.FC<StudentSearchAutocompleteProps> = ({
  onSelectStudent,
  selectedStudent,
  onClearSelection,
  branchId,
  sessionId,
  placeholder = 'Type student name, roll number, or phone...',
  label = 'Select Student',
  className = '',
  autoFocus = false,
  required = false,
}) => {
  const { selectedBranchId, selectedSessionId, currentBranch } = useApp()
  const effectiveBranchId = branchId !== undefined ? branchId : selectedBranchId
  const effectiveSessionId = sessionId !== undefined ? sessionId : selectedSessionId

  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Fetch students respecting the active branch filter
  const { data: students = [], isLoading } = useQuery<StudentSearchItem[]>({
    queryKey: ['students-autocomplete', effectiveBranchId, effectiveSessionId],
    queryFn: () =>
      api.get('/students', {
        branchId: effectiveBranchId !== 'ALL' ? effectiveBranchId : undefined,
        sessionId: effectiveSessionId || undefined,
        isActive: 'true', // by default search active students
      }),
  })

  // Filter students matching query
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      // If no query yet, show first 10 students for quick picking
      return students.slice(0, 10)
    }

    return students
      .filter((s) => {
        return (
          s.fullName?.toLowerCase().includes(q) ||
          s.rollNumber?.toLowerCase().includes(q) ||
          s.parentPhone?.includes(q) ||
          (s.studentCode && s.studentCode.toLowerCase().includes(q)) ||
          s.standard?.toLowerCase().includes(q)
        )
      })
      .slice(0, 20) // show up to 20 matching suggestions
  }, [students, query])

  // Reset highlight index when suggestions change
  useEffect(() => {
    setHighlightedIndex(-1)
  }, [suggestions])

  // Click outside to close suggestion dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Keyboard navigation handler
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true)
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        handleSelect(suggestions[highlightedIndex])
      } else if (suggestions.length === 1) {
        handleSelect(suggestions[0])
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  const handleSelect = (student: StudentSearchItem) => {
    onSelectStudent(student)
    setIsOpen(false)
    setQuery('')
  }

  const handleClear = () => {
    onClearSelection()
    setQuery('')
    setTimeout(() => {
      inputRef.current?.focus()
      setIsOpen(true)
    }, 50)
  }

  // Branch label badge
  const branchLabel = useMemo(() => {
    if (effectiveBranchId === 'ALL') {
      return 'All Branches'
    }
    const found = students[0]?.branchName
    return found || currentBranch?.name || 'Selected Branch'
  }, [effectiveBranchId, students, currentBranch])

  return (
    <div ref={containerRef} className={`space-y-1.5 ${className}`}>
      {/* Label and Branch scope indicator */}
      <div className="flex items-center justify-between text-xs">
        <label className="font-semibold text-foreground flex items-center gap-1.5">
          <span>{label}</span>
          {required && <span className="text-rose-500">*</span>}
        </label>
        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Building2 className="w-3 h-3 text-primary" />
          <span>Scope: <strong>{branchLabel}</strong></span>
          <span className="text-muted-foreground/60">({students.length} students)</span>
        </span>
      </div>

      {/* When student is selected: show rich preview card */}
      {selectedStudent ? (
        <div className="p-3 bg-primary/5 dark:bg-primary/10 border border-primary/30 rounded-lg flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3 min-w-0">
            {/* Student Photo */}
            <div className="w-10 h-10 rounded-full overflow-hidden bg-muted flex items-center justify-center border flex-shrink-0">
              {selectedStudent.photoUrl ? (
                <img
                  src={selectedStudent.photoUrl}
                  alt={selectedStudent.fullName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-5 h-5 text-muted-foreground" />
              )}
            </div>

            {/* Student Details */}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-foreground truncate">
                  {selectedStudent.fullName}
                </span>
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono">
                  {selectedStudent.rollNumber}
                </Badge>
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-primary border-primary/30">
                  {selectedStudent.standard}
                </Badge>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                <span className="flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {selectedStudent.branchName}
                </span>
                <span>•</span>
                <span>Parent: <strong className="text-foreground font-mono">{selectedStudent.parentPhone}</strong></span>
                <span>•</span>
                <span className="font-semibold text-rose-600 dark:text-rose-400">
                  Due: {formatCurrency(selectedStudent.overallPendingAmount ?? selectedStudent.pendingFees ?? 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Change Student Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClear}
            className="h-8 gap-1 text-xs flex-shrink-0 border-muted-foreground/30 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40"
          >
            <X className="w-3.5 h-3.5" />
            <span>Change</span>
          </Button>
        </div>
      ) : (
        /* Autocomplete Search Input with Floating Suggestions */
        <div className="relative">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground pointer-events-none" />
            <Input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setIsOpen(true)
              }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              autoFocus={autoFocus}
              className="pl-9 pr-8 text-xs h-9 bg-background focus:ring-primary"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Suggestions Dropdown Popup */}
          {isOpen && (
            <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-popover text-popover-foreground border rounded-lg shadow-xl overflow-hidden max-h-72 overflow-y-auto divide-y divide-border animate-in fade-in slide-in-from-top-1">
              {isLoading ? (
                <div className="p-4 text-xs text-center text-muted-foreground">
                  Loading students from {branchLabel}...
                </div>
              ) : suggestions.length === 0 ? (
                <div className="p-4 text-center text-xs space-y-1">
                  <p className="font-semibold text-foreground">No students found matching "{query}"</p>
                  <p className="text-[11px] text-muted-foreground">
                    Searched in <strong>{branchLabel}</strong>. Check spelling or select "All Branches" in header.
                  </p>
                </div>
              ) : (
                <>
                  <div className="p-1.5 bg-muted/40 text-[10px] font-semibold text-muted-foreground flex items-center justify-between px-3">
                    <span>
                      {query ? `Matching Students (${suggestions.length})` : `Available Students in ${branchLabel} (Top 10)`}
                    </span>
                    <span className="text-[10px]">Use ↑ ↓ arrows &amp; Enter to pick</span>
                  </div>

                  {suggestions.map((student, index) => {
                    const isHighlighted = index === highlightedIndex
                    const pendingDue = student.overallPendingAmount !== undefined ? student.overallPendingAmount : student.pendingFees || 0

                    return (
                      <div
                        key={student.id}
                        onMouseDown={(e) => {
                          e.preventDefault() // prevent input blur before click
                          handleSelect(student)
                        }}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        className={`p-2.5 px-3 flex items-center justify-between gap-3 text-xs cursor-pointer transition-colors ${
                          isHighlighted ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Photo avatar */}
                          <div className="w-7 h-7 rounded-full overflow-hidden bg-muted flex items-center justify-center border flex-shrink-0 text-[10px]">
                            {student.photoUrl ? (
                              <img src={student.photoUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-3.5 h-3.5 text-muted-foreground" />
                            )}
                          </div>

                          {/* Student Details */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-foreground truncate">
                                {student.fullName}
                              </span>
                              <span className="font-mono text-[10px] text-muted-foreground">
                                ({student.rollNumber})
                              </span>
                            </div>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                              <span>{student.standard}</span>
                              {effectiveBranchId === 'ALL' && (
                                <>
                                  <span>•</span>
                                  <span className="text-primary font-medium">{student.branchName}</span>
                                </>
                              )}
                              <span>•</span>
                              <span className="font-mono">Ph: {student.parentPhone}</span>
                            </div>
                          </div>
                        </div>

                        {/* Financial Dues Badge */}
                        <div className="text-right flex-shrink-0">
                          {pendingDue > 0 ? (
                            <Badge variant="danger" className="text-[10px] py-0 px-1.5 font-bold">
                              Due: {formatCurrency(pendingDue)}
                            </Badge>
                          ) : (
                            <Badge variant="success" className="text-[10px] py-0 px-1.5 font-semibold">
                              Cleared
                            </Badge>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
