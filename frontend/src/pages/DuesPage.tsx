import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useApp } from '@/context/AppContext'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { ClockAlert, Phone, AlertTriangle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export const DuesPage: React.FC = () => {
  const { selectedBranchId } = useApp()

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['students-dues', selectedBranchId],
    queryFn: () =>
      api.get('/students', {
        branchId: selectedBranchId !== 'ALL' ? selectedBranchId : undefined,
      }),
  })

  const pendingStudents = students.filter((s: any) => s.pendingFees > 0)
  const totalPending = pendingStudents.reduce((sum: number, s: any) => sum + s.pendingFees, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ClockAlert className="w-6 h-6 text-rose-600" />
            Installments & Dues Overview
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Identify pending fee balances and students with outstanding installments.
          </p>
        </div>
        <div className="p-3 bg-rose-50 border border-rose-200 dark:bg-rose-950/40 rounded-lg text-right">
          <span className="text-xs text-rose-700 dark:text-rose-300 block font-medium">
            Total Outstanding Dues
          </span>
          <span className="text-xl font-bold text-rose-600">
            {formatCurrency(totalPending)}
          </span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Students with Pending Dues ({pendingStudents.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading dues...</p>
          ) : pendingStudents.length === 0 ? (
            <div className="py-12 text-center border rounded-lg border-dashed">
              <ClockAlert className="w-10 h-10 text-emerald-600 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold text-emerald-600">All fees settled!</p>
              <p className="text-xs text-muted-foreground mt-1">
                No students currently have outstanding dues in this branch view.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Roll No.</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Standard</TableHead>
                  <TableHead>Parent Phone</TableHead>
                  <TableHead>Agreed Fees</TableHead>
                  <TableHead>Paid Amount</TableHead>
                  <TableHead>Pending Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingStudents.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.rollNumber}</TableCell>
                    <TableCell className="font-medium text-foreground">{s.fullName}</TableCell>
                    <TableCell>{s.standard}</TableCell>
                    <TableCell className="font-mono text-xs">{s.parentPhone}</TableCell>
                    <TableCell>{formatCurrency(s.totalFees)}</TableCell>
                    <TableCell className="text-emerald-600 font-medium">
                      {formatCurrency(s.paidFees || 0)}
                    </TableCell>
                    <TableCell className="text-rose-600 font-bold">
                      {formatCurrency(s.pendingFees)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="danger">
                        Due: {formatCurrency(s.pendingFees)}
                      </Badge>
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
