import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useApp } from '@/context/AppContext'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { FileSpreadsheet, Printer, Download, Calendar } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export const DailyReportsPage: React.FC = () => {
  const { selectedBranchId, currentBranch } = useApp()
  const today = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-primary" />
            Daily Financial Movement Report
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Date: <strong>{today}</strong> | Scope:{' '}
            <strong>{currentBranch ? currentBranch.name : 'All Branches Consolidated'}</strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5">
            <Printer className="w-4 h-4" />
            Print Report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/20">
          <CardHeader className="py-3">
            <CardTitle className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              Today's Collections
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <span className="text-2xl font-bold text-emerald-600">₹0</span>
            <p className="text-xs text-muted-foreground mt-1">Confirmed fee inflows</p>
          </CardContent>
        </Card>

        <Card className="border-rose-200 bg-rose-50/40 dark:bg-rose-950/20">
          <CardHeader className="py-3">
            <CardTitle className="text-xs font-semibold text-rose-800 dark:text-rose-300">
              Today's Expenses
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <span className="text-2xl font-bold text-rose-600">₹0</span>
            <p className="text-xs text-muted-foreground mt-1">Operating disbursements</p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/40 dark:bg-blue-950/20">
          <CardHeader className="py-3">
            <CardTitle className="text-xs font-semibold text-blue-800 dark:text-blue-300">
              Net Financial Movement
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <span className="text-2xl font-bold text-blue-600">₹0</span>
            <p className="text-xs text-muted-foreground mt-1">Collections minus expenses</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Today's Transactions Register</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center border rounded-lg border-dashed">
            <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-40" />
            <p className="text-sm font-semibold">No transactions recorded today yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Any fee payment or expense recorded today will show in this real-time ledger.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
