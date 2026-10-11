import React from 'react'
import { Building2, Calendar, Activity, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { HealthCheckResponse } from '@sutawane/shared'
import { Badge } from '@/components/ui/badge'

export const Header: React.FC = () => {
  const {
    selectedBranchId,
    setSelectedBranchId,
    selectedSessionId,
    setSelectedSessionId,
    branches,
    sessions,
  } = useApp()

  const { data: health, isSuccess, isError } = useQuery<HealthCheckResponse>({
    queryKey: ['health'],
    queryFn: () => api.get('/health'),
    refetchInterval: 30000,
  })

  return (
    <header className="h-16 border-b bg-card px-6 flex items-center justify-between sticky top-0 z-40 shadow-sm">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-bold tracking-tight text-foreground hidden sm:block">
          Sutawane Classes
        </h2>
        <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded hidden md:inline-block">
          Management System
        </span>
      </div>

      <div className="flex items-center gap-3">
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
