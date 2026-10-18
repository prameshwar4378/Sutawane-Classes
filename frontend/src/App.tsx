import React from 'react'
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { DashboardPage } from '@/pages/DashboardPage'
import { StudentsPage } from '@/pages/StudentsPage'
import { StudentDetailPage } from '@/pages/StudentDetailPage'
import { CollectFeesPage } from '@/pages/CollectFeesPage'
import { DuesPage } from '@/pages/DuesPage'
import { ExpensesPage } from '@/pages/ExpensesPage'
import { DailyReportsPage } from '@/pages/DailyReportsPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { BranchesPage } from '@/pages/BranchesPage'
import { SessionsPage } from '@/pages/SessionsPage'
import { CoursesPage } from '@/pages/CoursesPage'
import { BackupPage } from '@/pages/BackupPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { DeveloperPortalPage } from '@/pages/DeveloperPortalPage'
import { LoginPage } from '@/pages/LoginPage'
import { useAuth } from '@/context/AuthContext'

/**
 * Route Guard: Requires user to be authenticated
 */
const ProtectedRoute: React.FC<{ children: React.ReactNode; requireDeveloper?: boolean }> = ({
  children,
  requireDeveloper = false,
}) => {
  const { isAuthenticated, isLoading, isDeveloper } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-muted-foreground font-medium">Verifying Session...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requireDeveloper && !isDeveloper) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

/**
 * Login Guard: If already logged in, redirect to workspace
 */
const LoginRoute: React.FC = () => {
  const { isAuthenticated, isLoading, isDeveloper } = useAuth()
  if (isLoading) return null
  if (isAuthenticated) {
    return <Navigate to={isDeveloper ? '/developer-portal' : '/'} replace />
  }
  return <LoginPage />
}

export const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        {/* Public Login Route */}
        <Route path="/login" element={<LoginRoute />} />

        {/* Protected Application Workspace */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="students" element={<StudentsPage />} />
          <Route path="students/:id" element={<StudentDetailPage />} />
          <Route path="courses" element={<CoursesPage />} />
          <Route path="fees/collect" element={<CollectFeesPage />} />
          <Route path="fees/dues" element={<DuesPage />} />
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="reports/daily" element={<DailyReportsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="branches" element={<BranchesPage />} />
          <Route path="sessions" element={<SessionsPage />} />
          <Route path="backup" element={<BackupPage />} />
          <Route path="settings" element={<SettingsPage />} />

          {/* Developer Management Portal (Requires Developer Role) */}
          <Route
            path="developer-portal"
            element={
              <ProtectedRoute requireDeveloper>
                <DeveloperPortalPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App
