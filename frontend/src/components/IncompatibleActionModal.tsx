import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '@/context/AppContext'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ShieldAlert,
  AlertTriangle,
  X,
  LayoutDashboard,
  Users,
  Calendar,
  Building2,
  CheckCircle2,
  XCircle,
  ArrowRight,
} from 'lucide-react'

export const IncompatibleActionModal: React.FC = () => {
  const { incompatibleModal, confirmIncompatibleSwitch } = useApp()
  const navigate = useNavigate()

  if (!incompatibleModal || !incompatibleModal.isOpen) {
    return null
  }

  const { changeType, targetLabel, entityTitle, reason } = incompatibleModal
  const isSession = changeType === 'session'

  return (
    <Dialog
      open={incompatibleModal.isOpen}
      onOpenChange={(open) => {
        if (!open) {
          confirmIncompatibleSwitch('stay')
        }
      }}
    >
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden border-amber-500/40 bg-card p-5 sm:p-6 shadow-2xl rounded-2xl">
        {/* Header with Icon and Title */}
        <DialogHeader className="space-y-2.5 pb-3 border-b border-border/60 text-left">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0 border-2 border-amber-300 dark:border-amber-800 shadow-xs mt-0.5">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 text-[11px] font-semibold">
                  Action Declined
                </Badge>
                <Badge variant="outline" className="font-mono text-[11px] text-muted-foreground">
                  Data Protection Guard
                </Badge>
              </div>
              <DialogTitle className="text-base sm:text-xl font-bold tracking-tight text-foreground break-words">
                Incompatible {isSession ? 'Academic Session' : 'Branch Location'} Change
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed break-words">
                The requested {isSession ? 'session' : 'branch'} cannot be applied to the active record. The change has been safely declined.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="space-y-3.5 py-1 text-xs sm:text-sm">
          {/* Comparison Grid: Active Record vs Attempted Change */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Box 1: Active Record */}
            <div className="p-3.5 rounded-xl border border-border bg-muted/30 space-y-1.5 flex flex-col justify-between min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span className="truncate">Currently Active Record</span>
              </div>
              <div className="pt-1 min-w-0">
                <p className="font-bold text-foreground text-sm truncate" title={entityTitle}>
                  {entityTitle}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  Locked to student's verified enrollment
                </p>
              </div>
            </div>

            {/* Box 2: Attempted Switch (Declined) */}
            <div className="p-3.5 rounded-xl border border-rose-300/70 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 space-y-1.5 flex flex-col justify-between min-w-0">
              <div className="flex items-center justify-between gap-1.5">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400 min-w-0">
                  <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span className="truncate">Attempted {isSession ? 'Session' : 'Branch'}</span>
                </span>
                <Badge variant="danger" className="text-[10px] px-1.5 py-0 flex-shrink-0">
                  Declined
                </Badge>
              </div>
              <div className="pt-1 min-w-0">
                <div className="flex items-center gap-1.5 font-bold text-rose-700 dark:text-rose-300 text-sm min-w-0">
                  {isSession ? <Calendar className="w-4 h-4 flex-shrink-0 text-rose-600" /> : <Building2 className="w-4 h-4 flex-shrink-0 text-rose-600" />}
                  <span className="truncate" title={targetLabel}>{targetLabel}</span>
                </div>
                <p className="text-xs text-rose-900/70 dark:text-rose-300/70 mt-0.5 truncate">
                  Not enrolled in this {isSession ? 'session' : 'branch'}
                </p>
              </div>
            </div>
          </div>

          {/* Detailed Diagnostic Callout */}
          <div className="p-3.5 sm:p-4 rounded-xl border border-amber-300/70 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1 min-w-0 flex-1">
              <p className="font-semibold text-amber-900 dark:text-amber-200 text-xs sm:text-sm leading-snug break-words">
                {reason}
              </p>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80 leading-relaxed break-words">
                To prevent corrupting fee balances or viewing an empty/invalid profile, switching on this page was blocked. Choose one of the verified actions below:
              </p>
            </div>
          </div>
        </div>

        {/* Responsive Footer with 3 Clearly Differentiated Actions */}
        <DialogFooter className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-3.5 border-t border-border/60 mt-1">
          {/* Left / Secondary Action: Stay Here */}
          <Button
            type="button"
            variant="outline"
            onClick={() => confirmIncompatibleSwitch('stay')}
            className="w-full sm:w-auto gap-1.5 text-xs sm:text-sm font-medium h-9 hover:bg-muted"
          >
            <X className="w-4 h-4" />
            <span>Stay on Profile</span>
          </Button>

          {/* Right Group: Switch & Navigate Actions */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => confirmIncompatibleSwitch('directory', navigate)}
              className="flex-1 sm:flex-initial gap-1.5 text-xs sm:text-sm font-medium h-9"
            >
              <Users className="w-4 h-4" />
              <span>View Students</span>
            </Button>

            <Button
              type="button"
              onClick={() => confirmIncompatibleSwitch('dashboard', navigate)}
              className="flex-1 sm:flex-initial gap-1.5 text-xs sm:text-sm font-semibold h-9 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Go to Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
