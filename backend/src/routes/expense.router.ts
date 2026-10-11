import { Router, Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { prisma } from '../services/db'
import { storagePaths } from '../config/index'

export const expenseRouter = Router()

// Configure Multer for expense bill attachments
const attachmentStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, storagePaths.attachmentsDir)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg'
    cb(null, `bill-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}${ext}`)
  },
})

const attachmentUpload = multer({
  storage: attachmentStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (allowed.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Only images (JPEG, PNG, WebP) and PDF documents are allowed'))
    }
  },
})

// GET expense categories
expenseRouter.get('/categories', async (req: Request, res: Response) => {
  try {
    const { all } = req.query
    const where = all === 'true' ? {} : { isActive: true }

    const categories = await prisma.expenseCategory.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    })
    res.json(categories)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories', details: String(error) })
  }
})

// POST create expense category
expenseRouter.post('/categories', async (req: Request, res: Response) => {
  try {
    const { name, sortOrder } = req.body
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Category name is required' })
    }

    const category = await prisma.expenseCategory.upsert({
      where: { name: String(name).trim() },
      update: { isActive: true },
      create: {
        name: String(name).trim(),
        sortOrder: Number(sortOrder) || 10,
        isActive: true,
      },
    })

    res.status(201).json(category)
  } catch (error) {
    res.status(500).json({ error: 'Failed to create category', details: String(error) })
  }
})

// PATCH toggle category active status
expenseRouter.patch('/categories/:id/status', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    const { isActive } = req.body

    const category = await prisma.expenseCategory.update({
      where: { id },
      data: { isActive: Boolean(isActive) },
    })

    res.json(category)
  } catch (error) {
    res.status(500).json({ error: 'Failed to update category status', details: String(error) })
  }
})

// GET expenses with rich filters
expenseRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { branchId, categoryId, paymentMode, startDate, endDate, search } = req.query

    const where: any = {}
    if (branchId && branchId !== 'ALL') {
      where.branchId = String(branchId)
    }
    if (categoryId && categoryId !== 'ALL') {
      where.categoryId = String(categoryId)
    }
    if (paymentMode && paymentMode !== 'ALL') {
      where.paymentMode = String(paymentMode)
    }

    if (startDate || endDate) {
      where.expenseDate = {}
      if (startDate) {
        where.expenseDate.gte = new Date(String(startDate))
      }
      if (endDate) {
        const end = new Date(String(endDate))
        end.setHours(23, 59, 59, 999)
        where.expenseDate.lte = end
      }
    }

    if (search && String(search).trim()) {
      const q = String(search).trim()
      where.OR = [
        { description: { contains: q } },
        { vendor: { contains: q } },
        { referenceNumber: { contains: q } },
      ]
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        category: true,
        branch: true,
        attachments: true,
      },
      orderBy: { expenseDate: 'desc' },
    })

    res.json(expenses)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch expenses', details: String(error) })
  }
})

