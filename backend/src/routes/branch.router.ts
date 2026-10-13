import { Router, Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { prisma } from '../services/db'
import { storagePaths } from '../config/index'

export const branchRouter = Router()

// Configure Multer for branch logo upload
const branchLogoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, storagePaths.photosDir)
  },
  filename: (req, file, cb) => {
    const branchId = String(req.params.id || 'new')
    const ext = path.extname(file.originalname) || '.png'
    cb(null, `logo-branch-${branchId}-${Date.now()}${ext}`)
  },
})

const branchLogoUpload = multer({
  storage: branchLogoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Only image files (PNG, JPG, SVG, WebP) are allowed'))
    }
  },
})

// GET all branches
branchRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const branches = await prisma.branch.findMany({
      orderBy: { createdAt: 'asc' },
    })
    res.json(branches)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch branches', details: String(error) })
  }
})

// POST create branch
branchRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { name, code, address, phone, contactPerson, logoUrl } = req.body

    if (!name || !code) {
      return res.status(400).json({ error: 'Branch name and code are required' })
    }

    const existingCode = await prisma.branch.findUnique({
      where: { code: code.toUpperCase() },
    })
    if (existingCode) {
      return res.status(409).json({ error: `Branch code ${code} is already in use` })
    }

    const existingName = await prisma.branch.findUnique({
      where: { name },
    })
    if (existingName) {
      return res.status(409).json({ error: `Branch name ${name} already exists` })
    }

    const branch = await prisma.branch.create({
      data: {
        name,
        code: code.toUpperCase(),
        address: address || null,
        phone: phone || null,
        contactPerson: contactPerson || null,
        logoUrl: logoUrl || null,
        isActive: true,
      },
    })

    res.status(201).json(branch)
  } catch (error) {
    res.status(500).json({ error: 'Failed to create branch', details: String(error) })
  }
})

// PUT update branch
branchRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    const { name, code, address, phone, contactPerson, logoUrl } = req.body

    const updateData: any = {
      name,
      code: code?.toUpperCase(),
      address: address || null,
      phone: phone || null,
      contactPerson: contactPerson || null,
    }

    if (logoUrl !== undefined) {
      updateData.logoUrl = logoUrl || null
    }

    const updated = await prisma.branch.update({
      where: { id },
      data: updateData,
    })

    res.json(updated)
  } catch (error) {
    res.status(500).json({ error: 'Failed to update branch', details: String(error) })
  }
})

// POST upload branch-specific logo
branchRouter.post('/:id/logo', branchLogoUpload.single('logo'), async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)

    if (!req.file) {
      return res.status(400).json({ error: 'No logo image file was provided' })
    }

    const branch = await prisma.branch.findUnique({
      where: { id },
    })

    if (!branch) {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path)
      }
      return res.status(404).json({ error: 'Branch not found' })
    }

    // Delete old branch logo if it exists
    if (branch.logoUrl) {
      const oldFileName = path.basename(branch.logoUrl)
      const oldFilePath = path.join(storagePaths.photosDir, oldFileName)
      if (fs.existsSync(oldFilePath)) {
        try {
          fs.unlinkSync(oldFilePath)
        } catch {
          // ignore
        }
      }
    }

    const logoUrl = `/api/uploads/photos/${req.file.filename}`

    const updated = await prisma.branch.update({
      where: { id },
      data: { logoUrl },
    })

    res.json({
      success: true,
      logoUrl,
      branch: updated,
      message: 'Branch logo updated successfully',
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload branch logo', details: String(error) })
  }
})

// DELETE branch logo (revert to master logo)
branchRouter.delete('/:id/logo', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)

    const branch = await prisma.branch.findUnique({
      where: { id },
    })

    if (!branch) {
      return res.status(404).json({ error: 'Branch not found' })
    }

    if (branch.logoUrl) {
      const oldFileName = path.basename(branch.logoUrl)
      const oldFilePath = path.join(storagePaths.photosDir, oldFileName)
      if (fs.existsSync(oldFilePath)) {
        try {
          fs.unlinkSync(oldFilePath)
        } catch {
          // ignore
        }
      }
    }

    const updated = await prisma.branch.update({
      where: { id },
      data: { logoUrl: null },
    })

    res.json({
      success: true,
      branch: updated,
      message: 'Branch logo removed. Will use default master logo.',
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove branch logo', details: String(error) })
  }
})

// PATCH toggle active status
branchRouter.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    const { isActive } = req.body

    const updated = await prisma.branch.update({
      where: { id },
      data: { isActive: Boolean(isActive) },
    })

    res.json(updated)
  } catch (error) {
    res.status(500).json({ error: 'Failed to update branch status', details: String(error) })
  }
})
