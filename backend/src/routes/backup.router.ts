import { Router, Request, Response } from 'express'
import fs from 'fs'
import path from 'path'
import multer from 'multer'
import AdmZip from 'adm-zip'
import { prisma } from '../services/db'
import { storagePaths } from '../config/index'

export const backupRouter = Router()

// Helper: Safely calculate directory stats
function getDirStats(dirPath: string): { count: number; totalBytes: number } {
  if (!fs.existsSync(dirPath)) return { count: 0, totalBytes: 0 }
  try {
    const files = fs.readdirSync(dirPath)
    let totalBytes = 0
    let count = 0
    for (const f of files) {
      const full = path.join(dirPath, f)
      try {
        const stat = fs.statSync(full)
        if (stat.isFile()) {
          count++
          totalBytes += stat.size
        }
      } catch {}
    }
    return { count, totalBytes }
  } catch {
    return { count: 0, totalBytes: 0 }
  }
}

// Helper: Create a safety snapshot of current DB + Media
export async function createFullBackupSnapshot(labelPrefix = 'sutawane-full-backup'): Promise<{
  fileName: string
  filePath: string
  sizeBytes: number
  photosCount: number
  attachmentsCount: number
  createdAt: string
}> {
  // 1. Force SQLite WAL checkpoint so DB file has all recent data
  try {
    await prisma.$queryRawUnsafe('PRAGMA wal_checkpoint(FULL);')
  } catch {}

  const now = new Date()
  const timestamp = now.toISOString().replace(/[:.]/g, '-')
  const fileName = `${labelPrefix}-${timestamp}.zip`
  const filePath = path.join(storagePaths.backupsDir, fileName)

  const zip = new AdmZip()

  // Add Database
  let dbSize = 0
  if (fs.existsSync(storagePaths.databasePath)) {
    dbSize = fs.statSync(storagePaths.databasePath).size
    zip.addLocalFile(storagePaths.databasePath, '', 'sutawane.db')
  }

  // Add Photos (Student photos, Institute logos, Branch logos)
  let photosCount = 0
  if (fs.existsSync(storagePaths.photosDir)) {
    const photoFiles = fs.readdirSync(storagePaths.photosDir)
    for (const file of photoFiles) {
      const full = path.join(storagePaths.photosDir, file)
      try {
        if (fs.statSync(full).isFile()) {
          zip.addLocalFile(full, 'photos')
          photosCount++
        }
      } catch {}
    }
  }

  // Add Attachments (Expense vouchers, receipts, bills)
  let attachmentsCount = 0
  if (fs.existsSync(storagePaths.attachmentsDir)) {
    const attachmentFiles = fs.readdirSync(storagePaths.attachmentsDir)
    for (const file of attachmentFiles) {
      const full = path.join(storagePaths.attachmentsDir, file)
      try {
        if (fs.statSync(full).isFile()) {
          zip.addLocalFile(full, 'attachments')
          attachmentsCount++
        }
      } catch {}
    }
  }

  // Add Metadata Manifest
  const manifest = {
    version: '1.0',
    appName: 'Sutawane Classes Management Software',
    createdAt: now.toISOString(),
    dbSize,
    photosCount,
    attachmentsCount,
    system: process.platform,
    databaseEngine: 'SQLite 3 Local Persistent',
  }
  zip.addFile('backup-meta.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'))

  // Write zip to disk
  zip.writeZip(filePath)
  const sizeBytes = fs.statSync(filePath).size

  return {
    fileName,
    filePath,
    sizeBytes,
    photosCount,
    attachmentsCount,
    createdAt: now.toISOString(),
  }
}

// Multer upload config for external backup restore
const backupUpload = multer({
  dest: storagePaths.backupsDir,
  limits: { fileSize: 300 * 1024 * 1024 }, // 300 MB max archive size
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (ext === '.zip' || ext === '.db') {
      cb(null, true)
    } else {
      cb(new Error('Only .zip (Full Backup) or .db (Database Snapshot) files are accepted for restore'))
    }
  },
})

