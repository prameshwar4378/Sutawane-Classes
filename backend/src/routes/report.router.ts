import { Router, Request, Response } from 'express'
import { prisma } from '../services/db'

export const reportRouter = Router()

/**
 * GET /api/reports/statement
 * Unified Financial Statement endpoint combining Collections, Expenses, and Net Movement.
 * Supports Daily (single date), Monthly (month/year), and Custom Date Range.
 */
reportRouter.get('/statement', async (req: Request, res: Response) => {
  try {
    const { branchId, sessionId, startDate, endDate } = req.query

    // Universal Branch filter
    const isAllBranches = !branchId || branchId === 'ALL'
    const branchFilter = isAllBranches ? {} : { branchId: String(branchId) }

    // Universal Session filter
    const isAllSessions = !sessionId || sessionId === 'ALL'
    const sessionFilter = isAllSessions ? {} : { sessionId: String(sessionId) }

    // Date range boundaries
    let start: Date
    let end: Date

    if (startDate) {
      const sStr = String(startDate).split('T')[0]
      const [sYear, sMonth, sDay] = sStr.split('-').map(Number)
      start = new Date(sYear, sMonth - 1, sDay, 0, 0, 0, 0)
    } else {
      const now = new Date()
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    }

    if (endDate) {
      const eStr = String(endDate).split('T')[0]
      const [eYear, eMonth, eDay] = eStr.split('-').map(Number)
      end = new Date(eYear, eMonth - 1, eDay, 23, 59, 59, 999)
    } else {
      end = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59, 999)
    }

    // 1. Fetch Collections (Fee Payments)
    const payments = await prisma.payment.findMany({
      where: {
        ...branchFilter,
        ...sessionFilter,
        isReversed: false,
        paymentDate: { gte: start, lte: end },
      },
      include: {
        student: true,
        branch: true,
        session: true,
        admission: true,
      },
      orderBy: { paymentDate: 'desc' },
    })

    // 2. Fetch Expenditures (Expenses)
    const expenses = await prisma.expense.findMany({
      where: {
        ...branchFilter,
        expenseDate: { gte: start, lte: end },
      },
      include: {
        category: true,
        branch: true,
      },
      orderBy: { expenseDate: 'desc' },
    })

    // 3. Aggregations & Reconciliation
    const totalCollections = payments.reduce((sum, p) => sum + p.totalAmount, 0)
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
    const netMovement = totalCollections - totalExpenses

    // Breakdown by payment mode for collections
    const collectionsByMode: Record<string, { amount: number; count: number }> = {}
    for (const p of payments) {
      const mode = p.paymentMode || 'OTHER'
      if (!collectionsByMode[mode]) {
        collectionsByMode[mode] = { amount: 0, count: 0 }
      }
      collectionsByMode[mode].amount += p.totalAmount
      collectionsByMode[mode].count += 1
    }

    // Breakdown by payment mode for expenses
    const expensesByMode: Record<string, { amount: number; count: number }> = {}
    for (const e of expenses) {
      const mode = e.paymentMode || 'OTHER'
      if (!expensesByMode[mode]) {
        expensesByMode[mode] = { amount: 0, count: 0 }
      }
      expensesByMode[mode].amount += e.amount
      expensesByMode[mode].count += 1
    }

    // Breakdown by expense category
    const expensesByCategory: Record<string, { amount: number; count: number }> = {}
    for (const e of expenses) {
      const cat = e.category?.name || 'General Expense'
      if (!expensesByCategory[cat]) {
        expensesByCategory[cat] = { amount: 0, count: 0 }
      }
      expensesByCategory[cat].amount += e.amount
      expensesByCategory[cat].count += 1
    }

    res.json({
      success: true,
      period: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
      summary: {
        totalCollections,
        collectionsCount: payments.length,
        totalExpenses,
        expensesCount: expenses.length,
        netMovement,
        isProfit: netMovement >= 0,
        collectionsByMode,
        expensesByMode,
        expensesByCategory,
      },
      collections: payments.map((p) => ({
        id: p.id,
        receiptNumber: p.receiptNumber,
        paymentDate: p.paymentDate.toISOString(),
        totalAmount: p.totalAmount,
        paymentMode: p.paymentMode,
        referenceNumber: p.referenceNumber,
        notes: p.notes,
        studentName: p.student?.fullName || '—',
        studentCode: p.student?.studentCode || '—',
        parentPhone: p.student?.parentPhone || '—',
        rollNumber: p.admission?.rollNumber || '—',
        standard: p.admission?.standard || '—',
        branchId: p.branch?.id || p.branchId,
        branchName: p.branch?.name || '—',
        branchCode: p.branch?.code || '—',
        branchAddress: p.branch?.address,
        branchPhone: p.branch?.phone,
        branchLogoUrl: p.branch?.logoUrl,
        sessionName: p.session?.displayName || p.session?.name || '—',
      })),
      expenses: expenses.map((e) => ({
        id: e.id,
        referenceNumber: e.referenceNumber,
        expenseDate: e.expenseDate.toISOString(),
        amount: e.amount,
        paymentMode: e.paymentMode,
        description: e.description,
        vendor: e.vendor,
        paidTo: e.vendor || '—',
        categoryName: e.category?.name || 'General Expense',
        branchName: e.branch?.name || '—',
      })),
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate financial statement report', details: String(error) })
  }
})

/**
 * GET /api/reports/session-audit
 * Comprehensive academic session audit with branch and standard breakdown
 */
reportRouter.get('/session-audit', async (req: Request, res: Response) => {
  try {
    const { branchId, sessionId } = req.query

    // Resolve target session (default to current session if sessionId === 'ALL' or missing)
    let session: any = null
    if (sessionId && sessionId !== 'ALL') {
      session = await prisma.academicSession.findUnique({ where: { id: String(sessionId) } })
    }
    if (!session) {
      session = await prisma.academicSession.findFirst({ where: { isCurrent: true } })
    }
    if (!session) {
      session = await prisma.academicSession.findFirst({ orderBy: { startDate: 'desc' } })
    }

    if (!session) {
      return res.status(404).json({ error: 'No academic session found' })
    }

    const targetSessionId = session.id
    const isAllBranches = !branchId || branchId === 'ALL'
    const branchFilter = isAllBranches ? {} : { branchId: String(branchId) }

    // 1. Admissions in this session
    const admissions = await prisma.studentAdmission.findMany({
      where: {
        sessionId: targetSessionId,
        ...branchFilter,
      },
      include: {
        student: true,
        branch: true,
        feePlan: true,
        payments: {
          where: { isReversed: false },
        },
      },
    })

    const activeAdmissions = admissions.filter((a) => a.isActive)
    const archivedAdmissions = admissions.filter((a) => !a.isActive)

    // 2. Agreed fees for active admissions
    const totalFeesAgreed = activeAdmissions.reduce(
      (sum, a) => sum + (a.feePlan?.netPayable ?? a.feePlan?.totalFees ?? 0),
      0
    )

    // 3. Realized Payments strictly for this session and branch
    const payments = await prisma.payment.findMany({
      where: {
        sessionId: targetSessionId,
        ...branchFilter,
        isReversed: false,
      },
      include: {
        branch: true,
      },
    })

    const totalCollections = payments.reduce((sum, p) => sum + p.totalAmount, 0)
    const totalPendingDues = Math.max(0, totalFeesAgreed - totalCollections)
    const collectionEfficiency = totalFeesAgreed > 0 ? (totalCollections / totalFeesAgreed) * 100 : 0

    // 4. Session Expenses (within session date range)
    const sessionExpenses = await prisma.expense.findMany({
      where: {
        ...branchFilter,
        expenseDate: {
          gte: session.startDate,
          lte: session.endDate,
        },
      },
      include: {
        category: true,
        branch: true,
      },
    })

    const totalExpenses = sessionExpenses.reduce((sum, e) => sum + e.amount, 0)
    const netSurplus = totalCollections - totalExpenses

    // 5. Branch-wise Comparison breakdown
    const branches = await prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    })

    const branchBreakdown = branches.map((b) => {
      const bAdmissions = activeAdmissions.filter((a) => a.branchId === b.id)
      const bFees = bAdmissions.reduce((sum, a) => sum + (a.feePlan?.netPayable ?? a.feePlan?.totalFees ?? 0), 0)
      const bPayments = payments.filter((p) => p.branchId === b.id)
      const bCollections = bPayments.reduce((sum, p) => sum + p.totalAmount, 0)
      const bExpenses = sessionExpenses.filter((e) => e.branchId === b.id).reduce((sum, e) => sum + e.amount, 0)
      const bPending = Math.max(0, bFees - bCollections)
      const bSurplus = bCollections - bExpenses
      const bRate = bFees > 0 ? (bCollections / bFees) * 100 : 0

      return {
        branchId: b.id,
        branchName: b.name,
        branchCode: b.code,
        studentsCount: bAdmissions.length,
        totalFees: bFees,
        collections: bCollections,
        pendingDues: bPending,
        expenses: bExpenses,
        netSurplus: bSurplus,
        collectionRate: Math.round(bRate * 10) / 10,
      }
    })

    // 6. Standard / Class-wise breakdown
    const standardMap: Record<string, { studentCount: number; totalFees: number; collected: number }> = {}
    for (const a of activeAdmissions) {
      const std = a.standard || 'General'
      if (!standardMap[std]) {
        standardMap[std] = { studentCount: 0, totalFees: 0, collected: 0 }
      }
      standardMap[std].studentCount += 1
      standardMap[std].totalFees += a.feePlan?.netPayable ?? a.feePlan?.totalFees ?? 0
      const aPaid = (a.payments || []).reduce((sum, p) => sum + p.totalAmount, 0)
      standardMap[std].collected += aPaid
    }

    const standardBreakdown = Object.entries(standardMap)
      .map(([standard, stats]) => {
        const pending = Math.max(0, stats.totalFees - stats.collected)
        const rate = stats.totalFees > 0 ? (stats.collected / stats.totalFees) * 100 : 0
        return {
          standard,
          studentCount: stats.studentCount,
          totalFees: stats.totalFees,
          collected: stats.collected,
          pendingDues: pending,
          collectionRate: Math.round(rate * 10) / 10,
        }
      })
      .sort((a, b) => b.studentCount - a.studentCount)

    // 7. Month-by-month trend for session
    const monthTrendMap: Record<string, { monthKey: string; monthLabel: string; collections: number; expenses: number }> = {}
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    const curMonth = new Date(session.startDate)
    while (curMonth <= session.endDate) {
      const y = curMonth.getFullYear()
      const m = curMonth.getMonth()
      const key = `${y}-${String(m + 1).padStart(2, '0')}`
      const label = `${monthNames[m]} ${y}`
      monthTrendMap[key] = { monthKey: key, monthLabel: label, collections: 0, expenses: 0 }
      curMonth.setMonth(curMonth.getMonth() + 1)
    }

    for (const p of payments) {
      const d = new Date(p.paymentDate)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (monthTrendMap[key]) {
        monthTrendMap[key].collections += p.totalAmount
      }
    }

    for (const e of sessionExpenses) {
      const d = new Date(e.expenseDate)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (monthTrendMap[key]) {
        monthTrendMap[key].expenses += e.amount
      }
    }

    const monthlyTrend = Object.values(monthTrendMap)

    res.json({
      success: true,
      session: {
        id: session.id,
        name: session.name,
        displayName: session.displayName,
        startDate: session.startDate.toISOString(),
        endDate: session.endDate.toISOString(),
        isCurrent: session.isCurrent,
      },
      summary: {
        activeAdmissions: activeAdmissions.length,
        archivedAdmissions: archivedAdmissions.length,
        totalFeesAgreed,
        totalCollections,
        totalPendingDues,
        collectionEfficiency: Math.round(collectionEfficiency * 10) / 10,
        totalExpenses,
        netSurplus,
        isSurplus: netSurplus >= 0,
      },
      branchBreakdown,
      standardBreakdown,
      monthlyTrend,
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate session audit report', details: String(error) })
  }
})

/**
 * GET /api/reports/payment-modes-summary
 * Payment mode analysis (Cash vs UPI vs Bank vs Cheque)
 */
reportRouter.get('/payment-modes-summary', async (req: Request, res: Response) => {
  try {
    const { branchId, sessionId, startDate, endDate } = req.query

    const isAllBranches = !branchId || branchId === 'ALL'
    const branchFilter = isAllBranches ? {} : { branchId: String(branchId) }

    const isAllSessions = !sessionId || sessionId === 'ALL'
    const sessionFilter = isAllSessions ? {} : { sessionId: String(sessionId) }

    const dateFilter: any = {}
    if (startDate || endDate) {
      dateFilter.paymentDate = {}
      if (startDate) {
        const [y, m, d] = String(startDate).split('T')[0].split('-').map(Number)
        dateFilter.paymentDate.gte = new Date(y, m - 1, d, 0, 0, 0, 0)
      }
      if (endDate) {
        const [y, m, d] = String(endDate).split('T')[0].split('-').map(Number)
        dateFilter.paymentDate.lte = new Date(y, m - 1, d, 23, 59, 59, 999)
      }
    }

    const payments = await prisma.payment.findMany({
      where: {
        ...branchFilter,
        ...sessionFilter,
        ...dateFilter,
        isReversed: false,
      },
      select: {
        id: true,
        totalAmount: true,
        paymentMode: true,
        paymentDate: true,
      },
    })

    const totalCollected = payments.reduce((sum, p) => sum + p.totalAmount, 0)
    const totalTransactions = payments.length

    const modeMap: Record<string, { amount: number; count: number }> = {
      CASH: { amount: 0, count: 0 },
      UPI: { amount: 0, count: 0 },
      BANK_TRANSFER: { amount: 0, count: 0 },
      CHEQUE: { amount: 0, count: 0 },
      OTHER: { amount: 0, count: 0 },
    }

    for (const p of payments) {
      const mode = (p.paymentMode || 'OTHER').toUpperCase()
      if (!modeMap[mode]) {
        modeMap[mode] = { amount: 0, count: 0 }
      }
      modeMap[mode].amount += p.totalAmount
      modeMap[mode].count += 1
    }

    const modes = Object.entries(modeMap)
      .map(([mode, data]) => {
        const percentage = totalCollected > 0 ? (data.amount / totalCollected) * 100 : 0
        return {
          mode,
          label: mode.replace('_', ' '),
          amount: data.amount,
          count: data.count,
          percentage: Math.round(percentage * 10) / 10,
        }
      })
      .sort((a, b) => b.amount - a.amount)

    res.json({
      success: true,
      totalCollected,
      totalTransactions,
      modes,
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate payment modes report', details: String(error) })
  }
})

/**
 * GET /api/reports/expense-categories-summary
 * Operational expense category distribution
 */
reportRouter.get('/expense-categories-summary', async (req: Request, res: Response) => {
  try {
    const { branchId, startDate, endDate } = req.query

    const isAllBranches = !branchId || branchId === 'ALL'
    const branchFilter = isAllBranches ? {} : { branchId: String(branchId) }

    const dateFilter: any = {}
    if (startDate || endDate) {
      dateFilter.expenseDate = {}
      if (startDate) {
        const [y, m, d] = String(startDate).split('T')[0].split('-').map(Number)
        dateFilter.expenseDate.gte = new Date(y, m - 1, d, 0, 0, 0, 0)
      }
      if (endDate) {
        const [y, m, d] = String(endDate).split('T')[0].split('-').map(Number)
        dateFilter.expenseDate.lte = new Date(y, m - 1, d, 23, 59, 59, 999)
      }
    }

    const expenses = await prisma.expense.findMany({
      where: {
        ...branchFilter,
        ...dateFilter,
      },
      include: {
        category: true,
      },
    })

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
    const totalVouchers = expenses.length

    const catMap: Record<string, { categoryId: string; categoryName: string; amount: number; count: number }> = {}

    for (const e of expenses) {
      const catId = e.categoryId || 'uncategorized'
      const catName = e.category?.name || 'General Operations'
      if (!catMap[catId]) {
        catMap[catId] = { categoryId: catId, categoryName: catName, amount: 0, count: 0 }
      }
      catMap[catId].amount += e.amount
      catMap[catId].count += 1
    }

    const categories = Object.values(catMap)
      .map((c) => {
        const percentage = totalExpenses > 0 ? (c.amount / totalExpenses) * 100 : 0
        return {
          ...c,
          percentage: Math.round(percentage * 10) / 10,
        }
      })
      .sort((a, b) => b.amount - a.amount)

    res.json({
      success: true,
      totalExpenses,
      totalVouchers,
      categories,
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate expense categories report', details: String(error) })
  }
})

