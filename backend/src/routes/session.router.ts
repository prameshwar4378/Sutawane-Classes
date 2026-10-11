import { Router, Request, Response } from 'express'
import { prisma } from '../services/db'

export const sessionRouter = Router()

// GET all sessions
sessionRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const sessions = await prisma.academicSession.findMany({
      orderBy: { startDate: 'desc' },
    })
    res.json(sessions)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch academic sessions', details: String(error) })
  }
})

// POST create session
sessionRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { name, displayName, startDate, endDate, isCurrent } = req.body

    if (!name) {
      return res.status(400).json({ error: 'Session name is required (e.g. 2026-27)' })
    }

    const existing = await prisma.academicSession.findUnique({
      where: { name },
    })
    if (existing) {
      return res.status(409).json({ error: `Session ${name} already exists` })
    }

    // If marked current, unset all other sessions first
    if (isCurrent) {
      await prisma.academicSession.updateMany({
        data: { isCurrent: false },
      })
    }

    const session = await prisma.academicSession.create({
      data: {
        name,
        displayName: displayName || `Academic Year ${name}`,
        startDate: new Date(startDate || Date.now()),
        endDate: new Date(endDate || Date.now() + 365 * 24 * 3600 * 1000),
        isCurrent: Boolean(isCurrent),
        isActive: true,
      },
    })

    res.status(201).json(session)
  } catch (error) {
    res.status(500).json({ error: 'Failed to create academic session', details: String(error) })
  }
})

// PATCH set as current session
sessionRouter.patch('/:id/set-current', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)

    await prisma.$transaction([
      prisma.academicSession.updateMany({
        data: { isCurrent: false },
      }),
      prisma.academicSession.update({
        where: { id },
        data: { isCurrent: true, isActive: true },
      }),
    ])

    const updated = await prisma.academicSession.findUnique({
      where: { id },
    })

    res.json(updated)
  } catch (error) {
    res.status(500).json({ error: 'Failed to set current academic session', details: String(error) })
  }
})

// PATCH toggle status
sessionRouter.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    const { isActive } = req.body

    const updated = await prisma.academicSession.update({
      where: { id },
      data: { isActive: Boolean(isActive) },
    })

    res.json(updated)
  } catch (error) {
    res.status(500).json({ error: 'Failed to update session status', details: String(error) })
  }
})
