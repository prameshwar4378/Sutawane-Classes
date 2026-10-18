import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useApp } from '@/context/AppContext'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import {
  BarChart3,
  FileText,
  Download,
  Calendar,
  FileSpreadsheet,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  CalendarDays,
  CalendarRange,
  Building2,
  Users,
  CreditCard,
  Receipt,
  Printer,
  PieChart,
  CheckCircle2,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  BookOpen,
  IndianRupee,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
} from 'lucide-react'
import { cn, formatCurrency, formatDateLong } from '@/lib/utils'
import * as XLSX from 'xlsx'

type ReportTab = 'SESSION_AUDIT' | 'PAYMENT_MODES' | 'EXPENSE_CATEGORIES' | 'STATEMENT_DIRECTORY'

export const ReportsPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    selectedBranchId,
    setSelectedBranchId,
    selectedSessionId,
    setSelectedSessionId,
    branches,
    sessions,
    settings,
  } = useApp()

  const currentTab = (searchParams.get('tab') as ReportTab) || 'SESSION_AUDIT'
  const [activeTab, setActiveTab] = useState<ReportTab>(currentTab)

  const handleTabChange = (tab: ReportTab) => {
    setActiveTab(tab)
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('tab', tab)
    setSearchParams(nextParams)
  }

  // 1. Session Audit Query
  const {
    data: sessionAuditData,
    isLoading: isSessionAuditLoading,
    refetch: refetchSessionAudit,
  } = useQuery({
    queryKey: ['report-session-audit', selectedBranchId, selectedSessionId],
    queryFn: () =>
      api.get('/reports/session-audit', {
        branchId: selectedBranchId !== 'ALL' ? selectedBranchId : undefined,
        sessionId: selectedSessionId !== 'ALL' ? selectedSessionId : undefined,
      }),
  })

  // 2. Payment Modes Query
  const {
    data: paymentModesData,
    isLoading: isModesLoading,
    refetch: refetchModes,
  } = useQuery({
    queryKey: ['report-payment-modes', selectedBranchId, selectedSessionId],
    queryFn: () =>
      api.get('/reports/payment-modes-summary', {
        branchId: selectedBranchId !== 'ALL' ? selectedBranchId : undefined,
        sessionId: selectedSessionId !== 'ALL' ? selectedSessionId : undefined,
      }),
  })

  // 3. Expense Categories Query
  const {
    data: expenseCategoriesData,
    isLoading: isExpensesLoading,
    refetch: refetchExpenses,
  } = useQuery({
    queryKey: ['report-expense-categories', selectedBranchId],
    queryFn: () =>
      api.get('/reports/expense-categories-summary', {
        branchId: selectedBranchId !== 'ALL' ? selectedBranchId : undefined,
      }),
  })

  // Excel Export for Session Audit
  const handleExportSessionAuditExcel = () => {
    if (!sessionAuditData) return
    const wb = XLSX.utils.book_new()

    // Sheet 1: Branch Breakdown
    const branchRows = (sessionAuditData.branchBreakdown || []).map((b: any) => ({
      Branch: b.branchName,
      Code: b.branchCode,
      'Active Students': b.studentsCount,
      'Agreed Fees (Rs.)': b.totalFees,
      'Collections (Rs.)': b.collections,
      'Pending Dues (Rs.)': b.pendingDues,
      'Expenses (Rs.)': b.expenses,
      'Net Surplus (Rs.)': b.netSurplus,
      'Collection Efficiency (%)': `${b.collectionRate}%`,
    }))
    const wsBranches = XLSX.utils.json_to_sheet(branchRows)
    XLSX.utils.book_append_sheet(wb, wsBranches, 'Branch Comparison')

    // Sheet 2: Standard Breakdown
    const stdRows = (sessionAuditData.standardBreakdown || []).map((s: any) => ({
      'Class / Standard': s.standard,
      'Enrolled Students': s.studentCount,
      'Agreed Fees (Rs.)': s.totalFees,
      'Collections (Rs.)': s.collected,
      'Pending Dues (Rs.)': s.pendingDues,
      'Collection Rate (%)': `${s.collectionRate}%`,
    }))
    const wsStandards = XLSX.utils.json_to_sheet(stdRows)
    XLSX.utils.book_append_sheet(wb, wsStandards, 'Course Breakdown')

    XLSX.writeFile(wb, `Session_Audit_${sessionAuditData.session?.name || 'Report'}.xlsx`)
  }

  // Excel Export for Payment Modes
  const handleExportPaymentModesExcel = () => {
    if (!paymentModesData) return
    const wb = XLSX.utils.book_new()
    const rows = (paymentModesData.modes || []).map((m: any) => ({
      'Payment Mode': m.label,
      'Total Collections (Rs.)': m.amount,
      'Receipt Count': m.count,
      'Share (%)': `${m.percentage}%`,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, 'Payment Channels')
    XLSX.writeFile(wb, 'Payment_Modes_Summary.xlsx')
  }

  // Excel Export for Expense Categories
  const handleExportExpenseCategoriesExcel = () => {
    if (!expenseCategoriesData) return
    const wb = XLSX.utils.book_new()
    const rows = (expenseCategoriesData.categories || []).map((c: any) => ({
      Category: c.categoryName,
      'Total Disbursed (Rs.)': c.amount,
      'Voucher Count': c.count,
      'Share (%)': `${c.percentage}%`,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, 'Expense Categories')
    XLSX.writeFile(wb, 'Expense_Categories_Summary.xlsx')
  }

  const handlePrint = () => {
    window.print()
  }

  const sessionSummary = sessionAuditData?.summary || {
    activeAdmissions: 0,
    archivedAdmissions: 0,
    totalFeesAgreed: 0,
    totalCollections: 0,
    totalPendingDues: 0,
    collectionEfficiency: 0,
    totalExpenses: 0,
    netSurplus: 0,
    isSurplus: true,
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b pb-4 no-print">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            Financial &amp; Administrative Reports Suite
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Academic session audit, inflow channel breakdown, expense distribution, and unified financial statements.
          </p>
        </div>

        {/* Global Toolbar & Scope Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* In-Page Branch Selector */}
          <div className="flex items-center gap-1.5 bg-background border rounded-lg px-2.5 py-1.5 text-xs shadow-xs">
            <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="bg-transparent border-0 text-xs font-semibold focus:outline-none cursor-pointer text-foreground"
              title="Filter reports by branch"
            >
              <option value="ALL">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* In-Page Session Selector */}
          <div className="flex items-center gap-1.5 bg-background border rounded-lg px-2.5 py-1.5 text-xs shadow-xs">
            <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="bg-transparent border-0 text-xs font-semibold focus:outline-none cursor-pointer text-foreground"
              title="Filter reports by academic session"
            >
              <option value="ALL">All Academic Sessions</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.isCurrent ? ' (Current)' : ''}
                </option>
              ))}
            </select>
          </div>

          <Button
            onClick={() => navigate('/reports/daily?mode=DAILY')}
            className="gap-1.5 h-8 text-xs bg-primary text-white font-semibold"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Open Daily Statement</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="gap-1.5 h-8 text-xs font-medium"
            title="Print report on A4 paper"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </Button>
        </div>
      </div>

      {/* Print-Only Executive Header */}
      <div className="hidden print:block border-b-2 border-[#28375C] pb-4 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-black text-[#28375C] uppercase tracking-wide">
              {settings?.institute_name || 'SUTAWANE CLASSES'}
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Official Institutional Audit &amp; Performance Report • Printed on {formatDateLong(new Date())}
            </p>
          </div>
          <div className="text-right text-xs">
            <p className="font-bold text-slate-900">
              Session: {sessionAuditData?.session?.name || 'Consolidated'}
            </p>
            <p className="text-slate-500">
              Branch: {selectedBranchId === 'ALL' ? 'All Campuses' : branches.find((b) => b.id === selectedBranchId)?.name || 'Selected Campus'}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b pb-2 no-print">
        <button
          type="button"
          onClick={() => handleTabChange('SESSION_AUDIT')}
          className={cn(
            'flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
            activeTab === 'SESSION_AUDIT'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <Layers className="w-4 h-4" />
          <span>Academic Session Audit</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('PAYMENT_MODES')}
          className={cn(
            'flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
            activeTab === 'PAYMENT_MODES'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <CreditCard className="w-4 h-4" />
          <span>Payment Channels &amp; Modes</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('EXPENSE_CATEGORIES')}
          className={cn(
            'flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
            activeTab === 'EXPENSE_CATEGORIES'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <PieChart className="w-4 h-4" />
          <span>Expense Category Analysis</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('STATEMENT_DIRECTORY')}
          className={cn(
            'flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
            activeTab === 'STATEMENT_DIRECTORY'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <FileText className="w-4 h-4" />
          <span>Statements &amp; Ledgers Directory</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ACADEMIC SESSION AUDIT & PERFORMANCE                               */}
      {/* ========================================================================= */}
      {activeTab === 'SESSION_AUDIT' && (
        <div className="space-y-6">
          {/* Session Overview Ribbon */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/30 p-3.5 rounded-xl border">
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                Target Academic Session
              </span>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2 mt-0.5">
                <span>{sessionAuditData?.session?.displayName || sessionAuditData?.session?.name || 'Academic Session'}</span>
                {sessionAuditData?.session?.isCurrent && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                    Active Current
                  </span>
                )}
              </h2>
            </div>

            <div className="flex items-center gap-2 no-print">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchSessionAudit()}
                className="gap-1.5 h-8 text-xs"
                title="Refresh metrics"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportSessionAuditExcel}
                className="gap-1.5 h-8 text-xs border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Export Excel</span>
              </Button>
            </div>
          </div>

          {/* 6 Key Financial & Enrollment KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Active Students */}
            <Card className="p-3 bg-card border shadow-xs">
              <div className="text-[11px] font-semibold text-muted-foreground flex items-center justify-between">
                <span>Enrollments</span>
                <Users className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div className="text-xl font-bold text-foreground mt-1">
                {sessionSummary.activeAdmissions}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                +{sessionSummary.archivedAdmissions} archived
              </p>
            </Card>

            {/* Agreed Fees */}
            <Card className="p-3 bg-card border shadow-xs">
              <div className="text-[11px] font-semibold text-muted-foreground flex items-center justify-between">
                <span>Agreed Fees</span>
                <IndianRupee className="w-3.5 h-3.5 text-indigo-600" />
              </div>
              <div className="text-xl font-bold text-foreground mt-1">
                {formatCurrency(sessionSummary.totalFeesAgreed)}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Committed revenue</p>
            </Card>

            {/* Total Collections */}
            <Card className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 shadow-xs">
              <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                <span>Realized Fees</span>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
                {formatCurrency(sessionSummary.totalCollections)}
              </div>
              <p className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5 font-medium">
                {sessionSummary.collectionEfficiency}% collected
              </p>
            </Card>

            {/* Pending Dues */}
            <Card className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800 shadow-xs">
              <div className="text-[11px] font-bold text-amber-800 dark:text-amber-300 flex items-center justify-between">
                <span>Pending Dues</span>
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <div className="text-xl font-black text-amber-700 dark:text-amber-300 mt-1">
                {formatCurrency(sessionSummary.totalPendingDues)}
              </div>
              <p className="text-[10px] text-amber-700/80 dark:text-amber-400/80 mt-0.5 font-medium">
                Outstanding balance
              </p>
            </Card>

            {/* Total Expenses */}
            <Card className="p-3 bg-rose-50/50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800 shadow-xs">
              <div className="text-[11px] font-bold text-rose-800 dark:text-rose-300 flex items-center justify-between">
                <span>Center Expenses</span>
                <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
              </div>
              <div className="text-xl font-black text-rose-700 dark:text-rose-300 mt-1">
                {formatCurrency(sessionSummary.totalExpenses)}
              </div>
              <p className="text-[10px] text-rose-700/80 dark:text-rose-400/80 mt-0.5 font-medium">
                Operational outflow
              </p>
            </Card>

            {/* Net Surplus / Balance */}
            <Card
              className={cn(
                'p-3 border shadow-xs',
                sessionSummary.isSurplus
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-700'
                  : 'bg-rose-50 dark:bg-rose-950/30 border-rose-400 dark:border-rose-700'
              )}
            >
              <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                <span>Net Surplus</span>
                {sessionSummary.isSurplus ? (
                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5 text-rose-600" />
                )}
              </div>
              <div
                className={cn(
                  'text-xl font-black mt-1',
                  sessionSummary.isSurplus ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'
                )}
              >
                {formatCurrency(sessionSummary.netSurplus)}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                Collections − Expenses
              </p>
            </Card>
          </div>

          {/* Section 1: Campus & Branch Performance Comparison */}
          <Card className="shadow-xs border">
            <CardHeader className="py-3 px-4 border-b bg-muted/20 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                Campus &amp; Branch Performance Breakdown
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                Comparing all branches in session {sessionAuditData?.session?.name}
              </span>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#28375C] hover:bg-[#28375C] text-white">
                    <TableHead className="text-white font-semibold text-xs">Branch Name</TableHead>
                    <TableHead className="text-white font-semibold text-xs text-center">Active Students</TableHead>
                    <TableHead className="text-white font-semibold text-xs text-right">Agreed Fees</TableHead>
                    <TableHead className="text-white font-semibold text-xs text-right">Realized Fees</TableHead>
                    <TableHead className="text-white font-semibold text-xs text-right">Pending Dues</TableHead>
                    <TableHead className="text-white font-semibold text-xs text-right">Expenses</TableHead>
                    <TableHead className="text-white font-semibold text-xs text-right">Net Operating Surplus</TableHead>
                    <TableHead className="text-white font-semibold text-xs text-center">Collection Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isSessionAuditLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-xs text-muted-foreground">
                        Calculating session metrics...
                      </TableCell>
                    </TableRow>
                  ) : (sessionAuditData?.branchBreakdown || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-xs text-muted-foreground">
                        No branch records found for this academic session.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (sessionAuditData?.branchBreakdown || []).map((b: any) => (
                      <TableRow key={b.branchId} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="font-semibold text-xs">
                          <span>{b.branchName}</span>
                          <span className="font-mono text-[10px] text-muted-foreground ml-1.5">({b.branchCode})</span>
                        </TableCell>
                        <TableCell className="text-center font-bold text-xs">{b.studentsCount}</TableCell>
                        <TableCell className="text-right font-medium text-xs">{formatCurrency(b.totalFees)}</TableCell>
                        <TableCell className="text-right font-bold text-xs text-emerald-700 dark:text-emerald-400">
                          {formatCurrency(b.collections)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-xs text-amber-700 dark:text-amber-400">
                          {formatCurrency(b.pendingDues)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-xs text-rose-700 dark:text-rose-400">
                          {formatCurrency(b.expenses)}
                        </TableCell>
                        <TableCell className="text-right font-black text-xs">
                          <span className={b.netSurplus >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}>
                            {formatCurrency(b.netSurplus)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded text-[10px] font-bold',
                              b.collectionRate >= 50
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            )}
                          >
                            {b.collectionRate}%
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Section 2: Standard & Course-wise Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="shadow-xs border">
              <CardHeader className="py-3 px-4 border-b bg-muted/20">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  Class / Course Revenue &amp; Recovery
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#28375C] hover:bg-[#28375C] text-white">
                      <TableHead className="text-white font-semibold text-xs">Class / Course</TableHead>
                      <TableHead className="text-white font-semibold text-xs text-center">Students</TableHead>
                      <TableHead className="text-white font-semibold text-xs text-right">Agreed Fees</TableHead>
                      <TableHead className="text-white font-semibold text-xs text-right">Collected</TableHead>
                      <TableHead className="text-white font-semibold text-xs text-center">Recovery</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(sessionAuditData?.standardBreakdown || []).map((s: any, idx: number) => (
                      <TableRow key={idx} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="font-semibold text-xs">{s.standard}</TableCell>
                        <TableCell className="text-center font-bold text-xs">{s.studentCount}</TableCell>
                        <TableCell className="text-right text-xs">{formatCurrency(s.totalFees)}</TableCell>
                        <TableCell className="text-right font-bold text-xs text-emerald-700 dark:text-emerald-400">
                          {formatCurrency(s.collected)}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-bold text-xs">{s.collectionRate}%</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Monthly Inflow vs Outflow Trend */}
            <Card className="shadow-xs border">
              <CardHeader className="py-3 px-4 border-b bg-muted/20">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  Session Monthly Cash Movement
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#28375C] hover:bg-[#28375C] text-white">
                      <TableHead className="text-white font-semibold text-xs">Month</TableHead>
                      <TableHead className="text-white font-semibold text-xs text-right">Collections (₹)</TableHead>
                      <TableHead className="text-white font-semibold text-xs text-right">Expenses (₹)</TableHead>
                      <TableHead className="text-white font-semibold text-xs text-right">Net Movement</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(sessionAuditData?.monthlyTrend || [])
                      .filter((m: any) => m.collections > 0 || m.expenses > 0)
                      .slice(0, 8)
                      .map((m: any, idx: number) => {
                        const net = m.collections - m.expenses
                        return (
                          <TableRow key={idx} className="hover:bg-muted/40 transition-colors">
                            <TableCell className="font-semibold text-xs">{m.monthLabel}</TableCell>
                            <TableCell className="text-right font-bold text-xs text-emerald-700 dark:text-emerald-400">
                              {formatCurrency(m.collections)}
                            </TableCell>
                            <TableCell className="text-right font-medium text-xs text-rose-700 dark:text-rose-400">
                              {formatCurrency(m.expenses)}
                            </TableCell>
                            <TableCell className="text-right font-black text-xs">
                              <span className={net >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}>
                                {formatCurrency(net)}
                              </span>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PAYMENT CHANNELS & INFLOW MODES                                    */}
      {/* ========================================================================= */}
      {activeTab === 'PAYMENT_MODES' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/30 p-3.5 rounded-xl border">
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                Collections Reconciliation
              </span>
              <h2 className="text-lg font-bold text-foreground mt-0.5">
                Payment Modes &amp; Digital Inflows Breakdown
              </h2>
            </div>
            <div className="flex items-center gap-2 no-print">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchModes()}
                className="gap-1.5 h-8 text-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPaymentModesExcel}
                className="gap-1.5 h-8 text-xs border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Export Excel</span>
              </Button>
            </div>
          </div>

          {/* Mode Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {(paymentModesData?.modes || []).map((m: any) => (
              <Card key={m.mode} className="p-4 bg-card border shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-foreground uppercase">{m.label}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary">
                    {m.percentage}%
                  </span>
                </div>
                <div className="text-xl font-black text-foreground mt-2">
                  {formatCurrency(m.amount)}
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-2">
                  <span>{m.count} confirmed receipts</span>
                </div>
                {/* Visual Progress Track */}
                <div className="w-full bg-muted rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className="bg-primary h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, m.percentage)}%` }}
                  />
                </div>
              </Card>
            ))}
          </div>

          {/* Channels Table */}
          <Card className="shadow-xs border">
            <CardHeader className="py-3 px-4 border-b bg-muted/20">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" />
                Reconciled Payment Methods Register
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#28375C] hover:bg-[#28375C] text-white">
                    <TableHead className="text-white font-semibold text-xs">Payment Channel</TableHead>
                    <TableHead className="text-white font-semibold text-xs text-right">Total Realized (₹)</TableHead>
                    <TableHead className="text-white font-semibold text-xs text-center">Receipts Count</TableHead>
                    <TableHead className="text-white font-semibold text-xs text-right">Average Transaction</TableHead>
                    <TableHead className="text-white font-semibold text-xs text-center">Share of Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(paymentModesData?.modes || []).map((m: any) => (
                    <TableRow key={m.mode} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="font-bold text-xs text-foreground">{m.label}</TableCell>
                      <TableCell className="text-right font-black text-xs text-emerald-700 dark:text-emerald-400">
                        {formatCurrency(m.amount)}
                      </TableCell>
                      <TableCell className="text-center font-bold text-xs">{m.count}</TableCell>
                      <TableCell className="text-right text-xs font-mono">
                        {m.count > 0 ? formatCurrency(Math.round(m.amount / m.count)) : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-bold text-xs">{m.percentage}%</span>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/30 font-bold border-t-2">
                    <TableCell className="text-xs uppercase">Total Inflows</TableCell>
                    <TableCell className="text-right font-black text-sm text-emerald-700 dark:text-emerald-400">
                      {formatCurrency(paymentModesData?.totalCollected || 0)}
                    </TableCell>
                    <TableCell className="text-center font-bold text-xs">
                      {paymentModesData?.totalTransactions || 0}
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono">
                      {paymentModesData?.totalTransactions > 0
                        ? formatCurrency(Math.round(paymentModesData.totalCollected / paymentModesData.totalTransactions))
                        : '—'}
                    </TableCell>
                    <TableCell className="text-center font-bold text-xs">100%</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: EXPENSE CATEGORY ANALYSIS                                          */}
      {/* ========================================================================= */}
      {activeTab === 'EXPENSE_CATEGORIES' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/30 p-3.5 rounded-xl border">
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                Disbursements Analysis
              </span>
              <h2 className="text-lg font-bold text-foreground mt-0.5">
                Operational Expenses &amp; Category Taxonomy
              </h2>
            </div>
            <div className="flex items-center gap-2 no-print">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchExpenses()}
                className="gap-1.5 h-8 text-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExpenseCategoriesExcel}
                className="gap-1.5 h-8 text-xs border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Export Excel</span>
              </Button>
            </div>
          </div>

          {/* Categories Grid Table */}
          <Card className="shadow-xs border">
            <CardHeader className="py-3 px-4 border-b bg-muted/20">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <PieChart className="w-4 h-4 text-primary" />
                Expense Category Distribution &amp; Budget Share
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#28375C] hover:bg-[#28375C] text-white">
                    <TableHead className="text-white font-semibold text-xs">Expense Category</TableHead>
                    <TableHead className="text-white font-semibold text-xs text-right">Total Disbursed (₹)</TableHead>
                    <TableHead className="text-white font-semibold text-xs text-center">Vouchers Count</TableHead>
                    <TableHead className="text-white font-semibold text-xs text-right">Average per Voucher</TableHead>
                    <TableHead className="text-white font-semibold text-xs text-center">Share of Expenses</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(expenseCategoriesData?.categories || []).map((c: any) => (
                    <TableRow key={c.categoryId} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="font-bold text-xs text-foreground">{c.categoryName}</TableCell>
                      <TableCell className="text-right font-bold text-xs text-rose-700 dark:text-rose-400">
                        {formatCurrency(c.amount)}
                      </TableCell>
                      <TableCell className="text-center font-bold text-xs">{c.count}</TableCell>
                      <TableCell className="text-right text-xs font-mono">
                        {c.count > 0 ? formatCurrency(Math.round(c.amount / c.count)) : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-bold text-xs">{c.percentage}%</span>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/30 font-bold border-t-2">
                    <TableCell className="text-xs uppercase">Total Center Outflow</TableCell>
                    <TableCell className="text-right font-black text-sm text-rose-700 dark:text-rose-400">
                      {formatCurrency(expenseCategoriesData?.totalExpenses || 0)}
                    </TableCell>
                    <TableCell className="text-center font-bold text-xs">
                      {expenseCategoriesData?.totalVouchers || 0}
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono">
                      {expenseCategoriesData?.totalVouchers > 0
                        ? formatCurrency(Math.round(expenseCategoriesData.totalExpenses / expenseCategoriesData.totalVouchers))
                        : '—'}
                    </TableCell>
                    <TableCell className="text-center font-bold text-xs">100%</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: STATEMENTS & LEDGERS DIRECTORY                                      */}
      {/* ========================================================================= */}
      {activeTab === 'STATEMENT_DIRECTORY' && (
        <div className="space-y-6">
          {/* Featured Primary Statement Hub Card */}
          <Card className="border-primary/40 bg-gradient-to-r from-primary/5 via-background to-primary/5 shadow-xs">
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-2 max-w-2xl">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                    Recommended Unified Report
                  </span>
                  <h2 className="text-xl font-bold text-foreground">
                    All-in-One Financial Movement &amp; Audit Statement
                  </h2>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Combines <strong>Total Collections</strong>, <strong>Total Expenses</strong>,{' '}
                    <strong>Net Profit/Loss</strong>, and <strong>Full Transaction Ledgers</strong> in one single report.
                    Quickly toggle between Daily, Monthly, or Custom Date filters with official A4 print and CSV exports.
                  </p>
                </div>

                <div className="flex flex-wrap sm:flex-nowrap gap-2.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/reports/daily?mode=DAILY')}
                    className="gap-1.5 h-10 px-3.5 text-xs bg-background hover:bg-muted"
                  >
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    <span>Daily Report</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/reports/daily?mode=MONTHLY')}
                    className="gap-1.5 h-10 px-3.5 text-xs bg-background hover:bg-muted"
                  >
                    <CalendarDays className="w-4 h-4 text-blue-600" />
                    <span>Monthly Report</span>
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => navigate('/reports/daily?mode=CUSTOM')}
                    className="gap-1.5 h-10 px-4 text-xs font-semibold bg-primary"
                  >
                    <CalendarRange className="w-4 h-4" />
                    <span>Custom Filter</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Directory Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                title: '1. Daily Financial Statement',
                desc: 'All-in-one daily statement: fee collections, center expenses, net profit/loss, and transactions.',
                action: () => navigate('/reports/daily?mode=DAILY'),
                badge: 'Daily',
              },
              {
                title: '2. Month-wise Financial Report',
                desc: 'Complete monthly financial statement: month total collections, total expenses, and profit/loss.',
                action: () => navigate('/reports/daily?mode=MONTHLY'),
                badge: 'Monthly',
              },
              {
                title: '3. Custom Date Range Audit',
                desc: 'Customizable date filter statement combining collections and expenses across any selected dates.',
                action: () => navigate('/reports/daily?mode=CUSTOM'),
                badge: 'Custom',
              },
              {
                title: '4. Collections Register & Inflows',
                desc: 'Itemized fee collections register with receipt search, payment mode filter, and Excel export.',
                action: () => navigate('/fees/collect'),
                badge: 'Register',
              },
              {
                title: '5. Outstanding & Overdue Student Fees',
                desc: 'Aging register of unpaid student fee balances, installment status, and parent contact ledger.',
                action: () => navigate('/fees/dues'),
                badge: 'Dues',
              },
              {
                title: '6. Operational Expense Disbursements',
                desc: 'Center expenditures, payment mode breakdown, and dynamic expense categories.',
                action: () => navigate('/expenses'),
                badge: 'Outflows',
              },
              {
                title: '7. Student Master Directory Report',
                desc: 'Batch-wise and standard-wise directory of enrolled students with custom column PDF export.',
                action: () => navigate('/students'),
                badge: 'Directory',
              },
              {
                title: '8. Classes & Courses Matrix',
                desc: 'Active courses, standard-wise fee plans, installments structure, and student enrollments.',
                action: () => navigate('/courses'),
                badge: 'Curriculum',
              },
              {
                title: '9. Database Backup & Audit Archive',
                desc: 'Create instant SQLite snapshots, download compressed JSON archives, and restore data safely.',
                action: () => navigate('/backup'),
                badge: 'Backup',
              },
            ].map((r, i) => (
              <Card key={i} className="hover:border-primary/50 transition-colors shadow-xs flex flex-col justify-between">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" />
                      {r.title}
                    </CardTitle>
                    {r.badge && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary">
                        {r.badge}
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-4">
                  <p className="text-xs text-muted-foreground min-h-[36px]">{r.desc}</p>
                  <div className="pt-3 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={r.action}
                      className="w-full text-xs h-8 gap-1.5 justify-between font-medium group hover:bg-primary hover:text-white transition-colors"
                    >
                      <span>Open Report</span>
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default ReportsPage