/**
 * Core Restore Engine: Restores DB and Media safely with rollback protection
 */
async function executeRestoreFromFile(
  targetFilePath: string,
  originalFilename: string
): Promise<{
  safetySnapshot: string
  restoredPhotos: number
  restoredAttachments: number
  dbSizeBytes: number
  message: string
}> {
  if (!fs.existsSync(targetFilePath)) {
    throw new Error('Target backup file does not exist on disk')
  }

  const ext = path.extname(targetFilePath).toLowerCase() || path.extname(originalFilename).toLowerCase()

  // 1. Automatic Pre-Restore Safety Snapshot (Zero Data Loss Guarantee)
  const safety = await createFullBackupSnapshot('sutawane-pre-restore-safety')

  let restoredPhotos = 0
  let restoredAttachments = 0
  let newDbSize = 0

  if (ext === '.zip') {
    const zip = new AdmZip(targetFilePath)
    const entries = zip.getEntries()

    // Verify zip contains a SQLite database
    const dbEntry = entries.find(
      (e) => e.entryName === 'sutawane.db' || (!e.isDirectory && e.entryName.endsWith('.db'))
    )
    if (!dbEntry) {
      throw new Error('Corrupted or invalid backup archive: No SQLite database file found inside the zip.')
    }

    // Disconnect Prisma and release file handles
    await prisma.$disconnect()
    await new Promise((resolve) => setTimeout(resolve, 150))

    // Clear stale SQLite WAL / SHM files
    const walPath = `${storagePaths.databasePath}-wal`
    const shmPath = `${storagePaths.databasePath}-shm`
    if (fs.existsSync(walPath)) {
      try {
        fs.unlinkSync(walPath)
      } catch {}
    }
    if (fs.existsSync(shmPath)) {
      try {
        fs.unlinkSync(shmPath)
      } catch {}
    }

    // Write restored database
    fs.writeFileSync(storagePaths.databasePath, dbEntry.getData())
    newDbSize = fs.statSync(storagePaths.databasePath).size

    // Extract Photos
    for (const entry of entries) {
      if (entry.isDirectory) continue
      const name = entry.entryName
      if (name.startsWith('photos/') || name.startsWith('photos\\')) {
        const fileName = path.basename(name)
        if (fileName && fileName !== 'photos') {
          fs.writeFileSync(path.join(storagePaths.photosDir, fileName), entry.getData())
          restoredPhotos++
        }
      } else if (name.startsWith('attachments/') || name.startsWith('attachments\\')) {
        const fileName = path.basename(name)
        if (fileName && fileName !== 'attachments') {
          fs.writeFileSync(path.join(storagePaths.attachmentsDir, fileName), entry.getData())
          restoredAttachments++
        }
      }
    }

    // Reconnect Prisma & Verify Integrity
    await prisma.$connect()
    const check: any = await prisma.$queryRawUnsafe('PRAGMA integrity_check;')
    if (!check || !Array.isArray(check) || check[0]?.integrity_check !== 'ok') {
      throw new Error(`Restored database failed integrity check: ${JSON.stringify(check)}`)
    }

    return {
      safetySnapshot: safety.fileName,
      restoredPhotos,
      restoredAttachments,
      dbSizeBytes: newDbSize,
      message: `Full system restore complete: Database restored (${Math.round(newDbSize / 1024)} KB), ${restoredPhotos} photos, and ${restoredAttachments} attachments recovered.`,
    }
  } else if (ext === '.db') {
    // Validate SQLite Magic Header (First 16 bytes: "SQLite format 3\0")
    const fd = fs.openSync(targetFilePath, 'r')
    const headerBuffer = Buffer.alloc(16)
    fs.readSync(fd, headerBuffer, 0, 16, 0)
    fs.closeSync(fd)

    const headerStr = headerBuffer.toString('utf8')
    if (!headerStr.startsWith('SQLite format 3')) {
      throw new Error('Invalid database file: header does not match SQLite format 3.')
    }

    // Disconnect Prisma
    await prisma.$disconnect()
    await new Promise((resolve) => setTimeout(resolve, 150))

    // Clear stale WAL/SHM
    const walPath = `${storagePaths.databasePath}-wal`
    const shmPath = `${storagePaths.databasePath}-shm`
    if (fs.existsSync(walPath)) {
      try {
        fs.unlinkSync(walPath)
      } catch {}
    }
    if (fs.existsSync(shmPath)) {
      try {
        fs.unlinkSync(shmPath)
      } catch {}
    }

    // Replace database
    fs.copyFileSync(targetFilePath, storagePaths.databasePath)
    newDbSize = fs.statSync(storagePaths.databasePath).size

    // Reconnect Prisma
    await prisma.$connect()
    const check: any = await prisma.$queryRawUnsafe('PRAGMA integrity_check;')
    if (!check || !Array.isArray(check) || check[0]?.integrity_check !== 'ok') {
      throw new Error(`Restored database failed integrity check: ${JSON.stringify(check)}`)
    }

    return {
      safetySnapshot: safety.fileName,
      restoredPhotos: 0,
      restoredAttachments: 0,
      dbSizeBytes: newDbSize,
      message: `Database snapshot restore complete (${Math.round(newDbSize / 1024)} KB).`,
    }
  } else {
    throw new Error('Unsupported backup file extension. Only .zip and .db files are supported.')
  }
}

