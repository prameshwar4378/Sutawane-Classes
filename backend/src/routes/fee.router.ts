import { Router, Request, Response } from 'express'
import { prisma } from '../services/db'
import { calculateInstallmentStatus } from './student.router'

export const feeRouter = Router()

// Helper to generate sequential receipt number
export async function generateSequentialReceiptNumber(
  branchId: string,
  sessionId: string,
  tx: any = prisma
): Promise<string> {
  const branch = await tx.branch.findUnique({ where: { id: branchId } })
  const session = await tx.academicSession.findUnique({ where: { id: sessionId } })

  const branchCode = branch?.code || 'MAIN'
  const sessionName = session?.name || '2026-27'
  const prefix = `SC/${sessionName}/${branchCode}/REC-`

  const counter = await tx.receiptCounter.upsert({
    where: {
      branchId_sessionId: {
        branchId,
        sessionId,
      },
    },
    update: {
      lastNumber: { increment: 1 },
    },
    create: {
      branchId,
      sessionId,
      prefix,
      lastNumber: 1,
    },
  })

  const seq = String(counter.lastNumber).padStart(5, '0')
  return `${prefix}${seq}`
}

// GET fee plan with installments, payments, and discounts for an admission
feeRouter.get('/plans/:admissionId', async (req: Request, res: Response) => {
  try {
    const admissionId = String(req.params.admissionId)

    const feePlan = await prisma.feePlan.findUnique({
      where: { admissionId },
      include: {
        admission: {
          include: {
            student: {
              include: {
                previousSessionDues: true,
              },
            },
            branch: true,
            session: true,
            payments: {
              where: { isReversed: false },
              orderBy: { paymentDate: 'desc' },
            },
          },
        },
        discounts: {
          orderBy: { createdAt: 'desc' },
        },
        installments: {
          include: {
            allocations: {
              include: { payment: true },
            },
          },
          orderBy: { installmentNo: 'asc' },
        },
      },
    })

    if (!feePlan) {
      return res.status(404).json({ error: 'Fee plan not found for this admission' })
    }

    const student = feePlan.admission.student
    const netPayable = feePlan.netPayable

    // Valid non-reversed payments strictly for this admission
    const sessionPayments = feePlan.admission.payments
    const totalPaid = sessionPayments.reduce((sum, p) => sum + p.totalAmount, 0)
    const totalPending = Math.max(0, netPayable - totalPaid)

    // Uncollected previous session dues for this student
    const previousDuesPending = (student.previousSessionDues || []).reduce(
      (sum, d) => sum + Math.max(0, d.outstandingAmount - d.collectedAmount),
      0
    )
    const overallPendingAmount = totalPending + previousDuesPending

    const installments = feePlan.installments.map((inst) => {
      const paid = inst.allocations.reduce((sum, a) => {
        return a.payment.isReversed ? sum : sum + a.allocatedAmount
      }, 0)
      const status = calculateInstallmentStatus(inst.amountDue, paid, inst.dueDate)

      return {
        id: inst.id,
        installmentNo: inst.installmentNo,
        label: inst.label,
        dueDate: inst.dueDate.toISOString(),
        amountDue: inst.amountDue,
        amountPaid: paid,
        balanceRemaining: Math.max(0, inst.amountDue - paid),
        status,
      }
    })

    res.json({
      id: feePlan.id,
      admissionId: feePlan.admissionId,
      sessionId: feePlan.sessionId,
      totalFees: feePlan.totalFees,
      totalDiscount: feePlan.totalDiscount,
      netPayable: feePlan.netPayable,
      totalPaid,
      totalPending,
      previousDuesPending,
      overallPendingAmount,
      student: {
        id: student.id,
        fullName: student.fullName,
        studentCode: student.studentCode,
        rollNumber: feePlan.admission.rollNumber,
        standard: feePlan.admission.standard,
        branch: feePlan.admission.branch,
        session: feePlan.admission.session,
      },
      discounts: feePlan.discounts,
      installments,
      payments: sessionPayments.map((p) => ({
        id: p.id,
        receiptNumber: p.receiptNumber,
        totalAmount: p.totalAmount,
        paymentDate: p.paymentDate.toISOString(),
        paymentMode: p.paymentMode,
        referenceNumber: p.referenceNumber,
        notes: p.notes,
        isReversed: p.isReversed,
      })),
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch fee plan', details: String(error) })
  }
})

// POST create or reset installment schedule (equal split or custom)
feeRouter.post('/plans/:admissionId/installments', async (req: Request, res: Response) => {
  try {
    const admissionId = String(req.params.admissionId)
    const { installments, splitCount, intervalDays } = req.body

    const feePlan = await prisma.feePlan.findUnique({
      where: { admissionId },
      include: { installments: { include: { allocations: true } } },
    })

    if (!feePlan) {
      return res.status(404).json({ error: 'Fee plan not found' })
    }

    // Check if payments are already allocated to installments
    const hasAllocations = feePlan.installments.some((inst) => inst.allocations.length > 0)
    if (hasAllocations) {
      return res.status(400).json({
        error: 'Cannot regenerate installments after payments have already been collected against them.',
      })
    }

    const netAmount = feePlan.netPayable
    const now = new Date()

    const result = await prisma.$transaction(async (tx) => {
      // Remove old unallocated installments
      await tx.installment.deleteMany({
        where: { feePlanId: feePlan.id },
      })

      // If custom array provided
      if (Array.isArray(installments) && installments.length > 0) {
        const sumDue = installments.reduce((acc, curr) => acc + Number(curr.amountDue || 0), 0)
        if (Math.abs(sumDue - netAmount) > 1) {
          throw new Error(`Sum of installments (₹${sumDue}) must equal net payable amount (₹${netAmount})`)
        }

        const created = await tx.installment.createMany({
          data: installments.map((inst, idx) => ({
            feePlanId: feePlan.id,
            installmentNo: idx + 1,
            label: inst.label || `Installment ${idx + 1}`,
            dueDate: new Date(inst.dueDate || now),
            amountDue: Number(inst.amountDue),
          })),
        })
        return created
      } else {
        // Equal split into count (e.g. 2, 3, 4, 6)
        const count = Math.max(1, Number(splitCount) || 3)
        const days = Number(intervalDays) || 30
        const baseAmount = Math.floor(netAmount / count)
        const remainder = netAmount - baseAmount * count

        const list = []
        for (let i = 0; i < count; i++) {
          const isLast = i === count - 1
          const dueAmt = isLast ? baseAmount + remainder : baseAmount
          const dueDate = new Date(now.getTime() + i * days * 24 * 3600 * 1000)
          list.push({
            feePlanId: feePlan.id,
            installmentNo: i + 1,
            label: i === 0 ? 'Installment 1 (Token/Admission)' : `Installment ${i + 1}`,
            dueDate,
            amountDue: dueAmt,
          })
        }

        const created = await tx.installment.createMany({ data: list })
        return created
      }
    })

    res.json({ success: true, message: 'Installments updated successfully', result })
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to update installments' })
  }
})

// POST add discount / concession to fee plan
feeRouter.post('/plans/:admissionId/discounts', async (req: Request, res: Response) => {
  try {
    const admissionId = String(req.params.admissionId)
    const { reason, amount, notes } = req.body

    const numAmount = Number(amount)
    if (!reason || !numAmount || numAmount <= 0) {
      return res.status(400).json({ error: 'Valid discount reason and positive amount are required' })
    }

    const feePlan = await prisma.feePlan.findUnique({
      where: { admissionId },
      include: {
        admission: {
          include: {
            payments: { where: { isReversed: false } },
          },
        },
      },
    })

    if (!feePlan) {
      return res.status(404).json({ error: 'Fee plan not found' })
    }

    const totalPaid = feePlan.admission.payments.reduce((s, p) => s + p.totalAmount, 0)
    const newTotalDiscount = feePlan.totalDiscount + numAmount
    const newNetPayable = Math.max(0, feePlan.totalFees - newTotalDiscount)

    if (newNetPayable < totalPaid) {
      return res.status(400).json({
        error: `Discount cannot reduce net payable (₹${newNetPayable}) below already paid amount (₹${totalPaid})`,
      })
    }

    const discount = await prisma.$transaction(async (tx) => {
      const created = await tx.feeDiscount.create({
        data: {
          feePlanId: feePlan.id,
          reason,
          amount: numAmount,
          notes: notes || null,
        },
      })

      await tx.feePlan.update({
        where: { id: feePlan.id },
        data: {
          totalDiscount: newTotalDiscount,
          netPayable: newNetPayable,
        },
      })

      return created
    })

    res.status(201).json(discount)
  } catch (error) {
    res.status(500).json({ error: 'Failed to record discount', details: String(error) })
  }
})

// POST record payment with flexible payment support, overpayment prevention & sequential receipt
feeRouter.post('/payments', async (req: Request, res: Response) => {
  try {
    const {
      studentId,
      admissionId,
      sessionId,
      previousDueId,
      amount,
      paymentMode,
      paymentDate,
      receiptNumber,
      referenceNumber,
      notes,
      allowDuplicate = false,
      allocations, // optional array: [{ installmentId, allocatedAmount }]
    } = req.body

    const numAmount = Number(amount)
    if (!studentId || !numAmount || numAmount <= 0) {
      return res.status(400).json({ error: 'Valid studentId and positive amount are required' })
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        admissions: {
          include: {
            feePlan: {
              include: {
                installments: {
                  include: {
                    allocations: {
                      include: { payment: true },
                    },
                  },
                  orderBy: { installmentNo: 'asc' },
                },
              },
            },
            branch: true,
            session: true,
            payments: {
              where: { isReversed: false },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        previousSessionDues: true,
      },
    })

    if (!student) {
      return res.status(404).json({ error: 'Student not found' })
    }

    // A. Handling payment towards carried-forward previous session due
    if (previousDueId) {
      const prevDue = await prisma.previousSessionDue.findUnique({
        where: { id: String(previousDueId) },
        include: { currentSession: true, originalSession: true },
      })

      if (!prevDue || prevDue.studentId !== studentId) {
        return res.status(404).json({ error: 'Previous session due record not found for this student' })
      }

      const dueRemaining = Math.max(0, prevDue.outstandingAmount - prevDue.collectedAmount)
      if (numAmount > dueRemaining) {
        return res.status(400).json({
          error: `Payment amount (₹${numAmount}) exceeds remaining previous session due balance (₹${dueRemaining}).`,
        })
      }

      const activeAdmission = student.admissions.find((a) => a.isActive) || student.admissions[0]
      const branchId = activeAdmission?.branchId || (await prisma.branch.findFirst({ where: { isActive: true } }))?.id
      const targetSessionId = prevDue.currentSessionId

      if (!branchId || !targetSessionId) {
        return res.status(400).json({ error: 'Valid branch and academic session required for receipt generation' })
      }

      const payment = await prisma.$transaction(async (tx) => {
        let finalReceipt = receiptNumber
        if (!finalReceipt || !finalReceipt.trim()) {
          finalReceipt = await generateSequentialReceiptNumber(branchId, targetSessionId, tx)
        }

        const newPayment = await tx.payment.create({
          data: {
            studentId,
            branchId,
            sessionId: targetSessionId,
            previousDueId: prevDue.id,
            receiptNumber: finalReceipt,
            totalAmount: numAmount,
            paymentMode: paymentMode || 'UPI',
            paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
            referenceNumber: referenceNumber || null,
            notes: notes || `Payment towards carried-forward dues from ${prevDue.originalSession?.name || 'previous session'}`,
          },
        })

        await tx.previousSessionDue.update({
          where: { id: prevDue.id },
          data: {
            collectedAmount: { increment: numAmount },
          },
        })

        return newPayment
      })

      return res.status(201).json({
        success: true,
        payment,
        studentName: student.fullName,
        studentCode: student.studentCode,
        parentPhone: student.parentPhone,
        studentPhone: student.studentPhone,
        remainingBalance: dueRemaining - numAmount,
        isPreviousDuePayment: true,
      })
    }

    // B. Handling regular session fee payment
    if (student.admissions.length === 0) {
      return res.status(404).json({ error: 'Student has no admission records' })
    }

    // Resolve specific admission
    let targetAdmission: any = null
    if (admissionId) {
      targetAdmission = student.admissions.find((a) => a.id === admissionId)
    } else if (sessionId && sessionId !== 'ALL') {
      targetAdmission = student.admissions.find((a) => a.sessionId === sessionId && a.isActive)
        || student.admissions.find((a) => a.sessionId === sessionId)
    }

    if (!targetAdmission) {
      // Default to currently active admission or newest admission
      targetAdmission = student.admissions.find((a) => a.isActive) || student.admissions[0]
    }

    if (!targetAdmission) {
      return res.status(404).json({ error: 'Could not resolve admission record for payment' })
    }

    const branchId = targetAdmission.branchId
    const targetSessionId = targetAdmission.sessionId
    const feePlan = targetAdmission.feePlan

    const netPayable = feePlan?.netPayable ?? feePlan?.totalFees ?? 0
    const alreadyPaid = (targetAdmission.payments || []).reduce((sum: number, p: any) => sum + p.totalAmount, 0)
    const pendingDue = Math.max(0, netPayable - alreadyPaid)

    // Overpayment prevention
    if (numAmount > pendingDue) {
      return res.status(400).json({
        error: `Payment amount (₹${numAmount}) exceeds remaining balance (₹${pendingDue}) for session ${targetAdmission.session?.name}. Overpayments are prevented.`,
      })
    }

    // Duplicate payment safety check (within 5 minutes with same student, amount, and mode)
    if (!allowDuplicate) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
      const potentialDuplicate = await prisma.payment.findFirst({
        where: {
          studentId,
          totalAmount: numAmount,
          paymentMode: paymentMode || 'UPI',
          createdAt: { gte: fiveMinutesAgo },
          isReversed: false,
        },
      })

      if (potentialDuplicate) {
        return res.status(409).json({
          warning: 'POTENTIAL_DUPLICATE',
          error: `A payment of ₹${numAmount} via ${paymentMode} was recorded just now (Receipt: ${potentialDuplicate.receiptNumber}). Set allowDuplicate: true if this is an intentional separate payment.`,
        })
      }
    }

    // Process payment in transaction
    const payment = await prisma.$transaction(async (tx) => {
      let finalReceipt = receiptNumber
      if (!finalReceipt || !finalReceipt.trim()) {
        finalReceipt = await generateSequentialReceiptNumber(branchId, targetSessionId, tx)
      }

      const parsedPaymentDate = paymentDate ? new Date(paymentDate) : new Date()

      const newPayment = await tx.payment.create({
        data: {
          studentId,
          branchId,
          admissionId: targetAdmission.id,
          sessionId: targetSessionId,
          receiptNumber: finalReceipt,
          totalAmount: numAmount,
          paymentDate: parsedPaymentDate,
          paymentMode: paymentMode || 'UPI',
          referenceNumber: referenceNumber || null,
          notes: notes || null,
        },
      })

      // Allocate to fee plan records
      if (feePlan) {
        if (!feePlan.installments || feePlan.installments.length === 0) {
          const autoInst = await tx.installment.create({
            data: {
              feePlanId: feePlan.id,
              installmentNo: 1,
              label: 'Session Fee',
              dueDate: new Date(),
              amountDue: netPayable,
            },
          })
          feePlan.installments = [{ ...autoInst, allocations: [] } as any]
        }

        if (Array.isArray(allocations) && allocations.length > 0) {
          // Custom manual allocation
          for (const item of allocations) {
            if (Number(item.allocatedAmount) > 0) {
              await tx.paymentAllocation.create({
                data: {
                  paymentId: newPayment.id,
                  installmentId: item.installmentId,
                  allocatedAmount: Number(item.allocatedAmount),
                },
              })
            }
          }
        } else {
          // Automatic FIFO allocation across installments
          let remaining = numAmount
          for (const inst of feePlan.installments) {
            if (remaining <= 0) break

            const paidOnInst = inst.allocations.reduce((sum: number, a: any) => {
              return a.payment.isReversed ? sum : sum + a.allocatedAmount
            }, 0)
            const needed = Math.max(0, inst.amountDue - paidOnInst)

            if (needed > 0) {
              const allocateNow = Math.min(remaining, needed)
              await tx.paymentAllocation.create({
                data: {
                  paymentId: newPayment.id,
                  installmentId: inst.id,
                  allocatedAmount: allocateNow,
                },
              })
              remaining -= allocateNow
            }
          }
        }
      }

      return newPayment
    })

    res.status(201).json({
      success: true,
      payment,
      studentName: student.fullName,
      studentCode: student.studentCode,
      parentPhone: student.parentPhone,
      studentPhone: student.studentPhone,
      rollNumber: targetAdmission.rollNumber,
      standard: targetAdmission.standard,
      remainingBalance: pendingDue - numAmount,
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to record payment' })
  }
})

// POST reverse payment (financial audit safe)
feeRouter.post('/payments/:id/reverse', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    const { reversalReason } = req.body

    if (!reversalReason || !String(reversalReason).trim()) {
      return res.status(400).json({ error: 'A specific reason is required to reverse a financial payment' })
    }

    const existingPayment = await prisma.payment.findUnique({
      where: { id },
      include: { student: true, previousDue: true },
    })

    if (!existingPayment) {
      return res.status(404).json({ error: 'Payment not found' })
    }

    if (existingPayment.isReversed) {
      return res.status(400).json({ error: 'Payment is already reversed' })
    }

    const updated = await prisma.$transaction(async (tx) => {
      const reversedPayment = await tx.payment.update({
        where: { id },
        data: {
          isReversed: true,
          reversalReason: String(reversalReason).trim(),
          reversedAt: new Date(),
        },
      })

      // If this was a payment towards a previous session due, decrement collectedAmount
      if (existingPayment.previousDueId) {
        await tx.previousSessionDue.update({
          where: { id: existingPayment.previousDueId },
          data: {
            collectedAmount: { decrement: existingPayment.totalAmount },
          },
        })
      }

      return reversedPayment
    })

    res.json({
      success: true,
      message: 'Payment reversed successfully. Outstanding balances updated automatically.',
      payment: updated,
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to reverse payment', details: String(error) })
  }
})

// GET payments register with universal filters
feeRouter.get('/payments', async (req: Request, res: Response) => {
  try {
    const { branchId, sessionId, standard, studentId, paymentMode, isReversed, search, startDate, endDate } = req.query

    const where: any = {}

    // Universal branch filter: blank or "ALL" means all branches
    if (branchId && branchId !== 'ALL') {
      where.branchId = String(branchId)
    }

    // Universal session filter: blank or "ALL" means all sessions
    if (sessionId && sessionId !== 'ALL') {
      where.sessionId = String(sessionId)
    }

    // Universal class/standard filter
    if (standard && standard !== 'ALL') {
      where.admission = {
        standard: String(standard),
      }
    }

    if (studentId) {
      where.studentId = String(studentId)
    }

    if (paymentMode && paymentMode !== 'ALL') {
      where.paymentMode = String(paymentMode)
    }

    if (isReversed !== undefined && isReversed !== 'ALL') {
      where.isReversed = isReversed === 'true'
    }

    if (startDate || endDate) {
      where.paymentDate = {}
      if (startDate) {
        where.paymentDate.gte = new Date(String(startDate))
      }
      if (endDate) {
        const end = new Date(String(endDate))
        end.setHours(23, 59, 59, 999)
        where.paymentDate.lte = end
      }
    }

    if (search && String(search).trim()) {
      const q = String(search).trim()
      where.OR = [
        { receiptNumber: { contains: q } },
        { student: { fullName: { contains: q } } },
        { student: { studentCode: { contains: q } } },
        { student: { parentPhone: { contains: q } } },
        { admission: { rollNumber: { contains: q } } },
        { admission: { standard: { contains: q } } },
        { referenceNumber: { contains: q } },
        { notes: { contains: q } },
      ]
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        student: true,
        branch: true,
        session: true,
        admission: true,
        allocations: {
          include: { installment: true },
        },
      },
      orderBy: { paymentDate: 'desc' },
    })

    res.json(payments)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch payments register', details: String(error) })
  }
})

// GET dues breakdown with universal filters
feeRouter.get('/dues', async (req: Request, res: Response) => {
  try {
    const { branchId, sessionId, standard, status } = req.query

    const admissionWhere: any = { isActive: true }
    if (branchId && branchId !== 'ALL') {
      admissionWhere.branchId = String(branchId)
    }
    if (sessionId && sessionId !== 'ALL') {
      admissionWhere.sessionId = String(sessionId)
    }
    if (standard && standard !== 'ALL') {
      admissionWhere.standard = String(standard)
    }

    const installments = await prisma.installment.findMany({
      where: {
        feePlan: {
          admission: admissionWhere,
        },
      },
      include: {
        feePlan: {
          include: {
            admission: {
              include: {
                student: true,
                branch: true,
                session: true,
              },
            },
          },
        },
        allocations: {
          include: { payment: true },
        },
      },
      orderBy: { dueDate: 'asc' },
    })

    const items = installments
      .map((inst) => {
        const student = inst.feePlan.admission.student
        const admission = inst.feePlan.admission

        const paid = inst.allocations.reduce((sum, a) => {
          return a.payment.isReversed ? sum : sum + a.allocatedAmount
        }, 0)
        const balance = Math.max(0, inst.amountDue - paid)
        const computedStatus = calculateInstallmentStatus(inst.amountDue, paid, inst.dueDate)

        return {
          id: inst.id,
          installmentNo: inst.installmentNo,
          label: inst.label,
          dueDate: inst.dueDate.toISOString(),
          amountDue: inst.amountDue,
          amountPaid: paid,
          balanceRemaining: balance,
          status: computedStatus,
          admissionId: admission.id,
          branchId: admission.branchId,
          sessionId: admission.sessionId,
          student: {
            id: student.id,
            admissionId: admission.id,
            fullName: student.fullName,
            studentCode: student.studentCode,
            rollNumber: admission.rollNumber,
            standard: admission.standard,
            parentPhone: student.parentPhone,
            branchName: admission.branch.name,
            sessionName: admission.session.name,
          },
        }
      })
      .filter((item) => {
        if (!status || status === 'ALL') return item.balanceRemaining > 0
        return item.status === status
      })

    res.json(items)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dues register', details: String(error) })
  }
})
