import { Router, Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { prisma } from '../services/db'
import { storagePaths } from '../config/index'

export const settingRouter = Router()

// Configure Multer for master logo upload
const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, storagePaths.photosDir)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png'
    cb(null, `logo-master-${Date.now()}${ext}`)
  },
})

const logoUpload = multer({
  storage: logoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Only image files (PNG, JPG, SVG, WebP) are allowed'))
    }
  },
})

// GET all settings
settingRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const records = await prisma.systemSetting.findMany()
    const settingsMap = records.reduce((acc, curr) => {
      acc[curr.key] = curr.value
      return acc
    }, {} as Record<string, string>)

    res.json({
      institute_name: settingsMap.institute_name || 'Sutawane Classes',
      tagline: settingsMap.tagline || 'Excellence in Coaching & Board Preparations',
      phone: settingsMap.phone || '+91 98765 43210',
      email: settingsMap.email || 'contact@sutawaneclasses.com',
      address: settingsMap.address || 'Main Head Office, Maharashtra',
      website: settingsMap.website || 'www.sutawaneclasses.com',
      receipt_footer: settingsMap.receipt_footer || 'Fees once paid are non-refundable. Thank you!',
      logo_url: settingsMap.logo_url || null,
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings', details: String(error) })
  }
})

// POST update settings
settingRouter.post('/', async (req: Request, res: Response) => {
  try {
    const updates = req.body || {}

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && value !== null) {
        await prisma.systemSetting.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) },
        })
      }
    }

    res.json({ success: true, message: 'Settings saved successfully' })
  } catch (error) {
    res.status(500).json({ error: 'Failed to save settings', details: String(error) })
  }
})

// POST upload master institute logo
settingRouter.post('/logo', logoUpload.single('logo'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No logo image file was provided' })
    }

    // Check if previous logo exists and delete old file
    const existing = await prisma.systemSetting.findUnique({
      where: { key: 'logo_url' },
    })

    if (existing?.value) {
      const oldFileName = path.basename(existing.value)
      const oldFilePath = path.join(storagePaths.photosDir, oldFileName)
      if (fs.existsSync(oldFilePath)) {
        try {
          fs.unlinkSync(oldFilePath)
        } catch {
          // ignore unlink error
        }
      }
    }

    const logoUrl = `/api/uploads/photos/${req.file.filename}`

    await prisma.systemSetting.upsert({
      where: { key: 'logo_url' },
      update: { value: logoUrl },
      create: { key: 'logo_url', value: logoUrl },
    })

    res.json({
      success: true,
      logoUrl,
      message: 'Master institute logo updated successfully',
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload master logo', details: String(error) })
  }
})

// DELETE master logo
settingRouter.delete('/logo', async (_req: Request, res: Response) => {
  try {
    const existing = await prisma.systemSetting.findUnique({
      where: { key: 'logo_url' },
    })

    if (existing?.value) {
      const oldFileName = path.basename(existing.value)
      const oldFilePath = path.join(storagePaths.photosDir, oldFileName)
      if (fs.existsSync(oldFilePath)) {
        try {
          fs.unlinkSync(oldFilePath)
        } catch {
          // ignore
        }
      }
    }

    await prisma.systemSetting.upsert({
      where: { key: 'logo_url' },
      update: { value: '' },
      create: { key: 'logo_url', value: '' },
    })

    res.json({ success: true, message: 'Master logo removed' })
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete master logo', details: String(error) })
  }
})

// POST reset all transactional data (Factory Reset - preserves users, login credentials & master settings)
settingRouter.post('/reset-all-data', async (_req: Request, res: Response) => {
  try {
    // 1. Delete all student & fee transaction records in cascade-safe order
    await prisma.paymentAllocation.deleteMany({})
    await prisma.payment.deleteMany({})
    await prisma.receiptCounter.deleteMany({})
    await prisma.installment.deleteMany({})
    await prisma.feeDiscount.deleteMany({})
    await prisma.feePlan.deleteMany({})
    await prisma.previousSessionDue.deleteMany({})
    await prisma.studentAdmission.deleteMany({})
    await prisma.student.deleteMany({})

    // 2. Delete all expense records and attachments
    await prisma.expenseAttachment.deleteMany({})
    await prisma.expense.deleteMany({})

    // 3. Delete health logs
    await prisma.healthLog.deleteMany({})

    // 4. Clean up uploaded photos and attachments files on disk (preserving logo)
    if (fs.existsSync(storagePaths.photosDir)) {
      const photoFiles = fs.readdirSync(storagePaths.photosDir)
      for (const f of photoFiles) {
        if (f !== '.gitkeep' && !f.startsWith('logo-')) {
          try {
            fs.unlinkSync(path.join(storagePaths.photosDir, f))
          } catch {}
        }
      }
    }

    if (fs.existsSync(storagePaths.attachmentsDir)) {
      const attachmentFiles = fs.readdirSync(storagePaths.attachmentsDir)
      for (const f of attachmentFiles) {
        if (f !== '.gitkeep') {
          try {
            fs.unlinkSync(path.join(storagePaths.attachmentsDir, f))
          } catch {}
        }
      }
    }

    // 5. Initialize clean ReceiptCounter for active branches and sessions
    const activeBranches = await prisma.branch.findMany({ where: { isActive: true } })
    const activeSessions = await prisma.academicSession.findMany({ where: { isActive: true } })
    for (const b of activeBranches) {
      for (const s of activeSessions) {
        const prefix = `${b.code}-${s.name}`
        await prisma.receiptCounter.upsert({
          where: { branchId_sessionId: { branchId: b.id, sessionId: s.id } },
          update: { lastNumber: 0, prefix },
          create: { branchId: b.id, sessionId: s.id, prefix, lastNumber: 0 },
        })
      }
    }

    // NOTE: User accounts (login credentials), branches, sessions, courses, and system settings are strictly KEPT AS IS!

    res.json({
      success: true,
      message: 'All transactional data, students, fees, and expenses deleted successfully. User accounts, credentials, and master settings have been preserved.',
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset all data', details: String(error) })
  }
})

