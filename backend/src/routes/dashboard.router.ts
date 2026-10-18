import { Router, Request, Response } from 'express'
import { prisma } from '../services/db'

export const dashboardRouter = Router()

dashboardRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { branchId, sessionId, standard } = req.query

    // Resolve session filter
    const isAllSessions = sessionId === 'ALL'
    let targetSessionId: string | null = null
    if (!isAllSessions) {
      if (sessionId) {
        targetSessionId = String(sessionId)
      } else {
        const current = await prisma.academicSession.findFirst({ where: { isCurrent: true } })
        targetSessionId = current?.id || null
      }
    }

    // Branch filter condition
    const isAllBranches = !branchId || branchId === 'ALL'
    const branchFilter = isAllBranches ? {} : { branchId: String(branchId) }

    // Session filter for payments/admissions
    const sessionFilter = targetSessionId ? { sessionId: targetSessionId } : {}

    // Standard filter
    const isAllStandards = !standard || standard === 'ALL'
    const standardAdmissionFilter = isAllStandards ? {} : { standard: String(standard) }
    const standardPaymentFilter = isAllStandards ? {} : { admission: { standard: String(standard) } }

    // Combined payment filter
    const paymentBaseFilter = {
      ...branchFilter,
      ...sessionFilter,
      ...standardPaymentFilter,
      isReversed: false,
    }

    // Date boundaries
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    // 1. Today's Collections & Expenses
    const todayPayments = await prisma.payment.findMany({
      where: {
        ...paymentBaseFilter,
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
        ...paymentBaseFilter,
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
    const admissionWhere: any = {
      isActive: true,
      ...branchFilter,
      ...sessionFilter,
      ...standardAdmissionFilter,
    }

    const admissions = await prisma.studentAdmission.findMany({
      where: admissionWhere,
      include: {
        feePlan: true,
        payments: {
          where: { isReversed: false },
        },
      },
    })

    let totalExpectedFees = 0
    let totalCollectedFees = 0

    for (const adm of admissions) {
      const planFees = adm.feePlan?.netPayable ?? adm.feePlan?.totalFees ?? 0
      totalExpectedFees += planFees
      const paid = (adm.payments || []).reduce((acc, p) => acc + p.totalAmount, 0)
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
          ...paymentBaseFilter,
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

    // Fetch active session object if targetSessionId exists for date boundaries
    const targetSession = targetSessionId
      ? await prisma.academicSession.findUnique({ where: { id: targetSessionId } })
      : null

    for (const b of branches) {
      const bAdmissions = await prisma.studentAdmission.findMany({
        where: {
          branchId: b.id,
          ...sessionFilter,
          ...standardAdmissionFilter,
          isActive: true,
        },
        include: {
          feePlan: true,
          payments: { where: { isReversed: false } },
        },
      })

      let bExpected = 0
      let bActiveCollected = 0
      for (const adm of bAdmissions) {
        bExpected += adm.feePlan?.netPayable ?? adm.feePlan?.totalFees ?? 0
        bActiveCollected += (adm.payments || []).reduce((s, p) => s + p.totalAmount, 0)
      }

      // Query confirmed payments directly for this branch and session (including any payments from students enrolled in this session)
      const bPayments = await prisma.payment.findMany({
        where: {
          branchId: b.id,
          ...sessionFilter,
          ...standardPaymentFilter,
          isReversed: false,
        },
      })
      const bTotalCollections = bPayments.reduce((s, p) => s + p.totalAmount, 0)

      // Query branch expenses scoped to the active session's date range (or all if consolidated)
      const expenseDateFilter = targetSession
        ? { expenseDate: { gte: targetSession.startDate, lte: targetSession.endDate } }
        : {}

      const bExpenses = await prisma.expense.findMany({
        where: {
          branchId: b.id,
          ...expenseDateFilter,
        },
      })
      const bExpTotal = bExpenses.reduce((s, e) => s + e.amount, 0)

      branchComparison.push({
        branchId: b.id,
        branchName: b.name,
        branchCode: b.code,
        activeStudents: bAdmissions.length,
        totalCollections: bTotalCollections,
        totalExpenses: bExpTotal,
        netMovement: bTotalCollections - bExpTotal,
        pendingDues: Math.max(0, bExpected - bActiveCollected),
      })
    }

    // 7. Recent Transactions (Fees + Expenses merged, strictly ordered by actual action timestamp descending)
    const recentFees = await prisma.payment.findMany({
      where: {
        ...branchFilter,
        ...sessionFilter,
        ...standardPaymentFilter,
      },
      include: { student: true, branch: true },
      orderBy: [
        { createdAt: 'desc' },
        { paymentDate: 'desc' },
      ],
      take: 20,
    })

    const recentExpenses = await prisma.expense.findMany({
      where: branchFilter,
      include: { category: true, branch: true },
      orderBy: [
        { createdAt: 'desc' },
        { expenseDate: 'desc' },
      ],
      take: 20,
    })

    const recentTransactions = [
      ...recentFees.map((f) => {
        const isRev = f.isReversed
        const actionTime = isRev && f.reversedAt ? f.reversedAt : f.createdAt
        return {
          id: f.id,
          type: isRev ? ('FEE_REVERSAL' as const) : ('FEE_COLLECTION' as const),
          title: isRev
            ? `Fee Reversed: ${f.student?.fullName || 'Student'}`
            : `Fee: ${f.student?.fullName || 'Student'}`,
          subtitle: isRev
            ? `Receipt: ${f.receiptNumber} (${f.paymentMode}) • ${f.reversalReason || 'Cancelled'}`
            : `Receipt: ${f.receiptNumber} (${f.paymentMode})`,
          amount: f.totalAmount,
          date: f.paymentDate.toISOString(),
          createdAt: f.createdAt ? f.createdAt.toISOString() : f.paymentDate.toISOString(),
          actionTime: actionTime ? actionTime.toISOString() : f.paymentDate.toISOString(),
          branchName: f.branch?.name || 'Main Branch',
          paymentMode: f.paymentMode,
          studentId: f.studentId,
          isIncome: !isRev,
          isReversed: f.isReversed,
          reversalReason: f.reversalReason,
        }
      }),
      ...recentExpenses.map((e) => ({
        id: e.id,
        type: 'EXPENSE' as const,
        title: `Expense: ${e.description}`,
        subtitle: `Category: ${e.category?.name || 'Expense'} (${e.paymentMode}${e.vendor ? ` • ${e.vendor}` : ''})`,
        amount: e.amount,
        date: e.expenseDate.toISOString(),
        createdAt: e.createdAt ? e.createdAt.toISOString() : e.expenseDate.toISOString(),
        actionTime: e.createdAt ? e.createdAt.toISOString() : e.expenseDate.toISOString(),
        branchName: e.branch?.name || 'Main Branch',
        paymentMode: e.paymentMode,
        isIncome: false,
        isReversed: false,
        reversalReason: null,
      })),
    ]
      .sort((a, b) => {
        const timeA = new Date(a.actionTime || a.createdAt || a.date).getTime()
        const timeB = new Date(b.actionTime || b.createdAt || b.date).getTime()
        if (timeB !== timeA) return timeB - timeA
        return b.id.localeCompare(a.id)
      })
      .slice(0, 10)

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
