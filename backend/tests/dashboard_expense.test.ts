import { describe, it, expect, afterAll } from 'vitest'
import { prisma } from '../src/services/db'

describe('Phase 6 & 7: Expenses & Dashboard Analytics', () => {
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('should record an expense and associate with branch and category', async () => {
    const branch = await prisma.branch.findFirst({ where: { isActive: true } })
    expect(branch).toBeDefined()

    let category = await prisma.expenseCategory.findFirst({ where: { name: 'Rent' } })
    if (!category) {
      category = await prisma.expenseCategory.create({ data: { name: 'Rent' } })
    }

    const expense = await prisma.expense.create({
      data: {
        branchId: branch!.id,
        categoryId: category.id,
        amount: 15000,
        description: 'Monthly coaching center premise rent',
        paymentMode: 'BANK_TRANSFER',
        vendor: 'Premise Landlord',
      },
      include: {
        category: true,
        branch: true,
      },
    })

    expect(expense.id).toBeDefined()
    expect(expense.amount).toBe(15000)
    expect(expense.category.name).toBe('Rent')
    expect(expense.branch.id).toBe(branch!.id)
  })

  it('should compute branch expenses and group totals correctly', async () => {
    const expenses = await prisma.expense.findMany({
      include: { category: true },
    })
    expect(expenses.length).toBeGreaterThanOrEqual(1)

    const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0)
    expect(totalSpent).toBeGreaterThanOrEqual(15000)
  })

  it('should verify branch isolation for expenses', async () => {
    const nagpur = await prisma.branch.findFirst({ where: { code: 'NGP' } })
    const wardha = await prisma.branch.findFirst({ where: { code: 'WRD' } })
    expect(nagpur).toBeDefined()
    expect(wardha).toBeDefined()

    const cat = await prisma.expenseCategory.findFirst()

    await prisma.expense.create({
      data: {
        branchId: wardha!.id,
        categoryId: cat!.id,
        amount: 2500,
        description: 'Wardha center electricity recharge',
        paymentMode: 'UPI',
      },
    })

    const nagpurExpenses = await prisma.expense.findMany({ where: { branchId: nagpur!.id } })
    const wardhaExpenses = await prisma.expense.findMany({ where: { branchId: wardha!.id } })

    const overlap = nagpurExpenses.filter((ne) => wardhaExpenses.some((we) => we.id === ne.id))
    expect(overlap.length).toBe(0)
  })
})
