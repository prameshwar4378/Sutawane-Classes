import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Building2,
  CalendarDays,
  Users,
  CreditCard,
  ClockAlert,
  Receipt,
  FileSpreadsheet,
  BarChart3,
  Database,
  Settings,
  GraduationCap
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApp } from '@/context/AppContext'

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
}

const navItems: NavItem[] = [
  { title: 'Dashboard', href: '/', icon: LayoutDashboard },
  { title: 'Students', href: '/students', icon: Users },
  { title: 'Collect Fees', href: '/fees/collect', icon: CreditCard },
  { title: 'Installments & Dues', href: '/fees/dues', icon: ClockAlert },
  { title: 'Expenses', href: '/expenses', icon: Receipt },
  { title: 'Daily Reports', href: '/reports/daily', icon: FileSpreadsheet },
  { title: 'Financial Reports', href: '/reports', icon: BarChart3 },
  { title: 'Branches', href: '/branches', icon: Building2 },
  { title: 'Academic Sessions', href: '/sessions', icon: CalendarDays },
  { title: 'Backup & Restore', href: '/backup', icon: Database },
  { title: 'Settings', href: '/settings', icon: Settings },
]

export const Sidebar: React.FC = () => {
  const { activeLogoUrl, settings } = useApp()

  return (
    <aside className="w-64 border-r bg-card flex flex-col flex-shrink-0 h-screen sticky top-0 z-30 select-none">
      {/* Brand Header */}
      <div className="h-16 flex-shrink-0 border-b px-5 flex items-center gap-3 bg-card">
        {activeLogoUrl ? (
          <div className="w-9 h-9 rounded-lg bg-background border flex items-center justify-center overflow-hidden p-0.5 shadow-xs flex-shrink-0">
            <img src={activeLogoUrl} alt="Logo" className="w-full h-full object-contain" />
          </div>
        ) : (
          <div className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg shadow-sm flex-shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
        )}

        <div className="min-w-0">
          <h1 className="font-bold text-sm tracking-tight leading-none text-foreground truncate">
            {settings?.institute_name ? settings.institute_name.toUpperCase() : 'SUTAWANE'}
          </h1>
          <p className="text-[11px] text-muted-foreground mt-0.5 font-medium truncate">
            Classes Management
          </p>
        </div>
      </div>

      {/* Nav List with Independent Scroll if needed */}
      <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            end={item.href === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )
            }
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 truncate">{item.title}</span>
            {item.badge && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Fixed Bottom Footer */}
      <div className="p-3.5 flex-shrink-0 border-t text-xs text-muted-foreground bg-muted/20">
        <p className="font-semibold text-foreground truncate">
          {settings?.institute_name || 'Sutawane Classes'}
        </p>
        <p className="text-[11px] text-muted-foreground/80 mt-0.5">Desktop Management v1.0</p>
      </div>
    </aside>
  )
}
