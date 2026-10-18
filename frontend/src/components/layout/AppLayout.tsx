import React from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useAuth } from '@/context/AuthContext'
import { SoftwareLockScreen } from '@/components/SoftwareLockScreen'
import { IncompatibleActionModal } from '@/components/IncompatibleActionModal'

export const AppLayout: React.FC = () => {
  const { isClassOwner, license } = useAuth()

  // If user is Class Owner and software is expired or deactivated, show lock screen
  const isLocked = isClassOwner && license && (!license.isActive || license.isExpired)

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background font-sans antialiased text-foreground">
      {isLocked && <SoftwareLockScreen />}
      <IncompatibleActionModal />

      {/* Permanent Fixed Left Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden">
        {/* Permanent Fixed Top Header */}
        <Header />

        {/* Scrollable Main Workspace */}
        <main className="flex-1 overflow-y-auto p-6 scroll-smooth bg-muted/10 focus:outline-none">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
