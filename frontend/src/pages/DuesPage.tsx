import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useApp } from '@/context/AppContext'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import {
  ClockAlert,
  CreditCard,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  TrendingDown,
  User,
} from 'lucide-react'
import { formatCurrency, formatDateLong } from '@/lib/utils'

export const DuesPage: React.FC = () => {
  const navigate = useNavigate()
  const { selectedBranchId, selectedSessionId } = useApp()

  // Filter tab: 'ALL' | 'OVERDUE' | 'DUE' | 'PARTIAL' | 'UPCOMING'
  const [statusTab, setStatusTab] = useState<'ALL' | 'OVERDUE' | 'DUE' | 'PARTIAL' | 'UPCOMING'>('ALL')

  const { data: dues = [], isLoading } = useQuery({
    queryKey: ['dues-register', selectedBranchId, selectedSessionId, statusTab],
    queryFn: () =>
      api.get('/fees/dues', {
        branchId: selectedBranchId !== 'ALL' ? selectedBranchId : undefined,
        sessionId: selectedSessionId || undefined,
        status: statusTab !== 'ALL' ? statusTab : undefined,
      }),
  })

  // Compute metrics from all dues
  const { data: allDues = [] } = useQuery({
    queryKey: ['dues-register-all', selectedBranchId, selectedSessionId],
    queryFn: () =>
      api.get('/fees/dues', {
        branchId: selectedBranchId !== 'ALL' ? selectedBranchId : undefined,
        sessionId: selectedSessionId || undefined,
      }),
  })

  const overdueList = allDues.filter((d: any) => d.status === 'OVERDUE')
  const dueTodayList = allDues.filter((d: any) => d.status === 'DUE')
  const partialList = allDues.filter((d: any) => d.status === 'PARTIAL')

  const totalPendingAmount = allDues.reduce((sum: number, d: any) => sum + (d.balanceRemaining || 0), 0)
  const totalOverdueAmount = overdueList.reduce((sum: number, d: any) => sum + (d.balanceRemaining || 0), 0)
  const totalDueTodayAmount = dueTodayList.reduce((sum: number, d: any) => sum + (d.balanceRemaining || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ClockAlert className="w-6 h-6 text-rose-600" />
            Installments & Dues Register
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track student fee aging, identify overdue installments, and collect pending balances.
          </p>
        </div>
        <Button
          onClick={() => navigate('/fees/collect')}
          className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <CreditCard className="w-4 h-4" />
          Collect Fees Now
        </Button>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Overdue */}
        <Card className="border-rose-200 bg-rose-50/30 dark:bg-rose-950/20">
          <CardHeader className="py-3 pb-1">
            <CardTitle className="text-xs font-semibold uppercase text-rose-700 dark:text-rose-300 flex items-center justify-between">
              <span>Overdue Installments</span>
              <AlertTriangle className="w-4 h-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600">
              {formatCurrency(totalOverdueAmount)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {overdueList.length} installments past due date
            </p>
          </CardContent>
        </Card>

        {/* Due Today */}
        <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-950/20">
          <CardHeader className="py-3 pb-1">
            <CardTitle className="text-xs font-semibold uppercase text-amber-700 dark:text-amber-300 flex items-center justify-between">
              <span>Due Today</span>
              <Calendar className="w-4 h-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {formatCurrency(totalDueTodayAmount)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {dueTodayList.length} installments due today
            </p>
          </CardContent>
        </Card>

        {/* Partially Paid */}
        <Card className="border-blue-200 bg-blue-50/30 dark:bg-blue-950/20">
          <CardHeader className="py-3 pb-1">
            <CardTitle className="text-xs font-semibold uppercase text-blue-700 dark:text-blue-300 flex items-center justify-between">
              <span>Partially Settled</span>
              <TrendingDown className="w-4 h-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {partialList.length} Installments
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Partial tokens received
            </p>
          </CardContent>
        </Card>

        {/* Total Outstanding */}
        <Card>
          <CardHeader className="py-3 pb-1">
            <CardTitle className="text-xs font-semibold uppercase text-muted-foreground">
              Total Outstanding Dues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(totalPendingAmount)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Across {allDues.length} pending installments
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-lg border w-fit overflow-x-auto">
        <Button
          variant={statusTab === 'ALL' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setStatusTab('ALL')}
          className="text-xs h-8"
        >
          All Pending ({allDues.length})
        </Button>
        <Button
          variant={statusTab === 'OVERDUE' ? 'destructive' : 'ghost'}
          size="sm"
          onClick={() => setStatusTab('OVERDUE')}
          className="text-xs h-8"
        >
          Overdue ({overdueList.length})
        </Button>
        <Button
          variant={statusTab === 'DUE' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setStatusTab('DUE')}
          className="text-xs h-8"
        >
          Due Today ({dueTodayList.length})
        </Button>
        <Button
          variant={statusTab === 'PARTIAL' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setStatusTab('PARTIAL')}
          className="text-xs h-8"
        >
          Partially Paid ({partialList.length})
        </Button>
        <Button
          variant={statusTab === 'UPCOMING' ? 'outline' : 'ghost'}
          size="sm"
          onClick={() => setStatusTab('UPCOMING')}
          className="text-xs h-8"
        >
          Upcoming Installments
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base font-semibold">
            Installments Schedule ({dues.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading dues register...</p>
          ) : dues.length === 0 ? (
            <div className="py-12 text-center border rounded-lg border-dashed">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold text-emerald-600">No installments pending in this category!</p>
              <p className="text-xs text-muted-foreground mt-1">
                All scheduled installments in this filter view have been cleared.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Roll No</TableHead>
                  <TableHead>Standard</TableHead>
                  <TableHead>Installment Label</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Amount Due</TableHead>
                  <TableHead>Amount Paid</TableHead>
                  <TableHead>Remaining Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dues.map((d: any) => (
                  <TableRow key={d.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell className="font-semibold text-foreground">
                      <button
                        type="button"
                        onClick={() => navigate(`/students/${d.student.id}`)}
                        className="hover:underline text-left"
                      >
                        {d.student.fullName}
                      </button>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{d.student.rollNumber}</TableCell>
                    <TableCell className="text-xs">{d.student.standard}</TableCell>
                    <TableCell className="text-xs font-medium text-foreground">{d.label}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateLong(d.dueDate)}
                    </TableCell>
                    <TableCell className="text-xs font-semibold">{formatCurrency(d.amountDue)}</TableCell>
                    <TableCell className="text-xs text-emerald-600 font-semibold">
                      {formatCurrency(d.amountPaid)}
                    </TableCell>
                    <TableCell className="text-xs font-bold text-rose-600">
                      {formatCurrency(d.balanceRemaining)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          d.status === 'OVERDUE'
                            ? 'danger'
                            : d.status === 'DUE'
                            ? 'warning'
                            : d.status === 'PARTIAL'
                            ? 'secondary'
                            : 'outline'
                        }
                      >
                        {d.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => navigate('/fees/collect')}
                        className="h-8 gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        Collect
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
