import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { DashboardPage } from '@/pages/DashboardPage'
import { StudentsPage } from '@/pages/StudentsPage'
import { CollectFeesPage } from '@/pages/CollectFeesPage'
import { DuesPage } from '@/pages/DuesPage'
import { ExpensesPage } from '@/pages/ExpensesPage'
import { DailyReportsPage } from '@/pages/DailyReportsPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { BranchesPage } from '@/pages/BranchesPage'
import { SessionsPage } from '@/pages/SessionsPage'
import { BackupPage } from '@/pages/BackupPage'
import { SettingsPage } from '@/pages/SettingsPage'

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="students" element={<StudentsPage />} />
          <Route path="fees/collect" element={<CollectFeesPage />} />
          <Route path="fees/dues" element={<DuesPage />} />
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="reports/daily" element={<DailyReportsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="branches" element={<BranchesPage />} />
          <Route path="sessions" element={<SessionsPage />} />
          <Route path="backup" element={<BackupPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
