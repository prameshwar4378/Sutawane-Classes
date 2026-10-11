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

// GET fee plan with installments and discounts for an admission
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
                payments: {
                  where: { isReversed: false },
                },
              },
            },
            branch: true,
            session: true,
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
    const totalPaid = student.payments.reduce((sum, p) => sum + p.totalAmount, 0)
    const netPayable = feePlan.netPayable
    const totalPending = Math.max(0, netPayable - totalPaid)

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
            student: {
              include: { payments: { where: { isReversed: false } } },
            },
          },
        },
      },
    })

    if (!feePlan) {
      return res.status(404).json({ error: 'Fee plan not found' })
    }

    const totalPaid = feePlan.admission.student.payments.reduce((s, p) => s + p.totalAmount, 0)
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

// POST record payment with overpayment prevention & sequential receipt
feeRouter.post('/payments', async (req: Request, res: Response) => {
  try {
    const {
      studentId,
      amount,
      paymentMode,
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
          where: { isActive: true },
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
          },
        },
        payments: {
          where: { isReversed: false },
        },
      },
    })

    if (!student || student.admissions.length === 0) {
      return res.status(404).json({ error: 'Student has no active admission' })
    }

    const admission = student.admissions[0]
    const branchId = admission.branchId
    const sessionId = admission.sessionId
    const feePlan = admission.feePlan

    const netPayable = feePlan?.netPayable || feePlan?.totalFees || 0
    const alreadyPaid = student.payments.reduce((sum, p) => sum + p.totalAmount, 0)
    const pendingDue = Math.max(0, netPayable - alreadyPaid)

    // Overpayment prevention
    if (numAmount > pendingDue) {
      return res.status(400).json({
        error: `Payment amount (₹${numAmount}) exceeds remaining balance (₹${pendingDue}). Overpayments are prevented.`,
      })
    }

    // Duplicate payment check (within 24 hours with same student, amount, and mode)
    if (!allowDuplicate) {
      const oneDayAgo = new Date(Date.now() - 24 * 3600 * 1000)
      const potentialDuplicate = await prisma.payment.findFirst({
        where: {
          studentId,
          totalAmount: numAmount,
          paymentMode: paymentMode || 'UPI',
          paymentDate: { gte: oneDayAgo },
          isReversed: false,
        },
      })

      if (potentialDuplicate) {
        return res.status(409).json({
          warning: 'POTENTIAL_DUPLICATE',
          error: `A payment of ₹${numAmount} via ${paymentMode} was already recorded for this student in the last 24 hours (Receipt: ${potentialDuplicate.receiptNumber}). Set allowDuplicate: true to confirm.`,
        })
      }
    }

    // Process payment in transaction
    const payment = await prisma.$transaction(async (tx) => {
      // Generate sequential receipt if none provided
      let finalReceipt = receiptNumber
      if (!finalReceipt || !finalReceipt.trim()) {
        finalReceipt = await generateSequentialReceiptNumber(branchId, sessionId, tx)
      }

      const newPayment = await tx.payment.create({
        data: {
          studentId,
          branchId,
          receiptNumber: finalReceipt,
          totalAmount: numAmount,
          paymentMode: paymentMode || 'UPI',
          referenceNumber: referenceNumber || null,
          notes: notes || null,
        },
      })

      // Allocate to installments
      if (feePlan && feePlan.installments.length > 0) {
        if (Array.isArray(allocations) && allocations.length > 0) {
          // Manual custom allocation
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
          // Automatic FIFO allocation
          let remaining = numAmount
          for (const inst of feePlan.installments) {
            if (remaining <= 0) break

            const paidOnInst = inst.allocations.reduce((sum, a) => {
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
      rollNumber: admission.rollNumber,
      standard: admission.standard,
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
      include: { student: true },
    })

    if (!existingPayment) {
      return res.status(404).json({ error: 'Payment not found' })
    }

    if (existingPayment.isReversed) {
      return res.status(400).json({ error: 'Payment is already reversed' })
    }

    const updated = await prisma.payment.update({
      where: { id },
      data: {
        isReversed: true,
        reversalReason: String(reversalReason).trim(),
        reversedAt: new Date(),
      },
    })

    res.json({
      success: true,
      message: 'Payment reversed successfully. Installment balances have been updated automatically.',
      payment: updated,
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to reverse payment', details: String(error) })
  }
})

// GET payments register with filters
feeRouter.get('/payments', async (req: Request, res: Response) => {
  try {
    const { branchId, studentId, paymentMode, isReversed, search } = req.query

    const where: any = {}
    if (branchId && branchId !== 'ALL') {
      where.branchId = String(branchId)
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

    if (search && String(search).trim()) {
      const q = String(search).trim()
      where.OR = [
        { receiptNumber: { contains: q } },
        { student: { fullName: { contains: q } } },
        { student: { studentCode: { contains: q } } },
        { referenceNumber: { contains: q } },
      ]
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        student: true,
        branch: true,
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

// GET dues & installments breakdown (Due Today, Overdue, Upcoming, Partial)
feeRouter.get('/dues', async (req: Request, res: Response) => {
  try {
    const { branchId, sessionId, status } = req.query

    const admissionWhere: any = { isActive: true }
    if (branchId && branchId !== 'ALL') {
      admissionWhere.branchId = String(branchId)
    }
    if (sessionId) {
      admissionWhere.sessionId = String(sessionId)
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
          student: {
            id: student.id,
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
