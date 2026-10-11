import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useApp } from '@/context/AppContext'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDateLong } from '@/lib/utils'
import {
  IndianRupee,
  Users,
  ClockAlert,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  Calendar,
  AlertCircle
} from 'lucide-react'

export const DashboardPage: React.FC = () => {
  const { selectedBranchId, currentBranch, currentSession } = useApp()

  // Query financial stats
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['financial-stats', selectedBranchId],
    queryFn: () => api.get('/students/stats/financial', { branchId: selectedBranchId !== 'ALL' ? selectedBranchId : undefined }),
  })

  // Query recent students
  const { data: students = [], isLoading: isLoadingStudents } = useQuery({
    queryKey: ['students-recent', selectedBranchId],
    queryFn: () => api.get('/students', { branchId: selectedBranchId !== 'ALL' ? selectedBranchId : undefined }),
  })

  return (
    <div className="space-y-6">
      {/* Scope Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/40 p-4 rounded-xl border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Dashboard Overview
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Active view: <strong className="text-foreground">{currentBranch ? currentBranch.name : 'All Branches (Consolidated)'}</strong> | Session: <strong className="text-foreground">{currentSession ? currentSession.displayName || currentSession.name : 'Current Session'}</strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 py-1 px-3">
            <Building2 className="w-3.5 h-3.5 text-primary" />
            {currentBranch ? `${currentBranch.name} (${currentBranch.code})` : 'All Branches'}
          </Badge>
          <Badge variant="outline" className="gap-1.5 py-1 px-3">
            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
            {currentSession ? currentSession.name : '2026–27'}
          </Badge>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Expected Fees */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Expected Fees
            </CardTitle>
            <div className="p-2 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              <IndianRupee className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingStats ? '...' : formatCurrency(stats?.totalExpectedFees || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Agreed fee commitments
            </p>
          </CardContent>
        </Card>

        {/* Collected Fees */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Collected Fees
            </CardTitle>
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {isLoadingStats ? '...' : formatCurrency(stats?.totalCollectedFees || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Confirmed collections
            </p>
          </CardContent>
        </Card>

        {/* Total Outstanding Dues */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Outstanding Dues
            </CardTitle>
            <div className="p-2 rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
              <ClockAlert className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600">
              {isLoadingStats ? '...' : formatCurrency(stats?.totalPendingFees || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Pending installment balances
            </p>
          </CardContent>
        </Card>

        {/* Active Students */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Active Students
            </CardTitle>
            <div className="p-2 rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
              <Users className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingStats ? '...' : stats?.activeStudentsCount || students.length || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Enrolled learners
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Admissions & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Recent Admissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingStudents ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Loading student records...</p>
            ) : students.length === 0 ? (
              <div className="py-8 text-center border rounded-lg border-dashed">
                <Users className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium text-foreground">No students enrolled yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Click on "Students" from the sidebar to admit the first student.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {students.slice(0, 5).map((s: any) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div>
                      <h4 className="font-medium text-sm text-foreground">{s.fullName}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Roll: <span className="font-mono">{s.rollNumber}</span> | {s.standard} | Ph: {s.parentPhone}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">
                        {formatCurrency(s.totalFees)}
                      </p>
                      <Badge
                        variant={s.pendingFees === 0 ? 'success' : s.paidFees > 0 ? 'warning' : 'danger'}
                        className="text-[10px] py-0 px-2 mt-0.5"
                      >
                        {s.pendingFees === 0 ? 'Fully Paid' : `Due: ${formatCurrency(s.pendingFees)}`}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Help & System Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              System Health & Storage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="p-3 bg-muted/40 rounded-lg space-y-2 border">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Database Engine:</span>
                <span className="font-semibold text-foreground">SQLite (Persistent)</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Branches Configured:</span>
                <span className="font-semibold text-foreground">Active Multi-Branch</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Data Safety:</span>
                <span className="font-semibold text-emerald-600">Local OS AppData</span>
              </div>
            </div>

            <div className="border-t pt-3">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">
                Coaching Rules
              </h4>
              <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
                <li>Financial calculations run purely on backend.</li>
                <li>Receipt numbers are auto-generated and sequential.</li>
                <li>Records between branches are isolated.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