// GET expense category summary statistics
expenseRouter.get('/stats/summary', async (req: Request, res: Response) => {
  try {
    const { branchId, startDate, endDate } = req.query

    const where: any = {}
    if (branchId && branchId !== 'ALL') {
      where.branchId = String(branchId)
    }
    if (startDate || endDate) {
      where.expenseDate = {}
      if (startDate) where.expenseDate.gte = new Date(String(startDate))
      if (endDate) {
        const end = new Date(String(endDate))
        end.setHours(23, 59, 59, 999)
        where.expenseDate.lte = end
      }
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: { category: true },
    })

    const categoryMap: Record<string, { name: string; total: number; count: number }> = {}
    let grandTotal = 0

    for (const exp of expenses) {
      const catName = exp.category.name
      if (!categoryMap[catName]) {
        categoryMap[catName] = { name: catName, total: 0, count: 0 }
      }
      categoryMap[catName].total += exp.amount
      categoryMap[catName].count += 1
      grandTotal += exp.amount
    }

    res.json({
      grandTotal,
      expenseCount: expenses.length,
      byCategory: Object.values(categoryMap),
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to compute expense summary', details: String(error) })
  }
})

// POST create expense (supports optional file attachment)
expenseRouter.post('/', attachmentUpload.single('attachment'), async (req: Request, res: Response) => {
  try {
    const {
      description,
      amount,
      categoryId,
      categoryName,
      paymentMode,
      vendor,
      referenceNumber,
      branchId,
      expenseDate,
    } = req.body

    const numAmount = Number(amount)
    if (!description || !numAmount || numAmount <= 0) {
      if (req.file) fs.unlinkSync(req.file.path)
      return res.status(400).json({ error: 'Valid description and positive amount are required' })
    }

    // Resolve branch
    let targetBranchId = branchId
    if (!targetBranchId) {
      const defaultBranch = await prisma.branch.findFirst({ where: { isActive: true } })
      targetBranchId = defaultBranch?.id
    }
    if (!targetBranchId) {
      if (req.file) fs.unlinkSync(req.file.path)
      return res.status(400).json({ error: 'No active branch available' })
    }

    // Resolve category
    let targetCategoryId = categoryId
    if (!targetCategoryId) {
      const name = categoryName || 'Miscellaneous'
      let cat = await prisma.expenseCategory.findUnique({ where: { name } })
      if (!cat) {
        cat = await prisma.expenseCategory.create({ data: { name } })
      }
      targetCategoryId = cat.id
    }

    const expense = await prisma.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: {
          branchId: targetBranchId,
          categoryId: targetCategoryId,
          amount: numAmount,
          description: String(description).trim(),
          paymentMode: paymentMode || 'UPI',
          vendor: vendor ? String(vendor).trim() : null,
          referenceNumber: referenceNumber ? String(referenceNumber).trim() : null,
          expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
        },
        include: {
          category: true,
          branch: true,
          attachments: true,
        },
      })

      // If attachment was uploaded
      if (req.file) {
        await tx.expenseAttachment.create({
          data: {
            expenseId: created.id,
            fileName: req.file.originalname,
            filePath: `/api/uploads/attachments/${req.file.filename}`,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
          },
        })
      }

      return created
    })

    const result = await prisma.expense.findUnique({
      where: { id: expense.id },
      include: {
        category: true,
        branch: true,
        attachments: true,
      },
    })

    res.status(201).json(result)
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path)
      } catch {
        // ignore
      }
    }
    res.status(500).json({ error: 'Failed to record expense', details: String(error) })
  }
})

// PUT update expense
expenseRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    const { description, amount, categoryId, paymentMode, vendor, referenceNumber, expenseDate, branchId } =
      req.body

    const existing = await prisma.expense.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ error: 'Expense not found' })
    }

    const updated = await prisma.expense.update({
      where: { id },
      data: {
        description: description ? String(description).trim() : undefined,
        amount: amount !== undefined ? Number(amount) : undefined,
        categoryId: categoryId || undefined,
        branchId: branchId || undefined,
        paymentMode: paymentMode || undefined,
        vendor: vendor !== undefined ? (vendor ? String(vendor).trim() : null) : undefined,
        referenceNumber:
          referenceNumber !== undefined ? (referenceNumber ? String(referenceNumber).trim() : null) : undefined,
        expenseDate: expenseDate ? new Date(expenseDate) : undefined,
      },
      include: {
        category: true,
        branch: true,
        attachments: true,
      },
    })

    res.json(updated)
  } catch (error) {
    res.status(500).json({ error: 'Failed to update expense', details: String(error) })
  }
})

// DELETE expense
expenseRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)

    const expense = await prisma.expense.findUnique({
      where: { id },
      include: { attachments: true },
    })

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' })
    }

    // Unlink attachment files from disk
    for (const att of expense.attachments) {
      const fileName = path.basename(att.filePath)
      const fullPath = path.join(storagePaths.attachmentsDir, fileName)
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath)
        } catch {
          // ignore
        }
      }
    }

    await prisma.expense.delete({ where: { id } })

    res.json({ success: true, message: 'Expense deleted successfully' })
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete expense', details: String(error) })
  }
})
