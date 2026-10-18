import { Router, Request, Response } from 'express'
import { prisma } from '../services/db'

export const sessionRouter = Router()

/**
 * Format a Date to 'YYYY-MM-DD' calendar date string
 */
function toDateOnlyString(d: Date | string): string {
  const date = new Date(d)
  return date.toISOString().split('T')[0]
}

/**
 * Check if two calendar date ranges [startA, endA] and [startB, endB] overlap
 */
function doDateRangesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  return startA <= endB && endA >= startB
}

// GET all sessions with record counts
sessionRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const sessions = await prisma.academicSession.findMany({
      orderBy: { startDate: 'desc' },
      include: {
        _count: {
          select: {
            admissions: true,
            feePlans: true,
            payments: true,
          },
        },
      },
    })
    res.json(sessions)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch academic sessions', details: String(error) })
  }
})

// POST create session with strict overlap validation
sessionRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { name, displayName, startDate, endDate, isCurrent } = req.body

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Session code is required (e.g. 2026-27)' })
    }
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Both Start Date and End Date are required' })
    }

    const startStr = toDateOnlyString(startDate)
    const endStr = toDateOnlyString(endDate)

    // 1. Start date must be strictly before End date
    if (startStr >= endStr) {
      return res.status(400).json({
        error: `Invalid date range: Start Date (${startStr}) must be strictly before End Date (${endStr}).`,
      })
    }

    const trimmedName = String(name).trim()
    const existing = await prisma.academicSession.findUnique({
      where: { name: trimmedName },
    })
    if (existing) {
      return res.status(409).json({
        error: `Session code '${trimmedName}' already exists. Please choose a unique session code.`,
      })
    }

    // 2. Strict Overlap Validation against ALL existing sessions
    const allSessions = await prisma.academicSession.findMany()
    for (const s of allSessions) {
      const existStart = toDateOnlyString(s.startDate)
      const existEnd = toDateOnlyString(s.endDate)
      if (doDateRangesOverlap(startStr, endStr, existStart, existEnd)) {
        return res.status(400).json({
          error: `Date overlap error: The selected range (${startStr} to ${endStr}) overlaps with existing session '${s.displayName || s.name}' (${existStart} to ${existEnd}). Academic sessions cannot have overlapping dates.`,
          overlappingSession: s,
        })
      }
    }

    // If marked current, unset all other sessions first
    if (isCurrent) {
      await prisma.academicSession.updateMany({
        data: { isCurrent: false },
      })
    }

    const session = await prisma.academicSession.create({
      data: {
        name: trimmedName,
        displayName: displayName ? String(displayName).trim() : `Academic Year ${trimmedName}`,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isCurrent: Boolean(isCurrent),
        isActive: true,
      },
      include: {
        _count: {
          select: {
            admissions: true,
            feePlans: true,
            payments: true,
          },
        },
      },
    })

    res.status(201).json(session)
  } catch (error) {
    res.status(500).json({ error: 'Failed to create academic session', details: String(error) })
  }
})

