import React, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'

export interface Branch {
  id: string
  name: string
  code: string
  address?: string | null
  phone?: string | null
  contactPerson?: string | null
  logoUrl?: string | null
  isActive: boolean
}

export interface AcademicSession {
  id: string
  name: string
  displayName: string
  startDate: string
  endDate: string
  isCurrent: boolean
  isActive: boolean
  _count?: {
    admissions?: number
    feePlans?: number
    payments?: number
  }
}

export interface InstituteSettings {
  institute_name: string
  tagline: string
  phone: string
  email: string
  address: string
  website: string
  receipt_footer: string
  logo_url: string | null
}

export interface Course {
  id: string
  name: string
  code?: string | null
  description?: string | null
  defaultFee?: number | null
  isActive: boolean
  sortOrder: number
  enrolledCount?: number
  createdAt?: string
  updatedAt?: string
}

export interface ContextGuard {
  id: string
  entityTitle: string
  canChangeBranch?: (targetBranchId: string | 'ALL') => { allowed: boolean; reason?: string }
  canChangeSession?: (targetSessionId: string | 'ALL') => { allowed: boolean; reason?: string }
}

export interface IncompatibleActionModalState {
  isOpen: boolean
  changeType: 'branch' | 'session'
  targetId: string | 'ALL'
  targetLabel: string
  entityTitle: string
  reason: string
}

