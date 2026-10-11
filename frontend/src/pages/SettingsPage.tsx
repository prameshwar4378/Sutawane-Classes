import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Settings, Save, CheckCircle2 } from 'lucide-react'

export const SettingsPage: React.FC = () => {
  const [instituteName, setInstituteName] = useState('Sutawane Classes')
  const [tagline, setTagline] = useState('Excellence in Coaching & Board Preparations')
  const [phone, setPhone] = useState('+91 98765 43210')
  const [email, setEmail] = useState('contact@sutawaneclasses.com')
  const [address, setAddress] = useState('Main Head Office, Station Road, Maharashtra')
  const [receiptFooter, setReceiptFooter] = useState('Fees once paid are non-refundable. Thank you!')
  const [saved, setSaved] = useState(false)

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" />
          Institute Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configure branding, receipts layout, contact details, and system parameters.
        </p>
      </div>

      {saved && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          Settings saved successfully!
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Institute Profile & Receipt Header</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4 max-w-xl">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Institute Name (Printed on Receipts)</label>
              <Input
                value={instituteName}
                onChange={(e) => setInstituteName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Tagline / Subheading</label>
              <Input
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Contact Phone</label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Official Email</label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Central Address</label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Receipt Footer Terms</label>
              <Input
                value={receiptFooter}
                onChange={(e) => setReceiptFooter(e.target.value)}
              />
            </div>

            <Button type="submit" className="gap-2">
              <Save className="w-4 h-4" />
              Save Settings
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
