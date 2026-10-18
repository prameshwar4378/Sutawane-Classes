import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useApp } from '@/context/AppContext'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
  IndianRupee,
  Users,
  ClockAlert,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Calendar,
  AlertTriangle,
  Receipt,
  CreditCard,
  TrendingUp,
  Activity,
  CheckCircle2,
  Clock,
  RotateCcw,
  ArrowRight,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { formatCurrency, formatDate, formatDateLong } from '@/lib/utils'

const formatRelativeActivityTime = (actionTimeStr?: string, fallbackDateStr?: string) => {
  const timeSource = actionTimeStr || fallbackDateStr
  if (!timeSource) return ''

  const date = new Date(timeSource)
  if (isNaN(date.getTime())) return ''

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)

  // Format time portion like "02:30 PM"
  const timeFormatted = date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })

  // Check if today
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()

  // If time is exact midnight 00:00:00 (legacy date-only string)
  const isDateOnly = date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0

  if (diffSec >= 0 && diffSec < 60) {
    return 'Just now'
  }

  if (diffMin >= 1 && diffMin < 60) {
    return `${diffMin}m ago (${timeFormatted})`
  }

  if (isToday) {
    return isDateOnly ? 'Today' : `Today at ${timeFormatted}`
  }

  // Check if yesterday
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()

  if (isYesterday) {
    return isDateOnly ? 'Yesterday' : `Yesterday at ${timeFormatted}`
  }

  return isDateOnly ? formatDate(timeSource) : `${formatDate(timeSource)} • ${timeFormatted}`
}

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate()
  const { selectedBranchId, selectedSessionId, currentBranch, currentSession } = useApp()

  // Fetch complete dashboard analytics
  const { data: analytics, isLoading } = useQuery({
    queryKey: ['dashboard-analytics', selectedBranchId, selectedSessionId],
    queryFn: () =>
      api.get('/dashboard', {
        branchId: selectedBranchId !== 'ALL' ? selectedBranchId : undefined,
        sessionId: selectedSessionId || undefined,
      }),
    refetchInterval: 15000,
  })

  const today = analytics?.today
  const month = analytics?.month
  const sessionStats = analytics?.session
  const dues = analytics?.dues
  const monthlyTrend = analytics?.monthlyTrend || []
  const branchComparison = analytics?.branchComparison || []
  const recentTransactions = analytics?.recentTransactions || []

  return (
    <div className="space-y-6">
      {/* Scope Banner & Fast Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/40 p-4 rounded-xl border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Institute Financial Dashboard
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Active Scope: <strong className="text-foreground">{currentBranch ? currentBranch.name : 'All Branches Consolidated'}</strong> | Academic Session:{' '}
            <strong className="text-foreground">
              {currentSession
                ? currentSession.displayName || currentSession.name
                : selectedSessionId === 'ALL'
                ? 'All Academic Sessions Consolidated'
                : '2026–27'}
            </strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => navigate('/fees/collect')}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white h-9 text-xs"
          >
            <CreditCard className="w-3.5 h-3.5" />
            Collect Fees
          </Button>
          <Button
            onClick={() => navigate('/expenses')}
            variant="outline"
            className="gap-1.5 h-9 text-xs"
          >
            <Receipt className="w-3.5 h-3.5" />
            Add Expense
          </Button>
        </div>
      </div>

      {/* Row 1: Today's Financial Movement (Daily Cashflow Reality) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Inflows */}
        <Card className="border-emerald-200 bg-emerald-50/20 dark:bg-emerald-950/20">
          <CardHeader className="flex flex-row items-center justify-between pb-1 py-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              Today's Collections
            </CardTitle>
            <div className="p-1.5 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="text-2xl font-extrabold text-emerald-600">
              {isLoading ? '...' : formatCurrency(today?.collections || 0)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Verified fee receipts received today
            </p>
          </CardContent>
        </Card>

        {/* Today's Outflows */}
        <Card className="border-rose-200 bg-rose-50/20 dark:bg-rose-950/20">
          <CardHeader className="flex flex-row items-center justify-between pb-1 py-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-rose-800 dark:text-rose-300">
              Today's Expenses
            </CardTitle>
            <div className="p-1.5 rounded-md bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="text-2xl font-extrabold text-rose-600">
              {isLoading ? '...' : formatCurrency(today?.expenses || 0)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Center disbursements recorded today
            </p>
          </CardContent>
        </Card>

        {/* Today's Net Liquid Movement */}
        <Card className="border-blue-200 bg-blue-50/20 dark:bg-blue-950/20">
          <CardHeader className="flex flex-row items-center justify-between pb-1 py-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-blue-800 dark:text-blue-300">
              Today's Net Movement
            </CardTitle>
            <div className="p-1.5 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
              <TrendingUp className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="pb-3">
            <div
              className={`text-2xl font-extrabold ${
                (today?.netMovement || 0) >= 0 ? 'text-blue-600' : 'text-rose-600'
              }`}
            >
              {isLoading ? '...' : formatCurrency(today?.netMovement || 0)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Collections minus expenses
            </p>
          </CardContent>
        </Card>

        {/* Overdue Fee Dues */}
        <Card className="border-amber-200 bg-amber-50/20 dark:bg-amber-950/20">
          <CardHeader className="flex flex-row items-center justify-between pb-1 py-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
              Overdue Fee Dues
            </CardTitle>
            <div className="p-1.5 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
              <ClockAlert className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="text-2xl font-extrabold text-amber-600">
              {isLoading ? '...' : formatCurrency(dues?.overdueAmount || 0)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {dues?.overdueCount || 0} student accounts overdue
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Session Cumulative Macro Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Agreed Commitment */}
        <Card>
          <CardHeader className="py-3 pb-1">
            <CardTitle className="text-[11px] font-semibold uppercase text-muted-foreground">
              Total Expected Fees
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="text-xl font-bold text-foreground">
              {isLoading ? '...' : formatCurrency(sessionStats?.totalExpectedFees || 0)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Enrolled student commitments
            </p>
          </CardContent>
        </Card>

        {/* Total Collected */}
        <Card>
          <CardHeader className="py-3 pb-1">
            <CardTitle className="text-[11px] font-semibold uppercase text-muted-foreground">
              Total Fees Collected
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="text-xl font-bold text-emerald-600">
              {isLoading ? '...' : formatCurrency(sessionStats?.totalCollectedFees || 0)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Cumulative collections in scope
            </p>
          </CardContent>
        </Card>

        {/* Outstanding Dues */}
        <Card>
          <CardHeader className="py-3 pb-1">
            <CardTitle className="text-[11px] font-semibold uppercase text-muted-foreground">
              Total Outstanding Dues
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="text-xl font-bold text-rose-600">
              {isLoading ? '...' : formatCurrency(sessionStats?.totalPendingFees || 0)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Unpaid student fee balances
            </p>
          </CardContent>
        </Card>

        {/* Active Students */}
        <Card>
          <CardHeader className="py-3 pb-1">
            <CardTitle className="text-[11px] font-semibold uppercase text-muted-foreground">
              Active Enrolled Students
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="text-xl font-bold text-foreground">
              {isLoading ? '...' : sessionStats?.activeStudentsCount || 0}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Across active batches
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Recharts Visual Analytics & Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Financial Movement Chart (2 cols) */}
        <Card className="lg:col-span-2">
          <CardHeader className="py-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">
                Monthly Financial Movement (Last 6 Months)
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Comparison of tuition fee collections vs. center overhead expenses
              </p>
            </div>
            <Badge variant="outline" className="text-xs">
              Recharts Visual Engine
            </Badge>
          </CardHeader>
          <CardContent className="h-72 pt-2">
            {monthlyTrend.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                No financial history recorded yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrend} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value: any) => [formatCurrency(Number(value)), '']}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Bar
                    dataKey="collections"
                    name="Fee Collections (₹)"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="expenses"
                    name="Operating Expenses (₹)"
                    fill="#f43f5e"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Live Recent Transactions Feed (1 col) */}
        <Card className="flex flex-col">
          <CardHeader className="py-3 px-4 border-b">
            <CardTitle className="text-sm font-bold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Recent Activity Feed</span>
              </div>
              <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground gap-1 px-1.5 py-0.5">
                <Activity className="w-3 h-3 text-emerald-600" />
                Live Feed
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 flex-1 flex flex-col justify-between">
            {recentTransactions.length === 0 ? (
              <div className="py-14 text-center text-xs text-muted-foreground border rounded-xl border-dashed">
                <Activity className="w-6 h-6 mx-auto mb-2 text-muted-foreground/40" />
                No recent activity recorded yet
              </div>
            ) : (
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {recentTransactions.map((tx: any) => {
                  const isRev = tx.type === 'FEE_REVERSAL'
                  const isInc = tx.isIncome && !isRev
                  const displayTime = formatRelativeActivityTime(tx.actionTime || tx.createdAt, tx.date)

                  return (
                    <div
                      key={tx.id}
                      onClick={() => {
                        if (tx.studentId) navigate(`/students/${tx.studentId}`)
                        else if (tx.type === 'EXPENSE') navigate('/expenses')
                      }}
                      className="p-2 border rounded-xl bg-card hover:bg-muted/40 transition-all cursor-pointer flex items-center justify-between gap-2 text-xs shadow-xs hover:border-primary/40 group"
                      title={tx.studentId ? 'Click to view student fee ledger' : tx.type === 'EXPENSE' ? 'Click to view expense records' : undefined}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {/* Type Icon Badge */}
                        <div
                          className={`p-2 rounded-lg shrink-0 flex items-center justify-center ${
                            isRev
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                              : isInc
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                          }`}
                        >
                          {isRev ? (
                            <RotateCcw className="w-3.5 h-3.5" />
                          ) : isInc ? (
                            <CreditCard className="w-3.5 h-3.5" />
                          ) : (
                            <Receipt className="w-3.5 h-3.5" />
                          )}
                        </div>

                        {/* Details */}
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                              {tx.title}
                            </span>
                            {tx.paymentMode && (
                              <span className="text-[9px] px-1 py-0 rounded font-mono font-medium bg-muted text-muted-foreground border">
                                {tx.paymentMode}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">{tx.subtitle}</div>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/80 pt-0.5">
                            <Clock className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                            <span className="font-medium text-foreground/75">{displayTime}</span>
                            <span>•</span>
                            <span className="truncate">{tx.branchName}</span>
                          </div>
                        </div>
                      </div>

                      {/* Amount & Status Badge */}
                      <div className="text-right shrink-0">
                        <div
                          className={`font-bold text-xs ${
                            isRev
                              ? 'text-amber-600 line-through'
                              : isInc
                              ? 'text-emerald-600'
                              : 'text-rose-600'
                          }`}
                        >
                          {isRev ? '−' : isInc ? '+' : '−'}
                          {formatCurrency(tx.amount)}
                        </div>
                        <Badge
                          variant={isRev ? 'outline' : isInc ? 'success' : 'outline'}
                          className={`text-[9px] px-1.5 py-0 mt-0.5 ${
                            isRev
                              ? 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300'
                              : isInc
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300'
                          }`}
                        >
                          {isRev ? 'Reversed' : isInc ? 'Fee Collection' : 'Expense'}
                        </Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Quick Links Footer */}
            <div className="pt-2.5 mt-2 flex items-center justify-between text-[11px] text-muted-foreground border-t">
              <span>Showing latest {recentTransactions.length} actions</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/fees/collect')}
                  className="text-primary hover:underline font-medium inline-flex items-center gap-0.5 cursor-pointer"
                >
                  Collect Fee <ArrowRight className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/expenses')}
                  className="text-primary hover:underline font-medium inline-flex items-center gap-0.5 cursor-pointer"
                >
                  Expenses <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 4: Multi-Branch Consolidated Comparison (when All Branches selected) */}
      {selectedBranchId === 'ALL' && branchComparison.length > 0 && (
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <span>Multi-Branch Performance Comparison</span>
              <Badge variant="outline" className="text-xs">
                Consolidated View (All Centers)
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader className="bg-[#28375C] text-white">
                <TableRow className="border-b border-[#1b2640] hover:bg-[#28375C] bg-[#28375C]">
                  <TableHead className="text-white font-semibold">Branch Center</TableHead>
                  <TableHead className="text-white font-semibold">Code</TableHead>
                  <TableHead className="text-white font-semibold">Active Students</TableHead>
                  <TableHead className="text-white font-semibold">Total Fee Collections</TableHead>
                  <TableHead className="text-white font-semibold">Operating Expenses</TableHead>
                  <TableHead className="text-white font-semibold">Net Cash Movement</TableHead>
                  <TableHead className="text-right text-white font-semibold pr-4">Outstanding Dues</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branchComparison.map((b: any) => (
                  <TableRow key={b.branchId} className="hover:bg-muted/40 transition-colors">
                    <TableCell className="font-bold text-foreground">{b.branchName}</TableCell>
                    <TableCell className="font-mono text-xs">{b.branchCode}</TableCell>
                    <TableCell>{b.activeStudents}</TableCell>
                    <TableCell className="font-bold text-emerald-600">
                      {formatCurrency(b.totalCollections)}
                    </TableCell>
                    <TableCell className="text-rose-600 font-medium">
                      {formatCurrency(b.totalExpenses)}
                    </TableCell>
                    <TableCell
                      className={`font-semibold ${
                        b.totalCollections - b.totalExpenses >= 0 ? 'text-blue-600' : 'text-rose-600'
                      }`}
                    >
                      {formatCurrency(b.totalCollections - b.totalExpenses)}
                    </TableCell>
                    <TableCell className="text-right font-bold text-rose-600">
                      {formatCurrency(b.pendingDues)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