// PUT update session with strict overlap validation
sessionRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    const { name, displayName, startDate, endDate, isCurrent, isActive } = req.body

    const session = await prisma.academicSession.findUnique({
      where: { id },
    })
    if (!session) {
      return res.status(404).json({ error: 'Academic session not found' })
    }

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Session code is required (e.g. 2026-27)' })
    }
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Both Start Date and End Date are required' })
    }

    const startStr = toDateOnlyString(startDate)
    const endStr = toDateOnlyString(endDate)

    // 1. Start date must be strictly before End date
    if (startStr >= endStr) {
      return res.status(400).json({
        error: `Invalid date range: Start Date (${startStr}) must be strictly before End Date (${endStr}).`,
      })
    }

    const trimmedName = String(name).trim()
    if (trimmedName !== session.name) {
      const existingName = await prisma.academicSession.findUnique({
        where: { name: trimmedName },
      })
      if (existingName && existingName.id !== id) {
        return res.status(409).json({
          error: `Session code '${trimmedName}' is already used by another session.`,
        })
      }
    }

    // 2. Strict Overlap Validation against ALL OTHER sessions
    const otherSessions = await prisma.academicSession.findMany({
      where: { id: { not: id } },
    })
    for (const s of otherSessions) {
      const existStart = toDateOnlyString(s.startDate)
      const existEnd = toDateOnlyString(s.endDate)
      if (doDateRangesOverlap(startStr, endStr, existStart, existEnd)) {
        return res.status(400).json({
          error: `Date overlap error: The updated range (${startStr} to ${endStr}) overlaps with existing session '${s.displayName || s.name}' (${existStart} to ${existEnd}). Academic sessions cannot have overlapping dates.`,
          overlappingSession: s,
        })
      }
    }

    // If marked current, unset all other sessions first
    if (isCurrent) {
      await prisma.academicSession.updateMany({
        where: { id: { not: id } },
        data: { isCurrent: false },
      })
    }

    const updated = await prisma.academicSession.update({
      where: { id },
      data: {
        name: trimmedName,
        displayName: displayName ? String(displayName).trim() : `Academic Year ${trimmedName}`,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isCurrent: Boolean(isCurrent),
        isActive: isActive !== undefined ? Boolean(isActive) : session.isActive,
      },
      include: {
        _count: {
          select: {
            admissions: true,
            feePlans: true,
            payments: true,
          },
        },
      },
    })

    res.json(updated)
  } catch (error) {
    res.status(500).json({ error: 'Failed to update academic session', details: String(error) })
  }
})

// DELETE session (Strictly blocked if data exists)
sessionRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)

    const session = await prisma.academicSession.findUnique({
      where: { id },
    })
    if (!session) {
      return res.status(404).json({ error: 'Academic session not found' })
    }

    // 1. Cannot delete current active session
    if (session.isCurrent) {
      return res.status(400).json({
        error: `Cannot delete '${session.displayName || session.name}' because it is currently set as the Active Session. Please set another session as current before deleting this one.`,
      })
    }

    // 2. Strict Check: Are ANY records associated with this session?
    const [admissionsCount, feePlansCount, paymentsCount, originalDuesCount, currentDuesCount] =
      await Promise.all([
        prisma.studentAdmission.count({ where: { sessionId: id } }),
        prisma.feePlan.count({ where: { sessionId: id } }),
        prisma.payment.count({ where: { sessionId: id } }),
        prisma.previousSessionDue.count({ where: { originalSessionId: id } }),
        prisma.previousSessionDue.count({ where: { currentSessionId: id } }),
      ])

    const totalDataCount =
      admissionsCount + feePlansCount + paymentsCount + originalDuesCount + currentDuesCount

    if (totalDataCount > 0) {
      return res.status(409).json({
        error: `Cannot delete session '${session.name}': This session has active linked records (${admissionsCount} student enrollments, ${feePlansCount} fee plans, ${paymentsCount} payments). To preserve financial integrity and student audit history, sessions with existing data cannot be deleted.`,
        counts: {
          admissions: admissionsCount,
          feePlans: feePlansCount,
          payments: paymentsCount,
          originalDues: originalDuesCount,
          currentDues: currentDuesCount,
        },
      })
    }

    // Safe to delete when 0 linked data records
    await prisma.receiptCounter.deleteMany({ where: { sessionId: id } })
    await prisma.academicSession.delete({ where: { id } })

    res.json({
      success: true,
      message: `Academic session '${session.displayName || session.name}' was permanently deleted.`,
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete academic session', details: String(error) })
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
      include: {
        _count: {
          select: {
            admissions: true,
            feePlans: true,
            payments: true,
          },
        },
      },
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
      include: {
        _count: {
          select: {
            admissions: true,
            feePlans: true,
            payments: true,
          },
        },
      },
    })

    res.json(updated)
  } catch (error) {
    res.status(500).json({ error: 'Failed to update session status', details: String(error) })
  }
})
