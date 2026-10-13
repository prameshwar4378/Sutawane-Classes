import React, { createContext, useContext, useState, useEffect, useMemo } from 'react'
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

interface AppContextType {
  selectedBranchId: string | 'ALL'
  setSelectedBranchId: (id: string | 'ALL') => void
  selectedSessionId: string | null
  setSelectedSessionId: (id: string) => void
  branches: Branch[]
  sessions: AcademicSession[]
  currentBranch: Branch | null
  currentSession: AcademicSession | null
  settings: InstituteSettings | null
  activeLogoUrl: string | null
  refetchMeta: () => void
  refetchSettings: () => void
  isLoadingMeta: boolean
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedBranchId, setSelectedBranchIdState] = useState<string | 'ALL'>(() => {
    return localStorage.getItem('sutawane_selected_branch') || 'ALL'
  })

  const [selectedSessionId, setSelectedSessionIdState] = useState<string | null>(() => {
    return localStorage.getItem('sutawane_selected_session') || null
  })

  const setSelectedBranchId = (id: string | 'ALL') => {
    setSelectedBranchIdState(id)
    localStorage.setItem('sutawane_selected_branch', id)
  }

  const setSelectedSessionId = (id: string) => {
    setSelectedSessionIdState(id)
    localStorage.setItem('sutawane_selected_session', id)
  }

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
    if (sessions.length > 0 && !selectedSessionId) {
      const current = sessions.find((s) => s.isCurrent) || sessions[0]
      if (current) {
        setSelectedSessionId(current.id)
      }
    }
  }, [sessions, selectedSessionId])

  const currentBranch = selectedBranchId === 'ALL'
    ? null
    : branches.find((b) => b.id === selectedBranchId) || null

  const currentSession = sessions.find((s) => s.id === selectedSessionId) || null

  // Resolve active logo: branch logo if branch selected and has logo, otherwise master logo
  const activeLogoUrl = useMemo(() => {
    if (selectedBranchId !== 'ALL' && currentBranch?.logoUrl) {
      return currentBranch.logoUrl
    }
    return settings?.logo_url || null
  }, [selectedBranchId, currentBranch, settings])

  const refetchMeta = () => {
    refetchBranches()
    refetchSessions()
    refetchSettings()
  }

  return (
    <AppContext.Provider
      value={{
        selectedBranchId,
        setSelectedBranchId,
        selectedSessionId,
        setSelectedSessionId,
        branches,
        sessions,
        currentBranch,
        currentSession,
        settings,
        activeLogoUrl,
        refetchMeta,
        refetchSettings,
        isLoadingMeta: isLoadingBranches || isLoadingSessions,
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
