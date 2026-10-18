import React, { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useApp } from '@/context/AppContext'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Settings,
  Save,
  CheckCircle2,
  Upload,
  Trash2,
  Building2,
  Image as ImageIcon,
  AlertCircle,
  Globe,
  Phone,
  Mail,
  MapPin,
  FileText,
} from 'lucide-react'

export const SettingsPage: React.FC = () => {
  const queryClient = useQueryClient()
  const { refetchSettings } = useApp()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [instituteName, setInstituteName] = useState('')
  const [tagline, setTagline] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [website, setWebsite] = useState('')
  const [receiptFooter, setReceiptFooter] = useState('')
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  const [toastMsg, setToastMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // Query existing settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['institute-settings'],
    queryFn: () => api.get('/settings'),
  })

  // Populate form when data loads
  useEffect(() => {
    if (settings) {
      setInstituteName(settings.institute_name || 'Sutawane Classes')
      setTagline(settings.tagline || 'Excellence in Coaching & Board Preparations')
      setPhone(settings.phone || '+91 98765 43210')
      setEmail(settings.email || 'contact@sutawaneclasses.com')
      setAddress(settings.address || 'Main Head Office, Maharashtra')
      setWebsite(settings.website || 'www.sutawaneclasses.com')
      setReceiptFooter(settings.receipt_footer || 'Fees once paid are non-refundable. Thank you!')
      setLogoPreview(settings.logo_url || null)
    }
  }, [settings])

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 4000)
  }

  // Save Settings Mutation
  const saveMutation = useMutation({
    mutationFn: (data: any) => api.post('/settings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['institute-settings'] })
      refetchSettings()
      showToast('Institute settings saved successfully!')
      setErrorMsg('')
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to save settings')
    },
  })

  // Upload Master Logo Mutation
  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('logo', file)
      return api.post('/settings/logo', formData)
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['institute-settings'] })
      refetchSettings()
      setLogoPreview(res.logoUrl)
      showToast('Master institute logo uploaded successfully!')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to upload master logo')
    },
  })

  // Remove Master Logo Mutation
  const removeLogoMutation = useMutation({
    mutationFn: () => api.delete('/settings/logo'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['institute-settings'] })
      refetchSettings()
      setLogoPreview(null)
      showToast('Master institute logo removed')
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to remove master logo')
    },
  })

  // Factory Data Wipe Mutation
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false)
  const [confirmDeleteText, setConfirmDeleteText] = useState('')

  const resetDataMutation = useMutation({
    mutationFn: () => api.post('/settings/reset-all-data'),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries()
      refetchSettings()
      setIsResetConfirmOpen(false)
      setConfirmDeleteText('')
      showToast(res.message || 'All data has been deleted. System is now fresh and production-ready!')
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to delete all data')
    },
  })

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrorMsg('Logo file size must not exceed 5 MB')
        return
      }
      uploadLogoMutation.mutate(file)
    }
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    saveMutation.mutate({
      institute_name: instituteName.trim(),
      tagline: tagline.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
      website: website.trim(),
      receipt_footer: receiptFooter.trim(),
    })
  }

  return (
    <div className="space-y-6 max-w-4xl pb-10">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 p-4 bg-foreground text-background rounded-xl shadow-xl flex items-center gap-2 text-sm font-medium animate-in fade-in slide-in-from-bottom-4 border">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {toastMsg}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" />
          Institute Settings &amp; Master Branding
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configure central coaching branding, default institute logo, receipt templates, and organization profile.
        </p>
      </div>

      {errorMsg && (
        <div className="p-3 bg-destructive/10 text-destructive border border-destructive/20 text-sm rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Section 1: Master Institute Logo */}
      <Card className="border shadow-sm">
        <CardHeader className="py-4 border-b bg-muted/20">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-primary" />
            Common Master Institute Logo
          </CardTitle>
          <CardDescription className="text-xs">
            This master logo will be used by default across all branches, fee receipts, identity cards, and application headers.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Logo Display Box */}
            <div className="relative group w-36 h-36 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/30 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-inner">
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Institute Master Logo"
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <div className="text-center p-3">
                  <Building2 className="w-10 h-10 text-muted-foreground/50 mx-auto mb-1" />
                  <span className="text-[11px] text-muted-foreground font-medium block">
                    No logo uploaded
                  </span>
                </div>
              )}
            </div>

            {/* Logo Actions and Instructions */}
            <div className="space-y-3 flex-1 text-xs">
              <div>
                <h4 className="font-semibold text-foreground text-sm">Upload Central Brand Logo</h4>
                <p className="text-muted-foreground mt-0.5 leading-relaxed">
                  Recommended dimensions: <strong>400 × 400 px or horizontal logo (PNG, JPG, SVG, WebP)</strong>. Transparent backgrounds work best on printed receipts. Maximum file size: 5 MB.
                </p>
              </div>

              <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-900 dark:text-blue-200 text-[11px]">
                <strong>Branch Override Support:</strong> If an individual coaching branch has its own different logo (e.g., Nagpur Center vs. Wardha Academy), you can upload a branch-specific logo in <strong>Branch Management</strong>. If no branch logo is set, this master logo will be automatically used.
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/webp, image/svg+xml"
                  onChange={handleLogoFileChange}
                  className="hidden"
                />

                <Button
                  type="button"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadLogoMutation.isPending}
                  className="gap-1.5 text-xs h-8"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {uploadLogoMutation.isPending ? 'Uploading...' : logoPreview ? 'Change Master Logo' : 'Upload Logo'}
                </Button>

                {logoPreview && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeLogoMutation.mutate()}
                    disabled={removeLogoMutation.isPending}
                    className="gap-1.5 text-xs h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove Logo
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Institute Profile & Receipt Terms */}
      <Card className="border shadow-sm">
        <CardHeader className="py-4 border-b bg-muted/20">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            Institute Profile &amp; Receipt Configuration
          </CardTitle>
          <CardDescription className="text-xs">
            These parameters appear on official student fee receipts, reports, and tax declarations.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                  Institute Name (Printed on Receipts) *
                </label>
                <Input
                  value={instituteName}
                  onChange={(e) => setInstituteName(e.target.value)}
                  placeholder="e.g. Sutawane Classes"
                  required
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                  Tagline / Academic Subtitle
                </label>
                <Input
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="e.g. Excellence in Coaching & Board Preparations"
                  className="text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                  Central Contact Phone
                </label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                  Official Email Address
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@sutawaneclasses.com"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                  Official Website / Portal
                </label>
                <Input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="www.sutawaneclasses.com"
                  className="text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                Central Head Office Address
              </label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Central Head Office, Station Road, Maharashtra"
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                Receipt Footer Terms &amp; Conditions
              </label>
              <Input
                value={receiptFooter}
                onChange={(e) => setReceiptFooter(e.target.value)}
                placeholder="e.g. Fees once paid are non-refundable. Receipts must be preserved."
                className="text-xs"
              />
            </div>

            <div className="pt-3 border-t flex justify-end">
              <Button type="submit" disabled={saveMutation.isPending} className="gap-2 text-xs h-9">
                <Save className="w-4 h-4" />
                {saveMutation.isPending ? 'Saving Settings...' : 'Save Institute Settings'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Section 3: Danger Zone - Factory Data Reset */}
      <Card className="border border-rose-500/40 bg-rose-50/20 dark:bg-rose-950/10 shadow-sm">
        <CardHeader className="py-4 border-b border-rose-200/60 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20">
          <CardTitle className="text-base font-bold text-rose-700 dark:text-rose-400 flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-rose-600" />
            Danger Zone: Delete All Data (Factory Clean)
          </CardTitle>
          <CardDescription className="text-xs text-rose-900/80 dark:text-rose-300/80">
            Permanently clear all student admissions, fee receipts, installment schedules, and operational expenses to prepare for clean production launch.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-1">
              <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Preserved As Is:
              </span>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                All User Accounts &amp; Login Credentials (Class Owner &amp; Developer), Institute Logo, Branches, Sessions, Courses, and System Configuration.
              </p>
            </div>
            <div className="p-3 rounded-lg border border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 space-y-1">
              <span className="font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                Permanently Cleared:
              </span>
              <p className="text-[11px] text-rose-700 dark:text-rose-400">
                All Student Records, Roll Numbers, Admission History, Fee Collections, Receipts, Outstanding Dues, and Expense Vouchers.
              </p>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t">
            <p className="text-xs text-muted-foreground">
              Once deleted, transactional records cannot be recovered unless restored from an external database backup.
            </p>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setConfirmDeleteText('')
                setIsResetConfirmOpen(true)
              }}
              className="gap-1.5 text-xs font-bold shrink-0 bg-rose-600 hover:bg-rose-700 text-white"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete All Data
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Modal for Resetting All Data */}
      <AlertDialog open={isResetConfirmOpen} onOpenChange={setIsResetConfirmOpen}>
        <AlertDialogContent className="max-w-md border-rose-500/40">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-rose-600 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-600" />
              Confirm Factory Data Wipe
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs space-y-2.5 pt-2">
              <p>
                Are you sure you want to permanently delete all student admissions, fee payments, and operational expenses from the software?
              </p>
              <div className="p-2.5 rounded bg-muted/60 border text-[11px] space-y-1 text-foreground">
                <p><strong>Login credentials will NOT be changed.</strong> You can log in using your existing username and password.</p>
                <p>Receipt counters will be reset to 0 so fresh production receipts start cleanly.</p>
              </div>
              <p className="font-medium text-rose-600 pt-1">
                Type <strong>DELETE</strong> below to confirm:
              </p>
              <Input
                value={confirmDeleteText}
                onChange={(e) => setConfirmDeleteText(e.target.value)}
                placeholder="Type DELETE"
                className="text-xs font-mono"
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0 pt-2">
            <AlertDialogCancel disabled={resetDataMutation.isPending} onClick={() => setIsResetConfirmOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmDeleteText.trim().toUpperCase() !== 'DELETE' || resetDataMutation.isPending}
              onClick={() => resetDataMutation.mutate()}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
            >
              {resetDataMutation.isPending ? 'Deleting All Data...' : 'Confirm & Wipe All Data'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
