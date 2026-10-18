import React, { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Database,
  Download,
  RotateCcw,
  ShieldCheck,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  UploadCloud,
  FileArchive,
  Trash2,
  Image as ImageIcon,
  Receipt,
  Clock,
  RefreshCw,
  FolderOpen,
} from 'lucide-react'

interface BackupRecord {
  fileName: string
  sizeBytes: number
  createdAt: string
  type: 'FULL_ZIP' | 'DB_ONLY'
  photosCount?: number
  attachmentsCount?: number
  isSafetySnapshot?: boolean
}

interface BackupStats {
  dbSize: number
  photosCount: number
  photosSizeBytes: number
  attachmentsCount: number
  attachmentsSizeBytes: number
  backupsCount: number
  storageLocation: {
    baseDir: string
    databasePath: string
    photosDir: string
    attachmentsDir: string
    backupsDir: string
  }
}

interface BackupResponse {
  success: boolean
  stats: BackupStats
  backups: BackupRecord[]
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString)
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return isoString
  }
}

export const BackupPage: React.FC = () => {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [notification, setNotification] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  // Target backup for restore dialog
  const [restoreTarget, setRestoreTarget] = useState<BackupRecord | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BackupRecord | null>(null)
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null)
  const [showUploadRestoreDialog, setShowUploadRestoreDialog] = useState(false)

  // Fetch telemetry & snapshots
  const { data, isLoading, refetch } = useQuery<BackupResponse>({
    queryKey: ['backups-data'],
    queryFn: () => api.get('/backup'),
  })

  const notify = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 7000)
  }

  // Mutation: Create Full Archive
  const createBackupMutation = useMutation({
    mutationFn: () => api.post('/backup/create', {}),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['backups-data'] })
      const b = res.backup
      notify(
        'success',
        `Full backup "${b.fileName}" (${formatBytes(b.sizeBytes)}) created! Included ${b.photosCount} photos & ${b.attachmentsCount} attachments.`
      )
    },
    onError: (err: any) => {
      notify('error', err.message || 'Failed to create complete backup.')
    },
  })

  // Mutation: Local Restore
  const localRestoreMutation = useMutation({
    mutationFn: (fileName: string) => api.post('/backup/restore-local', { fileName }),
    onSuccess: (res: any) => {
      setRestoreTarget(null)
      queryClient.invalidateQueries()
      notify('success', res.message || 'Restore completed successfully!')
    },
    onError: (err: any) => {
      notify('error', err.message || 'Restore failed.')
    },
  })

  // Mutation: Upload & Restore
  const uploadRestoreMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData()
      formData.append('backupFile', file)
      return api.post('/backup/upload-restore', formData)
    },
    onSuccess: (res: any) => {
      setShowUploadRestoreDialog(false)
      setSelectedUploadFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      queryClient.invalidateQueries()
      notify('success', res.message || 'Uploaded backup restored successfully!')
    },
    onError: (err: any) => {
      notify('error', err.message || 'Upload restore failed.')
    },
  })

  // Mutation: Delete Snapshot
  const deleteMutation = useMutation({
    mutationFn: (fileName: string) => api.delete(`/backup/${encodeURIComponent(fileName)}`),
    onSuccess: () => {
      setDeleteTarget(null)
      queryClient.invalidateQueries({ queryKey: ['backups-data'] })
      notify('success', 'Backup snapshot removed.')
    },
    onError: (err: any) => {
      notify('error', err.message || 'Failed to remove backup.')
    },
  })

  // Trigger Download via Browser
  const handleDownload = (fileName: string) => {
    const downloadUrl = `/api/backup/${encodeURIComponent(fileName)}/download`
    const link = document.createElement('a')
    link.href = downloadUrl
    link.setAttribute('download', fileName)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
      if (ext !== '.zip' && ext !== '.db') {
        notify('error', 'Only .zip (Full Backup) or .db (Database) files can be restored.')
        return
      }
      setSelectedUploadFile(file)
      setShowUploadRestoreDialog(true)
    }
  }

  const stats = data?.stats
  const backups = data?.backups || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Database className="w-6 h-6 text-primary" />
            Backup & Data Restore
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Safeguard and restore your entire system: database, student photos, fee receipts, and expense vouchers with zero data loss guarantee.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
          className="gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Status
        </Button>
      </div>

      {/* Notifications */}
      {notification && (
        <div
          className={`p-4 rounded-lg text-sm flex items-start gap-3 border ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
          )}
          <div className="flex-1 font-medium">{notification.message}</div>
        </div>
      )}

      {/* Storage Telemetry Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-card/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 rounded-lg text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Database (sutawane.db)</p>
              <p className="text-lg font-bold text-foreground">
                {stats ? formatBytes(stats.dbSize) : '—'}
              </p>
              <p className="text-[11px] text-muted-foreground">SQLite 3 Local Persistent</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 rounded-lg text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Student & Institute Photos</p>
              <p className="text-lg font-bold text-foreground">
                {stats ? stats.photosCount : 0}{' '}
                <span className="text-xs font-normal text-muted-foreground">
                  ({stats ? formatBytes(stats.photosSizeBytes) : '0 B'})
                </span>
              </p>
              <p className="text-[11px] text-emerald-600 font-medium">Included in Full Backup</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-100 rounded-lg text-purple-600 dark:bg-purple-950 dark:text-purple-400">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Expense Vouchers</p>
              <p className="text-lg font-bold text-foreground">
                {stats ? stats.attachmentsCount : 0}{' '}
                <span className="text-xs font-normal text-muted-foreground">
                  ({stats ? formatBytes(stats.attachmentsSizeBytes) : '0 B'})
                </span>
              </p>
              <p className="text-[11px] text-purple-600 font-medium">Included in Full Backup</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 rounded-lg text-amber-600 dark:bg-amber-950 dark:text-amber-400">
              <FileArchive className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Saved Snapshots</p>
              <p className="text-lg font-bold text-foreground">
                {stats ? stats.backupsCount : backups.length}
              </p>
              <p className="text-[11px] text-muted-foreground">Stored locally in AppData</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Action Cards: Create Backup & Upload/Restore */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Create Backup Card */}
        <Card className="border-primary/20 shadow-sm flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              1. Create Complete System Backup (.zip)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Generates a full portable <span className="font-semibold text-foreground">.zip archive</span> bundled with your SQLite database, all student profile pictures, institute logos, and expense vouchers.
            </p>

            <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-1.5 border">
              <div className="flex items-center gap-2 text-foreground font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Zero Cloud Dependency: Stored locally & immediately downloadable</span>
              </div>
              <div className="flex items-center gap-2 text-foreground font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Safe WAL flush: Writes all pending transactions to disk before archiving</span>
              </div>
            </div>

            <Button
              onClick={() => createBackupMutation.mutate()}
              disabled={createBackupMutation.isPending}
              className="w-full gap-2 text-sm h-10 font-semibold"
            >
              <FileArchive className="w-4 h-4" />
              {createBackupMutation.isPending ? 'Bundling & Compressing...' : 'Create Full Backup (.zip) Now'}
            </Button>
          </CardContent>
        </Card>

        {/* Upload & Restore Card */}
        <Card className="border-blue-500/20 shadow-sm flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-blue-600" />
              2. Upload & Restore External Backup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Restore data from a USB pendrive or external drive. Accepts either a <span className="font-semibold text-foreground">.zip archive</span> (Full DB + Photos) or a legacy <span className="font-semibold text-foreground">.db</span> file.
            </p>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs space-y-1 text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-1.5 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                Automatic Safety Guarantee:
              </div>
              <p className="text-[11px] leading-relaxed">
                Before restoring, the system automatically saves a safety snapshot of your active database and media. You can revert back at any time.
              </p>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              accept=".zip,.db"
              onChange={handleFileSelect}
              className="hidden"
            />

            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-full gap-2 text-sm h-10 font-semibold border-blue-400/40 hover:bg-blue-50/50 dark:hover:bg-blue-950/40 text-blue-700 dark:text-blue-300"
            >
              <UploadCloud className="w-4 h-4 text-blue-600" />
              Select Backup File to Restore (.zip / .db)
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Backup Snapshots Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Available Backup Snapshots ({backups.length})
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Download snapshots for pendrive backup, or restore directly to rollback system data.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {backups.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              <FileArchive className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
              No backup snapshots found. Click &quot;Create Full Backup (.zip) Now&quot; above to create your first snapshot.
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30%]">Snapshot File</TableHead>
                    <TableHead className="w-[18%]">Type & Contents</TableHead>
                    <TableHead className="w-[18%]">Date Created</TableHead>
                    <TableHead className="w-[12%]">Size</TableHead>
                    <TableHead className="text-right w-[22%]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backups.map((b) => (
                    <TableRow key={b.fileName} className={b.isSafetySnapshot ? 'bg-amber-50/30 dark:bg-amber-950/10' : ''}>
                      <TableCell className="font-mono text-xs font-semibold text-foreground break-all">
                        <div className="flex items-center gap-2">
                          {b.type === 'FULL_ZIP' ? (
                            <FileArchive className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <Database className="w-4 h-4 text-blue-600 shrink-0" />
                          )}
                          <span>{b.fileName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 items-start">
                          {b.type === 'FULL_ZIP' ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[11px] gap-1">
                              <ShieldCheck className="w-3 h-3" />
                              Full Archive (.zip)
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300 text-[11px] gap-1">
                              <Database className="w-3 h-3" />
                              Database Snapshot (.db)
                            </Badge>
                          )}
                          {b.isSafetySnapshot && (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-[10px]">
                              Auto Safety Snapshot
                            </Badge>
                          )}
                          {b.photosCount !== undefined && (
                            <span className="text-[10px] text-muted-foreground">
                              {b.photosCount} photos &bull; {b.attachmentsCount ?? 0} vouchers
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(b.createdAt)}
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {formatBytes(b.sizeBytes)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Download Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Download to PC / USB Pendrive"
                            onClick={() => handleDownload(b.fileName)}
                            className="h-8 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                          >
                            <Download className="w-3.5 h-3.5 mr-1" />
                            Download
                          </Button>

                          {/* Restore Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Restore software to this snapshot"
                            onClick={() => setRestoreTarget(b)}
                            className="h-8 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1" />
                            Restore
                          </Button>

                          {/* Delete Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Delete this snapshot from disk"
                            onClick={() => setDeleteTarget(b)}
                            className="h-8 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Directory Storage Path Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-muted-foreground" />
            Storage Locations on This Computer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <p className="text-muted-foreground">
            All coaching data resides strictly on this machine in the local OS AppData folder with zero external exposure:
          </p>
          <div className="p-3 bg-muted/60 rounded-lg font-mono text-[11px] space-y-1.5 break-all border">
            <div>
              <strong className="text-foreground">Database: </strong>
              {stats?.storageLocation?.databasePath || 'data/dev/database/sutawane.db'}
            </div>
            <div>
              <strong className="text-foreground">Student Photos: </strong>
              {stats?.storageLocation?.photosDir || 'data/dev/photos'}
            </div>
            <div>
              <strong className="text-foreground">Expense Attachments: </strong>
              {stats?.storageLocation?.attachmentsDir || 'data/dev/attachments'}
            </div>
            <div>
              <strong className="text-foreground">Backups Directory: </strong>
              {stats?.storageLocation?.backupsDir || 'data/dev/backups'}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Recommended Practice: Click &quot;Download&quot; on your latest .zip backup once a week and save it to an external USB flash drive.
          </p>
        </CardContent>
      </Card>

      {/* Modal: Confirm Restore from Local Snapshot */}
      <Dialog open={!!restoreTarget} onOpenChange={(open) => !open && setRestoreTarget(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Confirm System Restore
            </DialogTitle>
            <DialogDescription className="text-xs pt-1">
              You are about to restore system data from the following snapshot:
            </DialogDescription>
          </DialogHeader>

          {restoreTarget && (
            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 bg-muted rounded-lg space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Snapshot File:</span>
                  <span className="font-mono font-semibold text-foreground break-all">{restoreTarget.fileName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Snapshot Date:</span>
                  <span className="font-semibold text-foreground">{formatDate(restoreTarget.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Archive Size:</span>
                  <span className="font-semibold text-foreground">{formatBytes(restoreTarget.sizeBytes)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Archive Type:</span>
                  <span className="font-semibold text-emerald-600">
                    {restoreTarget.type === 'FULL_ZIP' ? 'Full Archive (DB + Photos + Vouchers)' : 'Database Only (.db)'}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg space-y-1">
                <div className="font-semibold flex items-center gap-1.5 text-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Pre-Restore Safety Snapshot Guaranteed
                </div>
                <p className="text-[11px] leading-relaxed">
                  The system will automatically generate a timestamped safety backup of your current active records before replacing anything.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRestoreTarget(null)}
              disabled={localRestoreMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => restoreTarget && localRestoreMutation.mutate(restoreTarget.fileName)}
              disabled={localRestoreMutation.isPending}
              className="gap-1.5"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${localRestoreMutation.isPending ? 'animate-spin' : ''}`} />
              {localRestoreMutation.isPending ? 'Restoring System...' : 'Confirm & Restore Now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Confirm Upload & Restore External Backup */}
      <Dialog open={showUploadRestoreDialog} onOpenChange={(open) => !open && setShowUploadRestoreDialog(false)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-600">
              <UploadCloud className="w-5 h-5 text-blue-600" />
              Restore Uploaded Backup File
            </DialogTitle>
            <DialogDescription className="text-xs pt-1">
              Verify the selected backup file before restoring to this installation:
            </DialogDescription>
          </DialogHeader>

          {selectedUploadFile && (
            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 bg-muted rounded-lg space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Selected File:</span>
                  <span className="font-mono font-semibold text-foreground break-all">{selectedUploadFile.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">File Size:</span>
                  <span className="font-semibold text-foreground">{formatBytes(selectedUploadFile.size)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Format:</span>
                  <span className="font-semibold text-foreground">
                    {selectedUploadFile.name.endsWith('.zip') ? 'Full System Archive (.zip)' : 'Database Snapshot (.db)'}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg space-y-1">
                <div className="font-semibold flex items-center gap-1.5 text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Warning: Active Data Replacement
                </div>
                <p className="text-[11px] leading-relaxed">
                  Restoring will update the active database and overwrite media files matching this backup. An automatic safety snapshot of current data will be taken first.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowUploadRestoreDialog(false)
                setSelectedUploadFile(null)
                if (fileInputRef.current) fileInputRef.current.value = ''
              }}
              disabled={uploadRestoreMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => selectedUploadFile && uploadRestoreMutation.mutate(selectedUploadFile)}
              disabled={uploadRestoreMutation.isPending}
              className="gap-1.5"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${uploadRestoreMutation.isPending ? 'animate-spin' : ''}`} />
              {uploadRestoreMutation.isPending ? 'Uploading & Restoring...' : 'Confirm Upload & Restore'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Confirm Delete Backup */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5 text-red-600" />
              Delete Backup Snapshot
            </DialogTitle>
            <DialogDescription className="text-xs pt-1">
              Are you sure you want to delete <span className="font-mono font-semibold">{deleteTarget?.fileName}</span>? This file will be permanently removed from disk.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.fileName)}
              disabled={deleteMutation.isPending}
              className="gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