/**
 * GET /api/backup
 * Lists all existing backups in persistent storage and provides system storage stats
 */
backupRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const backupsDir = storagePaths.backupsDir
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true })
    }

    const files = fs.readdirSync(backupsDir)
    const backupsList: Array<{
      fileName: string
      sizeBytes: number
      createdAt: string
      type: 'FULL_ZIP' | 'DB_ONLY'
      photosCount?: number
      attachmentsCount?: number
      isSafetySnapshot?: boolean
    }> = []

    for (const f of files) {
      const full = path.join(backupsDir, f)
      try {
        const stat = fs.statSync(full)
        if (!stat.isFile()) continue

        const ext = path.extname(f).toLowerCase()
        if (ext !== '.zip' && ext !== '.db') continue

        let type: 'FULL_ZIP' | 'DB_ONLY' = ext === '.zip' ? 'FULL_ZIP' : 'DB_ONLY'
        let photosCount: number | undefined
        let attachmentsCount: number | undefined
        const isSafetySnapshot = f.includes('pre-restore-safety')

        if (ext === '.zip') {
          try {
            const zip = new AdmZip(full)
            const metaEntry = zip.getEntry('backup-meta.json')
            if (metaEntry) {
              const meta = JSON.parse(metaEntry.getData().toString('utf8'))
              photosCount = meta.photosCount
              attachmentsCount = meta.attachmentsCount
            } else {
              // Count from entries directly
              const entries = zip.getEntries()
              photosCount = entries.filter((e) => e.entryName.startsWith('photos/') && !e.isDirectory).length
              attachmentsCount = entries.filter((e) => e.entryName.startsWith('attachments/') && !e.isDirectory).length
            }
          } catch {}
        }

        backupsList.push({
          fileName: f,
          sizeBytes: stat.size,
          createdAt: stat.mtime.toISOString(),
          type,
          photosCount,
          attachmentsCount,
          isSafetySnapshot,
        })
      } catch {}
    }

    // Sort newest first
    backupsList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    // Telemetry storage stats
    const dbExists = fs.existsSync(storagePaths.databasePath)
    const dbSize = dbExists ? fs.statSync(storagePaths.databasePath).size : 0
    const photosStats = getDirStats(storagePaths.photosDir)
    const attachmentsStats = getDirStats(storagePaths.attachmentsDir)

    res.json({
      success: true,
      stats: {
        dbSize,
        photosCount: photosStats.count,
        photosSizeBytes: photosStats.totalBytes,
        attachmentsCount: attachmentsStats.count,
        attachmentsSizeBytes: attachmentsStats.totalBytes,
        backupsCount: backupsList.length,
        storageLocation: {
          baseDir: storagePaths.baseDir,
          databasePath: storagePaths.databasePath,
          photosDir: storagePaths.photosDir,
          attachmentsDir: storagePaths.attachmentsDir,
          backupsDir: storagePaths.backupsDir,
        },
      },
      backups: backupsList,
    })
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch backup records', details: error.message })
  }
})

