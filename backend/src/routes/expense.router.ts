import { Router, Request, Response } from 'express'
import { prisma } from '../services/db'

export const expenseRouter = Router()

// GET expense categories
expenseRouter.get('/categories', async (_req: Request, res: Response) => {
  try {
    const categories = await prisma.expenseCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    })
    res.json(categories)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories', details: String(error) })
  }
})

// GET expenses with filters
expenseRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { branchId, categoryId } = req.query

    const where: any = {}
    if (branchId && branchId !== 'ALL') {
      where.branchId = String(branchId)
    }
    if (categoryId) {
      where.categoryId = String(categoryId)
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        category: true,
        branch: true,
      },
      orderBy: { expenseDate: 'desc' },
    })

    res.json(expenses)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch expenses', details: String(error) })
  }
})

// POST create expense
expenseRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { description, amount, category, paymentMode, vendor, referenceNumber, branchId } = req.body

    if (!description || !amount) {
      return res.status(400).json({ error: 'Description and amount are required' })
    }

    // Resolve branch
    let targetBranchId = branchId
    if (!targetBranchId) {
      const defaultBranch = await prisma.branch.findFirst({ where: { isActive: true } })
      targetBranchId = defaultBranch?.id
    }
    if (!targetBranchId) {
      return res.status(400).json({ error: 'At least one active branch is required' })
    }

    // Resolve category
    let targetCategory = await prisma.expenseCategory.findFirst({
      where: { name: category || 'Miscellaneous' },
    })
    if (!targetCategory) {
      targetCategory = await prisma.expenseCategory.create({
        data: { name: category || 'Miscellaneous' },
      })
    }

    const expense = await prisma.expense.create({
      data: {
        branchId: targetBranchId,
        categoryId: targetCategory.id,
        amount: Number(amount),
        description,
        paymentMode: paymentMode || 'UPI',
        vendor: vendor || null,
        referenceNumber: referenceNumber || null,
      },
      include: {
        category: true,
        branch: true,
      },
    })

    res.status(201).json(expense)
  } catch (error) {
    res.status(500).json({ error: 'Failed to create expense', details: String(error) })
  }
})
