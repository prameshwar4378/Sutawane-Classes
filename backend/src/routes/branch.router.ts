import { Router, Request, Response } from 'express'
import { prisma } from '../services/db'

export const branchRouter = Router()

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
    const { name, code, address, phone, contactPerson } = req.body

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
    const { name, code, address, phone, contactPerson } = req.body

    const updated = await prisma.branch.update({
      where: { id },
      data: {
        name,
        code: code?.toUpperCase(),
        address: address || null,
        phone: phone || null,
        contactPerson: contactPerson || null,
      },
    })

    res.json(updated)
  } catch (error) {
    res.status(500).json({ error: 'Failed to update branch', details: String(error) })
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
