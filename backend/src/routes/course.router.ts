import { Router, Request, Response } from 'express'
import { prisma } from '../services/db'

export const courseRouter = Router()

const DEFAULT_COURSES = [
  { name: 'Class 8', code: 'C8', defaultFee: 15000, sortOrder: 1 },
  { name: 'Class 9', code: 'C9', defaultFee: 18000, sortOrder: 2 },
  { name: 'Class 10', code: 'C10', defaultFee: 22000, sortOrder: 3 },
  { name: 'Class 11 Science', code: 'C11-SCI', defaultFee: 35000, sortOrder: 4 },
  { name: 'Class 11 Commerce', code: 'C11-COM', defaultFee: 25000, sortOrder: 5 },
  { name: 'Class 12 Science', code: 'C12-SCI', defaultFee: 40000, sortOrder: 6 },
  { name: 'Class 12 Commerce', code: 'C12-COM', defaultFee: 28000, sortOrder: 7 },
  { name: 'MHT-CET / JEE Foundation', code: 'ENGG-FND', defaultFee: 20000, sortOrder: 8 },
]

/**
 * Auto-seed standard institute courses if Course table is empty
 * or sync existing student standards.
 */
async function ensureCoursesSeeded() {
  const existingCount = await prisma.course.count()
  if (existingCount === 0) {
    // 1. Seed defaults
    for (const c of DEFAULT_COURSES) {
      await prisma.course.upsert({
        where: { name: c.name },
        update: {},
        create: {
          name: c.name,
          code: c.code,
          defaultFee: c.defaultFee,
          sortOrder: c.sortOrder,
          isActive: true,
        },
      })
    }

    // 2. Discover any unique standards already used in student admissions
    const existingAdmissions = await prisma.studentAdmission.findMany({
      select: { standard: true },
      distinct: ['standard'],
    })

    let nextSortOrder = 20
    for (const adm of existingAdmissions) {
      if (adm.standard && adm.standard.trim()) {
        const stdName = adm.standard.trim()
        const found = await prisma.course.findUnique({ where: { name: stdName } })
        if (!found) {
          await prisma.course.create({
            data: {
              name: stdName,
              code: stdName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || null,
              sortOrder: nextSortOrder++,
              isActive: true,
            },
          })
        }
      }
    }
  }
}

// GET all courses
courseRouter.get('/', async (req: Request, res: Response) => {
  try {
    await ensureCoursesSeeded()

    const { activeOnly } = req.query
    const where: any = {}
    if (activeOnly === 'true') {
      where.isActive = true
    }

    const courses = await prisma.course.findMany({
      where,
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
    })

    // Compute enrolled student count for each course
    const coursesWithCount = await Promise.all(
      courses.map(async (course) => {
        const enrolledCount = await prisma.studentAdmission.count({
          where: { standard: course.name },
        })
        return {
          ...course,
          enrolledCount,
        }
      })
    )

    res.json(coursesWithCount)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch courses', details: String(error) })
  }
})

// POST create course
courseRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { name, code, description, defaultFee, sortOrder, isActive } = req.body

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Course name is required' })
    }

    const trimmedName = String(name).trim()

    const existing = await prisma.course.findUnique({
      where: { name: trimmedName },
    })

    if (existing) {
      return res.status(409).json({ error: `Course "${trimmedName}" already exists` })
    }

    const course = await prisma.course.create({
      data: {
        name: trimmedName,
        code: code ? String(code).trim().toUpperCase() : null,
        description: description ? String(description).trim() : null,
        defaultFee: defaultFee !== undefined && defaultFee !== null && defaultFee !== '' ? Number(defaultFee) : null,
        sortOrder: sortOrder !== undefined && sortOrder !== null ? Number(sortOrder) : 0,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    })

    res.status(201).json({
      ...course,
      enrolledCount: 0,
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to create course', details: String(error) })
  }
})

// PUT update course
courseRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    const { name, code, description, defaultFee, sortOrder, isActive } = req.body

    const existing = await prisma.course.findUnique({
      where: { id },
    })

    if (!existing) {
      return res.status(404).json({ error: 'Course not found' })
    }

    let trimmedName = existing.name
    if (name && String(name).trim()) {
      trimmedName = String(name).trim()

      if (trimmedName.toLowerCase() !== existing.name.toLowerCase()) {
        const duplicate = await prisma.course.findUnique({
          where: { name: trimmedName },
        })
        if (duplicate && duplicate.id !== id) {
          return res.status(409).json({ error: `Course "${trimmedName}" already exists` })
        }
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // If name changed, synchronize student admissions
      if (trimmedName !== existing.name) {
        await tx.studentAdmission.updateMany({
          where: { standard: existing.name },
          data: { standard: trimmedName },
        })
      }

      const updated = await tx.course.update({
        where: { id },
        data: {
          name: trimmedName,
          code: code !== undefined ? (code ? String(code).trim().toUpperCase() : null) : existing.code,
          description: description !== undefined ? (description ? String(description).trim() : null) : existing.description,
          defaultFee: defaultFee !== undefined ? (defaultFee !== null && defaultFee !== '' ? Number(defaultFee) : null) : existing.defaultFee,
          sortOrder: sortOrder !== undefined ? Number(sortOrder) : existing.sortOrder,
          isActive: isActive !== undefined ? Boolean(isActive) : existing.isActive,
        },
      })

      const enrolledCount = await tx.studentAdmission.count({
        where: { standard: updated.name },
      })

      return {
        ...updated,
        enrolledCount,
      }
    })

    res.json(result)
  } catch (error) {
    res.status(500).json({ error: 'Failed to update course', details: String(error) })
  }
})

// DELETE course
courseRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)

    const existing = await prisma.course.findUnique({
      where: { id },
    })

    if (!existing) {
      return res.status(404).json({ error: 'Course not found' })
    }

    const enrolledCount = await prisma.studentAdmission.count({
      where: { standard: existing.name },
    })

    if (enrolledCount > 0) {
      return res.status(400).json({
        error: `Cannot delete course "${existing.name}" because ${enrolledCount} student admission(s) are currently enrolled. You can deactivate it instead to hide it from new admissions.`,
      })
    }

    await prisma.course.delete({
      where: { id },
    })

    res.json({
      success: true,
      message: `Course "${existing.name}" deleted successfully`,
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete course', details: String(error) })
  }
})
