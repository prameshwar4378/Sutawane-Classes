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
  BarChart3,
  Database,
  Settings,
  GraduationCap,
  BookOpen,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  LogOut,
  User as UserIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApp } from '@/context/AppContext'
import { useAuth } from '@/context/AuthContext'
import { Badge } from '@/components/ui/badge'

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
  developerOnly?: boolean
}

const baseNavItems: NavItem[] = [
  { title: 'Dashboard', href: '/', icon: LayoutDashboard },
  { title: 'Students', href: '/students', icon: Users },
  { title: 'Classes & Courses', href: '/courses', icon: BookOpen },
  { title: 'Collect Fees', href: '/fees/collect', icon: CreditCard },
  { title: 'Pending Dues', href: '/fees/dues', icon: ClockAlert },
  { title: 'Expenses', href: '/expenses', icon: Receipt },
  { title: 'Financial Reports', href: '/reports', icon: BarChart3 },
  { title: 'Branches', href: '/branches', icon: Building2 },
  { title: 'Academic Sessions', href: '/sessions', icon: CalendarDays },
  { title: 'Backup & Restore', href: '/backup', icon: Database },
  { title: 'Settings', href: '/settings', icon: Settings },
]

export const Sidebar: React.FC = () => {
  const { activeLogoUrl, settings, isSidebarCollapsed, toggleSidebar } = useApp()
  const { user, isDeveloper, logout } = useAuth()

  const navItems = isDeveloper
    ? [
        {
          title: 'Developer Portal',
          href: '/developer-portal',
          icon: ShieldAlert,
          badge: 'DEV',
          developerOnly: true,
        },
        ...baseNavItems,
      ]
    : baseNavItems

  return (
    <aside
      className={cn(
        'border-r bg-card flex flex-col flex-shrink-0 h-screen sticky top-0 z-30 select-none transition-all duration-200 ease-in-out',
        isSidebarCollapsed ? 'w-[72px]' : 'w-64'
      )}
    >
      {/* Brand Header */}
      <div
        className={cn(
          'h-16 flex-shrink-0 border-b flex items-center bg-card transition-all',
          isSidebarCollapsed ? 'justify-center px-2' : 'justify-between px-4'
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          {activeLogoUrl ? (
            <div className="w-9 h-9 rounded-lg bg-background border flex items-center justify-center overflow-hidden p-0.5 shadow-xs flex-shrink-0">
              <img src={activeLogoUrl} alt="Logo" className="w-full h-full object-contain" />
            </div>
          ) : (
            <div className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg shadow-sm flex-shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
          )}

          {!isSidebarCollapsed && (
            <div className="min-w-0">
              <h1 className="font-bold text-sm tracking-tight leading-none text-foreground truncate">
                {settings?.institute_name ? settings.institute_name.toUpperCase() : 'SUTAWANE'}
              </h1>
              <p className="text-[11px] text-muted-foreground mt-0.5 font-medium truncate">
                Classes Management
              </p>
            </div>
          )}
        </div>

        {/* Header Toggle Button */}
        {!isSidebarCollapsed && (
          <button
            type="button"
            onClick={toggleSidebar}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex-shrink-0"
            title="Collapse menu (Ctrl+B)"
            aria-label="Collapse menu"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav List with Independent Scroll */}
      <nav className="p-2 space-y-1 flex-1 overflow-y-auto overflow-x-hidden">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            end={item.href === '/'}
            title={isSidebarCollapsed ? item.title : undefined}
            className={({ isActive }) =>
              cn(
                'flex items-center rounded-lg text-sm font-medium transition-colors group relative',
                isSidebarCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )
            }
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />

            {!isSidebarCollapsed && (
              <>
                <span className="flex-1 truncate">{item.title}</span>
                {item.badge && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                    {item.badge}
                  </span>
                )}
              </>
            )}

            {/* Hover Tooltip when sidebar is collapsed */}
            {isSidebarCollapsed && (
              <div className="absolute left-full ml-2.5 px-2.5 py-1.5 bg-popover text-popover-foreground text-xs font-medium rounded-md shadow-md border opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-150 z-50 whitespace-nowrap">
                {item.title}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Fixed Bottom Footer with User Profile & Toggle Action */}
      <div className="p-2.5 flex-shrink-0 border-t bg-muted/20 text-xs text-muted-foreground space-y-2">
        {!isSidebarCollapsed ? (
          <div>
            {/* Logged in User Pill */}
            {user && (
              <div className="p-2 bg-background border rounded-lg mb-2 shadow-xs flex items-center justify-between gap-2">
                <div className="min-w-0 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                    {user.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-foreground text-xs truncate leading-tight">
                      {user.name}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {isDeveloper ? (
                        <Badge variant="outline" className="text-[9px] py-0 px-1 bg-blue-50 text-blue-700 border-blue-200">
                          Developer
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] py-0 px-1 bg-emerald-50 text-emerald-700 border-emerald-200">
                          Class Owner
                        </Badge>
                      )}
                      <span className="text-[10px] font-mono text-muted-foreground truncate">
                        @{user.username}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => logout()}
                  title="Sign Out"
                  className="p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="px-1">
              <p className="font-semibold text-foreground truncate">
                {settings?.institute_name || 'Sutawane Classes'}
              </p>
              <p className="text-[11px] text-muted-foreground/80 mt-0.5">Desktop Management v1.0</p>
            </div>
            <button
              type="button"
              onClick={toggleSidebar}
              className="w-full mt-2.5 pt-2 border-t border-border/60 flex items-center justify-between text-muted-foreground hover:text-foreground transition-colors"
              title="Collapse sidebar (Ctrl+B)"
            >
              <span className="text-[11px] font-medium flex items-center gap-1.5">
                <PanelLeftClose className="w-3.5 h-3.5" />
                <span>Collapse menu</span>
              </span>
              <kbd className="text-[10px] bg-background px-1.5 py-0.5 rounded border border-border/80 text-muted-foreground font-mono">
                Ctrl+B
              </kbd>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            {user && (
              <button
                type="button"
                onClick={() => logout()}
                className="w-8 h-8 rounded-full bg-background border flex items-center justify-center text-muted-foreground hover:text-red-600 hover:border-red-200 transition-colors shadow-xs group relative"
                title={`Sign Out (${user.username})`}
              >
                <LogOut className="w-3.5 h-3.5" />
                <div className="absolute left-full ml-2.5 px-2.5 py-1 bg-popover text-popover-foreground text-xs font-medium rounded-md shadow-md border opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-150 z-50 whitespace-nowrap">
                  Sign Out ({user.username})
                </div>
              </button>
            )}

            <button
              type="button"
              onClick={toggleSidebar}
              className="w-full flex flex-col items-center justify-center p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors group relative"
              title="Expand menu (Ctrl+B)"
              aria-label="Expand menu"
            >
              <PanelLeftOpen className="w-4 h-4" />
              <span className="text-[9px] font-medium mt-1">Expand</span>
              {/* Tooltip on hover */}
              <div className="absolute left-full ml-2.5 px-2.5 py-1 bg-popover text-popover-foreground text-xs font-medium rounded-md shadow-md border opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-150 z-50 whitespace-nowrap">
                Expand menu (Ctrl+B)
              </div>
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
