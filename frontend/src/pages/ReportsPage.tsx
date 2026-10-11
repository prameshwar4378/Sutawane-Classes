import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BarChart3, FileText, Download, Calendar } from 'lucide-react'

export const ReportsPage: React.FC = () => {
  const reportCategories = [
    { title: '1. Daily Collection Report', desc: 'Day-by-day fee inflows grouped by payment mode and student.' },
    { title: '2. Daily Expense Report', desc: 'Detailed breakdown of all center expenditures for the day.' },
    { title: '3. Daily Financial Movement', desc: 'Collections minus expenses indicating net liquid movement.' },
    { title: '4. Monthly Collection Report', desc: 'Full month summary of tuition and installment fees collected.' },
    { title: '5. Monthly Expense Report', desc: 'Monthly center operational overhead breakdown.' },
    { title: '6. Yearly Collection & Expense', desc: 'Year-on-year financial summary for tax and accounting audit.' },
    { title: '7. Academic Session Financial Report', desc: 'Performance and revenues mapped to academic session.' },
    { title: '8. Branch-Wise Comparison', desc: 'Comparison of all 5–6 branches side-by-side.' },
    { title: '9. Student-Wise Fee Ledger', desc: 'Complete historical statement of accounts for individual students.' },
    { title: '10. Outstanding & Overdue Installments', desc: 'Aging report of unpaid student fees and pending installments.' },
    { title: '11. Expense Category Breakdown', desc: 'Distribution across Rent, Salaries, Bills, and Stationery.' },
    { title: '12. Previous-Session Dues Report', desc: 'Recovery audit of balances carried forward from past sessions.' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-primary" />
          Financial & Academic Reports Suite
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Generate, audit, print, and export all 16 institute financial and administrative reports.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportCategories.map((r, i) => (
          <Card key={i} className="hover:border-primary/50 transition-colors">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                {r.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground min-h-[36px]">{r.desc}</p>
              <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                <Button variant="outline" size="sm" className="text-xs h-8 flex-1">
                  View Online
                </Button>
                <Button variant="ghost" size="sm" className="text-xs h-8">
                  <Download className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
