import { Router, Request, Response } from 'express'
import { prisma } from '../services/db'

export const studentRouter = Router()

// GET all students with branch and session filters
studentRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { branchId, sessionId } = req.query

    // Build admission filter
    const admissionWhere: any = { isActive: true }
    if (branchId && branchId !== 'ALL') {
      admissionWhere.branchId = String(branchId)
    }
    if (sessionId) {
      admissionWhere.sessionId = String(sessionId)
    }

    const admissions = await prisma.studentAdmission.findMany({
      where: admissionWhere,
      include: {
        student: {
          include: {
            payments: {
              where: { isReversed: false },
            },
          },
        },
        branch: true,
        session: true,
        feePlan: {
          include: {
            installments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const summary = admissions.map((adm) => {
      const student = adm.student
      const feePlan = adm.feePlan
      const totalFees = feePlan?.netPayable || feePlan?.totalFees || 0

      const paidFees = student.payments.reduce((acc, p) => acc + p.totalAmount, 0)
      const pendingFees = Math.max(0, totalFees - paidFees)

      return {
        id: student.id,
        admissionId: adm.id,
        studentCode: student.studentCode,
        fullName: student.fullName,
        rollNumber: adm.rollNumber,
        standard: adm.standard,
        branchId: adm.branchId,
        branchName: adm.branch.name,
        sessionId: adm.sessionId,
        sessionName: adm.session.name,
        parentPhone: student.parentPhone,
        studentPhone: student.studentPhone,
        address: student.address,
        totalFees,
        paidFees,
        pendingFees,
        createdAt: adm.createdAt.toISOString(),
      }
    })

    res.json(summary)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch students', details: String(error) })
  }
})

// POST create student admission + fee plan + installments
studentRouter.post('/', async (req: Request, res: Response) => {
  try {
    const {
      fullName,
      rollNumber,
      standard,
      parentPhone,
      studentPhone,
      address,
      totalFees,
      branchId,
      sessionId,
    } = req.body

    if (!fullName || !rollNumber || !parentPhone) {
      return res.status(400).json({ error: 'Full name, roll number, and parent phone are required' })
    }

    // Resolve branch
    let targetBranchId = branchId
    if (!targetBranchId) {
      const defaultBranch = await prisma.branch.findFirst({ where: { isActive: true } })
      targetBranchId = defaultBranch?.id
    }
    if (!targetBranchId) {
      return res.status(400).json({ error: 'No active branch available' })
    }

    // Resolve session
    let targetSessionId = sessionId
    if (!targetSessionId) {
      const currentSession = await prisma.academicSession.findFirst({ where: { isCurrent: true } })
      targetSessionId = currentSession?.id
    }
    if (!targetSessionId) {
      const fallbackSession = await prisma.academicSession.findFirst()
      targetSessionId = fallbackSession?.id
    }
    if (!targetSessionId) {
      return res.status(400).json({ error: 'No academic session available' })
    }

    // Check roll number uniqueness within this branch + session
    const existingAdmission = await prisma.studentAdmission.findFirst({
      where: {
        branchId: targetBranchId,
        sessionId: targetSessionId,
        rollNumber,
      },
    })
    if (existingAdmission) {
      return res.status(409).json({ error: `Roll number ${rollNumber} already exists in this branch and session` })
    }

    const feesNumber = Number(totalFees) || 0
    const studentCode = `SC-${Date.now().toString().slice(-4)}-${Math.floor(100 + Math.random() * 900)}`

    // Transaction to create student, admission, fee plan, and 3 standard installments
    const result = await prisma.$transaction(async (tx) => {
      const student = await tx.student.create({
        data: {
          studentCode,
          fullName,
          parentPhone,
          studentPhone: studentPhone || null,
          address: address || null,
        },
      })

      const admission = await tx.studentAdmission.create({
        data: {
          studentId: student.id,
          branchId: targetBranchId,
          sessionId: targetSessionId,
          rollNumber,
          standard: standard || 'Class 10',
        },
      })

      const feePlan = await tx.feePlan.create({
        data: {
          admissionId: admission.id,
          sessionId: targetSessionId,
          totalFees: feesNumber,
          totalDiscount: 0,
          netPayable: feesNumber,
        },
      })

      // Create 3 installments: 40% due at admission, 30% after 45 days, 30% after 90 days
      const inst1Amount = Math.round(feesNumber * 0.4)
      const inst2Amount = Math.round(feesNumber * 0.3)
      const inst3Amount = feesNumber - (inst1Amount + inst2Amount)

      const now = new Date()
      await tx.installment.createMany({
        data: [
          {
            feePlanId: feePlan.id,
            installmentNo: 1,
            label: 'Installment 1 (Admission)',
            dueDate: now,
            amountDue: inst1Amount,
          },
          {
            feePlanId: feePlan.id,
            installmentNo: 2,
            label: 'Installment 2',
            dueDate: new Date(now.getTime() + 45 * 24 * 3600 * 1000),
            amountDue: inst2Amount,
          },
          {
            feePlanId: feePlan.id,
            installmentNo: 3,
            label: 'Installment 3 (Final)',
            dueDate: new Date(now.getTime() + 90 * 24 * 3600 * 1000),
            amountDue: inst3Amount,
          },
        ],
      })

      return { student, admission, feePlan }
    })

    res.status(201).json(result)
  } catch (error) {
    res.status(500).json({ error: 'Failed to admit student', details: String(error) })
  }
})

// POST record fee payment with FIFO installment allocation
studentRouter.post('/payments', async (req: Request, res: Response) => {
  try {
    const { studentId, amount, paymentMode, receiptNumber, referenceNumber, notes } = req.body

    const numAmount = Number(amount)
    if (!studentId || !numAmount || numAmount <= 0) {
      return res.status(400).json({ error: 'Valid studentId and positive amount are required' })
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        admissions: {
          where: { isActive: true },
          include: {
            feePlan: {
              include: {
                installments: {
                  include: { allocations: true },
                  orderBy: { installmentNo: 'asc' },
                },
              },
            },
            branch: true,
          },
        },
      },
    })

    if (!student || student.admissions.length === 0) {
      return res.status(404).json({ error: 'Student or active admission not found' })
    }

    const admission = student.admissions[0]
    const branchId = admission.branchId
    const feePlan = admission.feePlan

    // Check receipt uniqueness
    const generatedReceipt = receiptNumber || `REC-${Date.now().toString().slice(-6)}`
    const existingPayment = await prisma.payment.findUnique({
      where: { receiptNumber: generatedReceipt },
    })
    if (existingPayment) {
      return res.status(409).json({ error: `Receipt number ${generatedReceipt} already exists` })
    }

    // Process payment and allocation in transaction
    const payment = await prisma.$transaction(async (tx) => {
      const newPayment = await tx.payment.create({
        data: {
          studentId,
          branchId,
          receiptNumber: generatedReceipt,
          totalAmount: numAmount,
          paymentMode: paymentMode || 'UPI',
          referenceNumber: referenceNumber || null,
          notes: notes || null,
        },
      })

      // Allocate to unpaid installments FIFO
      if (feePlan && feePlan.installments.length > 0) {
        let remainingToAllocate = numAmount

        for (const inst of feePlan.installments) {
          if (remainingToAllocate <= 0) break

          const alreadyPaid = inst.allocations.reduce((sum, a) => sum + a.allocatedAmount, 0)
          const needed = Math.max(0, inst.amountDue - alreadyPaid)

          if (needed > 0) {
            const allocateNow = Math.min(remainingToAllocate, needed)
            await tx.paymentAllocation.create({
              data: {
                paymentId: newPayment.id,
                installmentId: inst.id,
                allocatedAmount: allocateNow,
              },
            })
            remainingToAllocate -= allocateNow
          }
        }
      }

      return newPayment
    })

    res.status(201).json(payment)
  } catch (error) {
    res.status(500).json({ error: 'Failed to record payment', details: String(error) })
  }
})

// GET financial statistics (backend calculation)
studentRouter.get('/stats/financial', async (req: Request, res: Response) => {
  try {
    const { branchId, sessionId } = req.query

    const admissionWhere: any = { isActive: true }
    if (branchId && branchId !== 'ALL') {
      admissionWhere.branchId = String(branchId)
    }
    if (sessionId) {
      admissionWhere.sessionId = String(sessionId)
    }

    const admissions = await prisma.studentAdmission.findMany({
      where: admissionWhere,
      include: {
        student: {
          include: {
            payments: {
              where: { isReversed: false },
            },
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

    res.json({
      totalExpectedFees,
      totalCollectedFees,
      totalPendingFees,
      activeStudentsCount: admissions.length,
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to calculate financial statistics', details: String(error) })
  }
})