interface AppContextType {
  selectedBranchId: string | 'ALL'
  setSelectedBranchId: (id: string | 'ALL') => void
  selectedSessionId: string | 'ALL' | null
  setSelectedSessionId: (id: string | 'ALL') => void
  contextGuard: ContextGuard | null
  registerContextGuard: (guard: ContextGuard | null) => void
  incompatibleModal: IncompatibleActionModalState | null
  setIncompatibleModal: React.Dispatch<React.SetStateAction<IncompatibleActionModalState | null>>
  closeIncompatibleModal: () => void
  requestBranchChange: (id: string | 'ALL') => boolean
  requestSessionChange: (id: string | 'ALL') => boolean
  confirmIncompatibleSwitch: (
    action: 'stay' | 'dashboard' | 'directory',
    navigate?: (path: string) => void
  ) => void
  branches: Branch[]
  sessions: AcademicSession[]
  courses: Course[]
  activeCourses: Course[]
  currentBranch: Branch | null
  currentSession: AcademicSession | null
  settings: InstituteSettings | null
  activeLogoUrl: string | null
  isSidebarCollapsed: boolean
  setIsSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebar: () => void
  refetchMeta: () => void
  refetchSettings: () => void
  refetchCourses: () => void
  isLoadingMeta: boolean
  isLoadingCourses: boolean
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedBranchId, setSelectedBranchIdState] = useState<string | 'ALL'>(() => {
    return localStorage.getItem('sutawane_selected_branch') || 'ALL'
  })

  const [selectedSessionId, setSelectedSessionIdState] = useState<string | 'ALL' | null>(() => {
    return (localStorage.getItem('sutawane_selected_session') as string | 'ALL') || null
  })

  const contextGuardRef = useRef<ContextGuard | null>(null)
  const [incompatibleModal, setIncompatibleModal] = useState<IncompatibleActionModalState | null>(null)

  const [isSidebarCollapsed, setIsSidebarCollapsedState] = useState<boolean>(() => {
    return localStorage.getItem('sutawane_sidebar_collapsed') === 'true'
  })

  const setSelectedBranchId = (id: string | 'ALL') => {
    setSelectedBranchIdState(id)
    localStorage.setItem('sutawane_selected_branch', id)
  }

  const setSelectedSessionId = (id: string | 'ALL') => {
    setSelectedSessionIdState(id)
    localStorage.setItem('sutawane_selected_session', id)
  }

  const registerContextGuard = useCallback((guard: ContextGuard | null) => {
    contextGuardRef.current = guard
  }, [])

  const closeIncompatibleModal = () => {
    setIncompatibleModal(null)
  }

  const setIsSidebarCollapsed = (collapsed: boolean) => {
    setIsSidebarCollapsedState(collapsed)
    localStorage.setItem('sutawane_sidebar_collapsed', String(collapsed))
  }

  const toggleSidebar = () => {
    setIsSidebarCollapsedState((prev) => {
      const next = !prev
      localStorage.setItem('sutawane_sidebar_collapsed', String(next))
      return next
    })
  }

  // Global Ctrl+B shortcut to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        toggleSidebar()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Fetch branches
  const { data: branches = [], isLoading: isLoadingBranches, refetch: refetchBranches } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: async () => {
      try {
        return await api.get('/branches')
      } catch {
        return []
      }
    },
  })

  // Fetch academic sessions
  const { data: sessions = [], isLoading: isLoadingSessions, refetch: refetchSessions } = useQuery<AcademicSession[]>({
    queryKey: ['sessions'],
    queryFn: async () => {
      try {
        return await api.get('/sessions')
      } catch {
        return []
      }
    },
  })

  // Fetch institute system settings
  const { data: settings = null, refetch: refetchSettings } = useQuery<InstituteSettings | null>({
    queryKey: ['institute-settings'],
    queryFn: async () => {
      try {
        return await api.get('/settings')
      } catch {
        return null
      }
    },
  })

  // Auto-select current session if not selected
  useEffect(() => {
    if (sessions.length > 0 && selectedSessionId === null) {
      const current = sessions.find((s) => s.isCurrent) || sessions[0]
      if (current) {
        setSelectedSessionId(current.id)
      }
    }
  }, [sessions, selectedSessionId])

  const currentBranch = selectedBranchId === 'ALL'
    ? null
    : branches.find((b) => b.id === selectedBranchId) || null

  const currentSession = selectedSessionId === 'ALL'
    ? null
    : sessions.find((s) => s.id === selectedSessionId) || null

  // Fetch courses / classes
  const { data: courses = [], isLoading: isLoadingCourses, refetch: refetchCourses } = useQuery<Course[]>({
    queryKey: ['courses'],
    queryFn: async () => {
      try {
        return await api.get('/courses')
      } catch {
        return []
      }
    },
  })

  const activeCourses = useMemo(() => {
    return courses.filter((c) => c.isActive)
  }, [courses])

  // Resolve active logo: branch logo if branch selected and has logo, otherwise master logo
  const activeLogoUrl = useMemo(() => {
    if (selectedBranchId !== 'ALL' && currentBranch?.logoUrl) {
      return currentBranch.logoUrl
    }
    return settings?.logo_url || null
  }, [selectedBranchId, currentBranch, settings])

  const requestBranchChange = (id: string | 'ALL'): boolean => {
    const guard = contextGuardRef.current
    if (guard?.canChangeBranch) {
      const check = guard.canChangeBranch(id)
      if (!check.allowed) {
        const targetLabel = id === 'ALL'
          ? 'All Branches (Consolidated)'
          : branches.find((b) => b.id === id)?.name || id
        setIncompatibleModal({
          isOpen: true,
          changeType: 'branch',
          targetId: id,
          targetLabel,
          entityTitle: guard.entityTitle,
          reason: check.reason || `This record is not available in ${targetLabel}.`,
        })
        return false // Change is DECLINED!
      }
    }
    setSelectedBranchId(id)
    return true
  }

  const requestSessionChange = (id: string | 'ALL'): boolean => {
    const guard = contextGuardRef.current
    if (guard?.canChangeSession) {
      const check = guard.canChangeSession(id)
      if (!check.allowed) {
        const targetLabel = id === 'ALL'
          ? 'All Academic Sessions (Consolidated)'
          : sessions.find((s) => s.id === id)?.displayName || sessions.find((s) => s.id === id)?.name || id
        setIncompatibleModal({
          isOpen: true,
          changeType: 'session',
          targetId: id,
          targetLabel,
          entityTitle: guard.entityTitle,
          reason: check.reason || `This record is not available in ${targetLabel}.`,
        })
        return false // Change is DECLINED!
      }
    }
    setSelectedSessionId(id)
    return true
  }

  const confirmIncompatibleSwitch = (
    action: 'stay' | 'dashboard' | 'directory',
    navigate?: (path: string) => void
  ) => {
    if (!incompatibleModal) return

    if (action === 'stay') {
      setIncompatibleModal(null)
      return
    }

    const { changeType, targetId } = incompatibleModal
    if (changeType === 'branch') {
      setSelectedBranchId(targetId)
    } else {
      setSelectedSessionId(targetId)
    }

    contextGuardRef.current = null
    setIncompatibleModal(null)

    if (action === 'dashboard' && navigate) {
      navigate('/')
    } else if (action === 'directory' && navigate) {
      navigate('/students')
    }
  }

  const refetchMeta = () => {
    refetchBranches()
    refetchSessions()
    refetchSettings()
    refetchCourses()
  }

  return (
    <AppContext.Provider
      value={{
        selectedBranchId,
        setSelectedBranchId,
        selectedSessionId,
        setSelectedSessionId,
        contextGuard: contextGuardRef.current,
        registerContextGuard,
        incompatibleModal,
        setIncompatibleModal,
        closeIncompatibleModal,
        requestBranchChange,
        requestSessionChange,
        confirmIncompatibleSwitch,
        branches,
        sessions,
        courses,
        activeCourses,
        currentBranch,
        currentSession,
        settings,
        activeLogoUrl,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        toggleSidebar,
        refetchMeta,
        refetchSettings,
        refetchCourses,
        isLoadingMeta: isLoadingBranches || isLoadingSessions,
        isLoadingCourses,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
}
