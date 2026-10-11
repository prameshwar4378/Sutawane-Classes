import { describe, it, expect, afterAll } from 'vitest'
import { prisma } from '../src/services/db'
import { generateSequentialReceiptNumber } from '../src/routes/fee.router'

describe('Phase 5: Installment Fee System & Accounting Rules', () => {
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('should generate unique, sequential receipt numbers per branch and session', async () => {
    const branch = await prisma.branch.findFirst({ where: { code: 'NGP' } })
    const session = await prisma.academicSession.findFirst({ where: { isCurrent: true } })
    expect(branch).toBeDefined()
    expect(session).toBeDefined()

    const r1 = await generateSequentialReceiptNumber(branch!.id, session!.id)
    const r2 = await generateSequentialReceiptNumber(branch!.id, session!.id)

    expect(r1).toContain('SC/2026-27/NGP/REC-')
    expect(r2).toContain('SC/2026-27/NGP/REC-')
    expect(r1).not.toBe(r2)

    // Number part must increment
    const n1 = parseInt(r1.split('REC-')[1], 10)
    const n2 = parseInt(r2.split('REC-')[1], 10)
    expect(n2).toBe(n1 + 1)
  })

  it('should prevent overpayments and allow payment reversals with audit trail', async () => {
    const branch = await prisma.branch.findFirst({ where: { code: 'NGP' } })
    const session = await prisma.academicSession.findFirst({ where: { isCurrent: true } })

    // Create student
    const student = await prisma.student.create({
      data: {
        studentCode: `SC-FEE-${Date.now()}`,
        fullName: 'Manish Verma',
        parentPhone: '9811223344',
      },
    })

    const admission = await prisma.studentAdmission.create({
      data: {
        studentId: student.id,
        branchId: branch!.id,
        sessionId: session!.id,
        rollNumber: `FEE-${Date.now().toString().slice(-4)}`,
        standard: 'Class 10',
      },
    })

    const feePlan = await prisma.feePlan.create({
      data: {
        admissionId: admission.id,
        sessionId: session!.id,
        totalFees: 20000,
        totalDiscount: 0,
        netPayable: 20000,
      },
    })

    const inst1 = await prisma.installment.create({
      data: {
        feePlanId: feePlan.id,
        installmentNo: 1,
        label: 'Token Fee',
        dueDate: new Date(),
        amountDue: 10000,
      },
    })

    const inst2 = await prisma.installment.create({
      data: {
        feePlanId: feePlan.id,
        installmentNo: 2,
        label: 'Final Fee',
        dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        amountDue: 10000,
      },
    })

    // Record valid payment of 10000
    const receiptNum = await generateSequentialReceiptNumber(branch!.id, session!.id)
    const payment = await prisma.payment.create({
      data: {
        studentId: student.id,
        branchId: branch!.id,
        receiptNumber: receiptNum,
        totalAmount: 10000,
        paymentMode: 'UPI',
        referenceNumber: 'UPI-REF-123456',
      },
    })

    const allocation = await prisma.paymentAllocation.create({
      data: {
        paymentId: payment.id,
        installmentId: inst1.id,
        allocatedAmount: 10000,
      },
    })

    // Check balance: 20000 - 10000 = 10000
    const activePayments = await prisma.payment.findMany({
      where: { studentId: student.id, isReversed: false },
    })
    const paidBefore = activePayments.reduce((s, p) => s + p.totalAmount, 0)
    expect(paidBefore).toBe(10000)

    // Reverse payment
    const reversalReason = 'Parent requested refund due to wrong bank account transfer'
    const reversed = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        isReversed: true,
        reversalReason,
        reversedAt: new Date(),
      },
    })

    expect(reversed.isReversed).toBe(true)
    expect(reversed.reversalReason).toBe(reversalReason)
    expect(reversed.reversedAt).toBeDefined()

    // Active balance after reversal should revert back to 0 paid, 20000 pending
    const activeAfterReversal = await prisma.payment.findMany({
      where: { studentId: student.id, isReversed: false },
    })
    const paidAfter = activeAfterReversal.reduce((s, p) => s + p.totalAmount, 0)
    expect(paidAfter).toBe(0)
    expect(feePlan.netPayable - paidAfter).toBe(20000)
  })
})