/**
 * POST /api/backup/create
 * Creates a complete full backup archive (.zip) containing SQLite DB + all photos + attachments + metadata
 */
backupRouter.post('/create', async (_req: Request, res: Response) => {
  try {
    const backup = await createFullBackupSnapshot()
    res.status(201).json({
      success: true,
      message: 'Full backup archive created successfully including SQLite database and media files.',
      backup,
    })
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create complete backup archive', details: error.message })
  }
})

/**
 * GET /api/backup/:fileName/download
 * Streams the backup file directly to browser for download
 */
backupRouter.get('/:fileName/download', (req: Request, res: Response) => {
  try {
    const fileName = String(req.params.fileName)
    // Prevent path traversal
    const safeName = path.basename(fileName)
    const filePath = path.join(storagePaths.backupsDir, safeName)

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Requested backup file does not exist' })
    }

    res.download(filePath, safeName)
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to download backup file', details: error.message })
  }
})

/**
 * POST /api/backup/restore-local
 * Restores data from an existing local snapshot in backupsDir
 */
backupRouter.post('/restore-local', async (req: Request, res: Response) => {
  try {
    const { fileName } = req.body
    if (!fileName || !String(fileName).trim()) {
      return res.status(400).json({ error: 'Backup fileName is required for local restore' })
    }

    const safeName = path.basename(String(fileName).trim())
    const filePath = path.join(storagePaths.backupsDir, safeName)

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: `Backup snapshot "${safeName}" not found in storage.` })
    }

    const result = await executeRestoreFromFile(filePath, safeName)
    res.json({
      success: true,
      ...result,
    })
  } catch (error: any) {
    console.error('Local restore failure:', error)
    res.status(500).json({ error: 'Failed to restore backup snapshot', details: error.message })
  }
})

/**
 * POST /api/backup/upload-restore
 * Uploads an external .zip or .db backup file and restores DB & media files
 */
backupRouter.post('/upload-restore', backupUpload.single('backupFile'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No backup file uploaded. Please select a .zip or .db file.' })
    }

    const tempPath = req.file.path
    const originalName = req.file.originalname
    const ext = path.extname(originalName).toLowerCase()
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const permanentName = `sutawane-uploaded-${timestamp}${ext}`
    const permanentPath = path.join(storagePaths.backupsDir, permanentName)

    // Save uploaded file into backupsDir with permanent name
    fs.renameSync(tempPath, permanentPath)

    // Execute restore
    const result = await executeRestoreFromFile(permanentPath, originalName)

    res.json({
      success: true,
      uploadedFileName: permanentName,
      ...result,
    })
  } catch (error: any) {
    console.error('Upload restore failure:', error)
    res.status(500).json({ error: 'Failed to process uploaded backup file', details: error.message })
  }
})

/**
 * DELETE /api/backup/:fileName
 * Deletes an old backup snapshot
 */
backupRouter.delete('/:fileName', (req: Request, res: Response) => {
  try {
    const fileName = String(req.params.fileName)
    const safeName = path.basename(fileName)
    const filePath = path.join(storagePaths.backupsDir, safeName)

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Backup file not found' })
    }

    fs.unlinkSync(filePath)
    res.json({ success: true, message: `Backup snapshot "${safeName}" removed.` })
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete backup file', details: error.message })
  }
})
