import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Calendar, Activity, CheckCircle2, AlertTriangle, Search, User, X, PanelLeftClose, PanelLeftOpen, CreditCard, ShieldCheck, ShieldAlert, LogOut, Clock, RotateCw } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { useAuth } from '@/context/AuthContext'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { HealthCheckResponse } from '@sutawane/shared'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'

export const Header: React.FC = () => {
  const navigate = useNavigate()
  const {
    selectedBranchId,
    requestBranchChange,
    selectedSessionId,
    requestSessionChange,
    branches,
    sessions,
    currentBranch,
    isSidebarCollapsed,
    toggleSidebar,
  } = useApp()
  const { user, isDeveloper, license, logout } = useAuth()

  const { data: health, isSuccess, isError } = useQuery<HealthCheckResponse>({
    queryKey: ['health'],
    queryFn: () => api.get('/health'),
    refetchInterval: 30000,
  })

  const queryClient = useQueryClient()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async (e?: React.MouseEvent) => {
    if (e?.shiftKey || e?.ctrlKey) {
      window.location.reload()
      return
    }

    setIsRefreshing(true)
    try {
      await Promise.all([
        queryClient.invalidateQueries(),
        queryClient.refetchQueries(),
      ])
    } catch {
      window.location.reload()
    } finally {
      setTimeout(() => setIsRefreshing(false), 600)
    }
  }

  // Global Quick Student Search State
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // Query students matching active branch and session filter
  const { data: students = [] } = useQuery<any[]>({
    queryKey: ['header-quick-search-students', selectedBranchId, selectedSessionId],
    queryFn: () =>
      api.get('/students', {
        branchId: selectedBranchId !== 'ALL' ? selectedBranchId : undefined,
        sessionId: selectedSessionId !== 'ALL' && selectedSessionId ? selectedSessionId : undefined,
        isActive: 'true',
      }),
  })

  // Filter matching suggestions with multi-token matching
  const suggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    const terms = q.split(/\s+/).filter(Boolean)
    return students
      .filter((s) => {
        const name = (s.fullName || '').toLowerCase()
        const roll = (s.rollNumber || '').toLowerCase()
        const phone = (s.parentPhone || '').replace(/\D/g, '')
        const studentPhone = (s.studentPhone || '').replace(/\D/g, '')
        const code = (s.studentCode || '').toLowerCase()
        const standard = (s.standard || '').toLowerCase()
        const branch = (s.branchName || '').toLowerCase()

        return terms.every((term) => {
          const cleanDigits = term.replace(/\D/g, '')
          return (
            name.includes(term) ||
            roll.includes(term) ||
            code.includes(term) ||
            standard.includes(term) ||
            branch.includes(term) ||
            (cleanDigits && phone.includes(cleanDigits)) ||
            (cleanDigits && studentPhone.includes(cleanDigits)) ||
            s.parentPhone?.includes(term)
          )
        })
      })
      .slice(0, 8)
  }, [students, searchQuery])

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header className="h-16 flex-shrink-0 border-b bg-card px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs gap-3">
      {/* Sidebar Toggle Button */}
      <div className="flex items-center flex-shrink-0">
        <button
          type="button"
          onClick={toggleSidebar}
          className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-input/60 bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shadow-2xs cursor-pointer flex-shrink-0"
          title={isSidebarCollapsed ? 'Expand navigation menu (Ctrl+B)' : 'Collapse navigation menu (Ctrl+B)'}
          aria-label="Toggle navigation menu"
        >
          {isSidebarCollapsed ? (
            <PanelLeftOpen className="w-4 h-4" />
          ) : (
            <PanelLeftClose className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Global Quick Search with Autocomplete */}
      <div ref={searchContainerRef} className="hidden md:flex items-center flex-1 max-w-sm relative">
        <div className="relative w-full">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setIsSearchOpen(true)
            }}
            onFocus={() => {
              if (searchQuery.trim()) setIsSearchOpen(true)
            }}
            placeholder={
              selectedBranchId === 'ALL'
                ? 'Quick search all branches...'
                : `Quick search ${currentBranch?.name || 'branch'}...`
            }
            className="pl-9 pr-7 h-9 text-xs bg-muted/40 focus:bg-background border-input rounded-lg w-full shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setIsSearchOpen(false)
              }}
              className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Floating Suggestion Dropdown */}
        {isSearchOpen && searchQuery.trim() && (
          <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-popover text-popover-foreground border rounded-lg shadow-xl overflow-hidden divide-y divide-border text-xs animate-in fade-in">
            <div className="p-1.5 bg-muted/40 text-[10px] font-semibold text-muted-foreground px-3 flex justify-between items-center">
              <span>
                Matching Students ({suggestions.length}) • {selectedBranchId === 'ALL' ? 'All Branches' : currentBranch?.name}
              </span>
            </div>

            {suggestions.length === 0 ? (
              <div className="p-3 text-center text-xs text-muted-foreground">
                No students found in {selectedBranchId === 'ALL' ? 'All Branches' : currentBranch?.name || 'this branch'}.
              </div>
            ) : (
              suggestions.map((s, idx) => (
                <div
                  key={`${s.id}-${s.admissionId || s.rollNumber || idx}`}
                  onMouseDown={() => {
                    navigate(`/students/${s.id}`)
                    setIsSearchOpen(false)
                    setSearchQuery('')
                  }}
                  className="p-2 px-3 flex items-center justify-between gap-2 hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full overflow-hidden bg-muted flex items-center justify-center border text-[9px] flex-shrink-0">
                      {s.photoUrl ? (
                        <img src={s.photoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-3 h-3 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold truncate text-foreground flex items-center gap-1">
                        <span>{s.fullName}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">({s.rollNumber})</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {s.standard} {selectedBranchId === 'ALL' ? `• ${s.branchName}` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {s.pendingFees > 0 ? (
                      <span className="text-[10px] text-rose-600 font-bold">
                        Due: {formatCurrency(s.pendingFees)}
                      </span>
                    ) : (
                      <span className="text-[10px] text-emerald-600 font-semibold">Cleared</span>
                    )}
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.stopPropagation()
                        setIsSearchOpen(false)
                        setSearchQuery('')
                        navigate(
                          `/fees/collect?studentId=${s.id}&admissionId=${s.admissionId || ''}&amount=${
                            s.pendingFees > 0 ? s.pendingFees : ''
                          }`
                        )
                      }}
                      className="h-6 px-1.5 text-[10px] font-semibold rounded bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 shadow-sm"
                      title={`Collect fees for ${s.fullName}`}
                    >
                      <CreditCard className="w-3 h-3" />
                      Fee
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-2.5 lg:gap-3 flex-shrink-0">
        {/* Branch Selector */}
        <div className="h-9 flex items-center gap-1.5 sm:gap-2 bg-muted/40 hover:bg-muted/60 px-2.5 sm:px-3 rounded-lg border border-input text-xs max-w-[210px] xl:max-w-[260px] min-w-0 transition-colors shadow-2xs">
          <Building2 className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="text-xs font-medium text-muted-foreground hidden lg:inline flex-shrink-0">Branch:</span>
          <select
            value={selectedBranchId}
            onChange={(e) => requestBranchChange(e.target.value)}
            className="h-full bg-transparent font-medium text-xs focus:outline-none cursor-pointer truncate py-0 leading-none pr-1 border-0"
          >
            <option value="ALL">All Branches (Consolidated)</option>
            {branches
              .filter((b) => b.isActive)
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
          </select>
        </div>

        {/* Academic Session Selector */}
        <div className="h-9 flex items-center gap-1.5 sm:gap-2 bg-muted/40 hover:bg-muted/60 px-2.5 sm:px-3 rounded-lg border border-input text-xs max-w-[200px] xl:max-w-[250px] min-w-0 transition-colors shadow-2xs">
          <Calendar className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span className="text-xs font-medium text-muted-foreground hidden lg:inline flex-shrink-0">Session:</span>
          <select
            value={selectedSessionId || ''}
            onChange={(e) => requestSessionChange(e.target.value)}
            className="h-full bg-transparent font-medium text-xs focus:outline-none cursor-pointer truncate py-0 leading-none pr-1 border-0"
          >
            <option value="ALL">All Academic Sessions (Consolidated)</option>
            {sessions
              .filter((s) => s.isActive)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.displayName || s.name} {s.isCurrent ? '(Current)' : ''}
                </option>
              ))}
          </select>
        </div>

        {/* Global Data Refresh Button */}
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          title="Refresh software data (Ctrl+Click to reload window)"
          className="h-9 inline-flex items-center gap-1.5 px-3 rounded-lg border border-input bg-muted/40 hover:bg-muted text-xs font-semibold text-foreground transition-all cursor-pointer shadow-2xs hover:border-primary/50 focus:outline-none flex-shrink-0"
          aria-label="Refresh application data"
        >
          <RotateCw className={`w-3.5 h-3.5 text-primary flex-shrink-0 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>

        {/* Live Online Status: Green Blinking & Pulse Animation Beacon */}
        <div className="flex items-center flex-shrink-0" title="System Online (Local Persistent SQLite Active)">
          {isSuccess && health?.status === 'healthy' ? (
            <div className="h-9 inline-flex items-center gap-1.5 px-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-xs font-semibold text-emerald-600 cursor-default shadow-2xs">
              <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-semibold text-emerald-600 hidden sm:inline">Online</span>
            </div>
          ) : isError ? (
            <div className="h-9 inline-flex items-center gap-1.5 px-2.5 rounded-lg border border-rose-500/20 bg-rose-500/5 text-xs font-semibold text-rose-600 cursor-default shadow-2xs" title="System Offline">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse flex-shrink-0"></span>
              <span className="text-xs font-semibold text-rose-600 hidden sm:inline">Offline</span>
            </div>
          ) : (
            <div className="h-9 inline-flex items-center gap-1.5 px-2.5 rounded-lg border border-input bg-muted/40" title="Connecting...">
              <span className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin"></span>
            </div>
          )}
        </div>

        {/* User Role & Logout */}
        {user && (
          <div className="h-9 flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 border-l flex-shrink-0">
            {isDeveloper ? (
              <Badge variant="outline" className="h-9 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50 border border-blue-200 text-xs px-2.5 rounded-lg font-semibold gap-1.5 hidden sm:inline-flex items-center shadow-2xs">
                <ShieldAlert className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                <span>Developer</span>
              </Badge>
            ) : (
              <Badge variant="outline" className="h-9 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50 border border-emerald-200 text-xs px-2.5 rounded-lg font-semibold gap-1.5 hidden sm:inline-flex items-center shadow-2xs">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                <span>Class Owner</span>
              </Badge>
            )}

            <button
              type="button"
              onClick={() => logout()}
              title={`Sign Out (@${user.username})`}
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-input/60 bg-muted/40 hover:bg-red-50 hover:border-red-300 dark:hover:bg-red-950/40 text-muted-foreground hover:text-red-600 transition-colors flex-shrink-0 shadow-2xs cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
