import React, { createContext, useContext, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'

export interface Branch {
  id: string
  name: string
  code: string
  address?: string | null
  phone?: string | null
  contactPerson?: string | null
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

interface AppContextType {
  selectedBranchId: string | 'ALL'
  setSelectedBranchId: (id: string | 'ALL') => void
  selectedSessionId: string | null
  setSelectedSessionId: (id: string) => void
  branches: Branch[]
  sessions: AcademicSession[]
  currentBranch: Branch | null
  currentSession: AcademicSession | null
  refetchMeta: () => void
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

  const refetchMeta = () => {
    refetchBranches()
    refetchSessions()
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
        refetchMeta,
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
