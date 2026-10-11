import { Router, Request, Response } from 'express'
import { prisma } from '../services/db'

export const dashboardRouter = Router()

dashboardRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { branchId, sessionId } = req.query

    // Resolve session
    let targetSessionId = sessionId ? String(sessionId) : null
    if (!targetSessionId) {
      const current = await prisma.academicSession.findFirst({ where: { isCurrent: true } })
      targetSessionId = current?.id || null
    }

    // Branch filter condition
    const isAllBranches = !branchId || branchId === 'ALL'
    const branchFilter = isAllBranches ? {} : { branchId: String(branchId) }

    // Date boundaries
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    // 1. Today's Collections & Expenses
    const todayPayments = await prisma.payment.findMany({
      where: {
        ...branchFilter,
        isReversed: false,
        paymentDate: { gte: startOfToday, lte: endOfToday },
      },
    })
    const todayCollections = todayPayments.reduce((sum, p) => sum + p.totalAmount, 0)

    const todayExpensesList = await prisma.expense.findMany({
      where: {
        ...branchFilter,
        expenseDate: { gte: startOfToday, lte: endOfToday },
      },
    })
    const todayExpenses = todayExpensesList.reduce((sum, e) => sum + e.amount, 0)
    const todayNetMovement = todayCollections - todayExpenses

    // 2. Month's Collections & Expenses
    const monthPayments = await prisma.payment.findMany({
      where: {
        ...branchFilter,
        isReversed: false,
        paymentDate: { gte: startOfMonth, lte: endOfMonth },
      },
    })
    const monthCollections = monthPayments.reduce((sum, p) => sum + p.totalAmount, 0)

    const monthExpensesList = await prisma.expense.findMany({
      where: {
        ...branchFilter,
        expenseDate: { gte: startOfMonth, lte: endOfMonth },
      },
    })
    const monthExpenses = monthExpensesList.reduce((sum, e) => sum + e.amount, 0)
    const monthNetMovement = monthCollections - monthExpenses

    // 3. Session Active Admissions & Total Expected Fees
    const admissionWhere: any = { isActive: true }
    if (!isAllBranches) admissionWhere.branchId = String(branchId)
    if (targetSessionId) admissionWhere.sessionId = targetSessionId

    const admissions = await prisma.studentAdmission.findMany({
      where: admissionWhere,
      include: {
        student: {
          include: {
            payments: { where: { isReversed: false } },
          },
        },
        feePlan: true,
      },
    })

    let totalExpectedFees = 0
    let totalCollectedFees = 0

    for (const adm of admissions) {
      const planFees = adm.feePlan?.netPayable || adm.feePlan?.totalFees || 0
      totalExpectedFees += planFees
      const paid = adm.student.payments.reduce((acc, p) => acc + p.totalAmount, 0)
      totalCollectedFees += paid
    }
    const totalPendingFees = Math.max(0, totalExpectedFees - totalCollectedFees)

    // 4. Installments Due & Overdue counts
    const installments = await prisma.installment.findMany({
      where: {
        feePlan: {
          admission: admissionWhere,
        },
      },
      include: {
        allocations: {
          include: { payment: true },
        },
      },
    })

    let dueTodayCount = 0
    let dueTodayAmount = 0
    let overdueCount = 0
    let overdueAmount = 0

    for (const inst of installments) {
      const paid = inst.allocations.reduce((sum, a) => (a.payment.isReversed ? sum : sum + a.allocatedAmount), 0)
      const bal = Math.max(0, inst.amountDue - paid)

      if (bal > 0) {
        const instDue = new Date(inst.dueDate)
        instDue.setHours(0, 0, 0, 0)

        const compToday = new Date()
        compToday.setHours(0, 0, 0, 0)

        if (instDue.getTime() === compToday.getTime()) {
          dueTodayCount += 1
          dueTodayAmount += bal
        } else if (instDue.getTime() < compToday.getTime()) {
          overdueCount += 1
          overdueAmount += bal
        }
      }
    }

    // 5. Monthly Trend (Past 6 Months for Recharts)
    const monthlyTrend = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const mStart = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
      const monthLabel = d.toLocaleString('en-IN', { month: 'short', year: '2-digit' })

      const mPay = await prisma.payment.findMany({
        where: {
          ...branchFilter,
          isReversed: false,
          paymentDate: { gte: mStart, lte: mEnd },
        },
      })
      const mColl = mPay.reduce((sum, p) => sum + p.totalAmount, 0)

      const mExp = await prisma.expense.findMany({
        where: {
          ...branchFilter,
          expenseDate: { gte: mStart, lte: mEnd },
        },
      })
      const mExpenseAmt = mExp.reduce((sum, e) => sum + e.amount, 0)

      monthlyTrend.push({
        month: monthLabel,
        collections: mColl,
        expenses: mExpenseAmt,
        net: mColl - mExpenseAmt,
      })
    }

    // 6. Branch Comparison (when All Branches selected)
    const branches = await prisma.branch.findMany({ where: { isActive: true } })
    const branchComparison = []

    for (const b of branches) {
      const bAdmissions = await prisma.studentAdmission.findMany({
        where: { branchId: b.id, sessionId: targetSessionId || undefined, isActive: true },
        include: {
          feePlan: true,
          student: { include: { payments: { where: { isReversed: false } } } },
        },
      })

      let bExpected = 0
      let bCollected = 0
      for (const adm of bAdmissions) {
        bExpected += adm.feePlan?.netPayable || adm.feePlan?.totalFees || 0
        bCollected += adm.student.payments.reduce((s, p) => s + p.totalAmount, 0)
      }

      const bExpenses = await prisma.expense.findMany({ where: { branchId: b.id } })
      const bExpTotal = bExpenses.reduce((s, e) => s + e.amount, 0)

      branchComparison.push({
        branchId: b.id,
        branchName: b.name,
        branchCode: b.code,
        activeStudents: bAdmissions.length,
        totalCollections: bCollected,
        totalExpenses: bExpTotal,
        pendingDues: Math.max(0, bExpected - bCollected),
      })
    }

    // 7. Recent Transactions (Fees + Expenses merged)
    const recentFees = await prisma.payment.findMany({
      where: { ...branchFilter, isReversed: false },
      include: { student: true, branch: true },
      orderBy: { paymentDate: 'desc' },
      take: 6,
    })

    const recentExpenses = await prisma.expense.findMany({
      where: branchFilter,
      include: { category: true, branch: true },
      orderBy: { expenseDate: 'desc' },
      take: 6,
    })

    const recentTransactions = [
      ...recentFees.map((f) => ({
        id: f.id,
        type: 'FEE_COLLECTION' as const,
        title: `Fee: ${f.student.fullName}`,
        subtitle: `Receipt: ${f.receiptNumber} (${f.paymentMode})`,
        amount: f.totalAmount,
        date: f.paymentDate.toISOString(),
        branchName: f.branch.name,
        isIncome: true,
      })),
      ...recentExpenses.map((e) => ({
        id: e.id,
        type: 'EXPENSE' as const,
        title: `Expense: ${e.description}`,
        subtitle: `Category: ${e.category.name} (${e.paymentMode})`,
        amount: e.amount,
        date: e.expenseDate.toISOString(),
        branchName: e.branch.name,
        isIncome: false,
      })),
    ]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8)

    res.json({
      today: {
        collections: todayCollections,
        expenses: todayExpenses,
        netMovement: todayNetMovement,
        transactionCount: todayPayments.length + todayExpensesList.length,
      },
      month: {
        collections: monthCollections,
        expenses: monthExpenses,
        netMovement: monthNetMovement,
      },
      session: {
        activeStudentsCount: admissions.length,
        totalExpectedFees,
        totalCollectedFees,
        totalPendingFees,
      },
      dues: {
        dueTodayCount,
        dueTodayAmount,
        overdueCount,
        overdueAmount,
      },
      monthlyTrend,
      branchComparison,
      recentTransactions,
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to aggregate dashboard analytics', details: String(error) })
  }
})
