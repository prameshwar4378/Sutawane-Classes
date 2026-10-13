import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Calendar, Activity, CheckCircle2, AlertTriangle, Search, User, X } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { HealthCheckResponse } from '@sutawane/shared'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'

export const Header: React.FC = () => {
  const navigate = useNavigate()
  const {
    selectedBranchId,
    setSelectedBranchId,
    selectedSessionId,
    setSelectedSessionId,
    branches,
    sessions,
    currentBranch,
    settings,
    activeLogoUrl,
  } = useApp()

  const { data: health, isSuccess, isError } = useQuery<HealthCheckResponse>({
    queryKey: ['health'],
    queryFn: () => api.get('/health'),
    refetchInterval: 30000,
  })

  // Global Quick Student Search State
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // Query students matching active branch filter
  const { data: students = [] } = useQuery<any[]>({
    queryKey: ['header-quick-search-students', selectedBranchId],
    queryFn: () =>
      api.get('/students', {
        branchId: selectedBranchId !== 'ALL' ? selectedBranchId : undefined,
        isActive: 'true',
      }),
  })

  // Filter matching suggestions
  const suggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    return students
      .filter((s) => {
        return (
          s.fullName?.toLowerCase().includes(q) ||
          s.rollNumber?.toLowerCase().includes(q) ||
          s.parentPhone?.includes(q) ||
          (s.studentCode && s.studentCode.toLowerCase().includes(q))
        )
      })
      .slice(0, 6)
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
    <header className="h-16 flex-shrink-0 border-b bg-card px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs gap-4">
      {/* Brand title & Dynamic Active Logo */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {activeLogoUrl ? (
          <div className="w-9 h-9 rounded-lg bg-background border flex items-center justify-center overflow-hidden p-0.5 shadow-xs">
            <img
              src={activeLogoUrl}
              alt="Logo"
              className="w-full h-full object-contain"
            />
          </div>
        ) : (
          <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm">
            SC
          </div>
        )}
        <div className="hidden sm:block">
          <h2 className="text-sm font-bold tracking-tight text-foreground leading-none">
            {settings?.institute_name || 'Sutawane Classes'}
          </h2>
          <span className="text-[10px] text-muted-foreground font-medium block mt-0.5">
            {selectedBranchId !== 'ALL' && currentBranch
              ? `${currentBranch.name}`
              : 'Coaching Management System'}
          </span>
        </div>
      </div>

      {/* Global Quick Search with Autocomplete */}
      <div ref={searchContainerRef} className="hidden md:flex items-center flex-1 max-w-sm relative">
        <div className="relative w-full">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground pointer-events-none" />
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
            className="pl-8 pr-7 h-8 text-xs bg-muted/40 focus:bg-background border-muted rounded-lg w-full"
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
              suggestions.map((s) => (
                <div
                  key={s.id}
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

                  <div className="flex-shrink-0">
                    {s.pendingFees > 0 ? (
                      <span className="text-[10px] text-rose-600 font-bold">
                        Due: {formatCurrency(s.pendingFees)}
                      </span>
                    ) : (
                      <span className="text-[10px] text-emerald-600 font-semibold">Cleared</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Branch Selector */}
        <div className="flex items-center gap-2 bg-muted/60 px-3 py-1.5 rounded-lg border text-sm">
          <Building2 className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium text-muted-foreground hidden lg:inline">Branch:</span>
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="bg-transparent font-medium text-sm focus:outline-none cursor-pointer pr-1"
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
        <div className="flex items-center gap-2 bg-muted/60 px-3 py-1.5 rounded-lg border text-sm">
          <Calendar className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-medium text-muted-foreground hidden lg:inline">Session:</span>
          <select
            value={selectedSessionId || ''}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="bg-transparent font-medium text-sm focus:outline-none cursor-pointer pr-1"
          >
            {sessions
              .filter((s) => s.isActive)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.displayName || s.name} {s.isCurrent ? '(Current)' : ''}
                </option>
              ))}
          </select>
        </div>

        {/* System Health Indicator */}
        <div className="hidden xl:flex items-center pl-2">
          {isSuccess && health?.status === 'healthy' ? (
            <Badge variant="success" className="gap-1.5 py-1 px-2.5 font-normal">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>System Online</span>
            </Badge>
          ) : isError ? (
            <Badge variant="danger" className="gap-1.5 py-1 px-2.5 font-normal">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              <span>Offline</span>
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1.5 py-1 px-2.5 font-normal">
              <Activity className="w-3.5 h-3.5 animate-spin" />
              <span>Connecting...</span>
            </Badge>
          )}
        </div>
      </div>
    </header>
  )
}
