import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma, checkDatabaseConnection } from '../src/services/db'

describe('SQLite Database & Domain Persistence Tests', () => {
  beforeAll(async () => {
    const isConnected = await checkDatabaseConnection()
    expect(isConnected).toBe(true)
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('should have seeded branches (Nagpur, Wardha)', async () => {
    const branches = await prisma.branch.findMany()
    expect(branches.length).toBeGreaterThanOrEqual(2)

    const nagpur = branches.find((b) => b.code === 'NGP')
    expect(nagpur).toBeDefined()
    expect(nagpur?.name).toContain('Nagpur')
  })

  it('should have an active current academic session', async () => {
    const currentSession = await prisma.academicSession.findFirst({
      where: { isCurrent: true },
    })
    expect(currentSession).toBeDefined()
    expect(currentSession?.name).toBe('2026-27')
  })

  it('should create student, admission, fee plan and installments with branch isolation', async () => {
    const branch = await prisma.branch.findFirst({ where: { code: 'NGP' } })
    const session = await prisma.academicSession.findFirst({ where: { isCurrent: true } })
    expect(branch).toBeDefined()
    expect(session).toBeDefined()

    const testRoll = `TEST-${Date.now().toString().slice(-5)}`
    const totalFees = 30000

    // Create student
    const student = await prisma.student.create({
      data: {
        studentCode: `SC-TEST-${Date.now()}`,
        fullName: 'Aarav Patel',
        parentPhone: '9876543210',
      },
    })
    expect(student.id).toBeDefined()

    // Create admission
    const admission = await prisma.studentAdmission.create({
      data: {
        studentId: student.id,
        branchId: branch!.id,
        sessionId: session!.id,
        rollNumber: testRoll,
        standard: 'Class 10',
      },
    })
    expect(admission.id).toBeDefined()

    // Create fee plan
    const feePlan = await prisma.feePlan.create({
      data: {
        admissionId: admission.id,
        sessionId: session!.id,
        totalFees,
        totalDiscount: 2000,
        netPayable: 28000,
      },
    })
    expect(feePlan.netPayable).toBe(28000)

    // Create 2 installments
    const inst1 = await prisma.installment.create({
      data: {
        feePlanId: feePlan.id,
        installmentNo: 1,
        label: 'Installment 1',
        dueDate: new Date(),
        amountDue: 14000,
      },
    })

    const inst2 = await prisma.installment.create({
      data: {
        feePlanId: feePlan.id,
        installmentNo: 2,
        label: 'Installment 2',
        dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        amountDue: 14000,
      },
    })

    // Record a payment of 14000 against Installment 1
    const receiptNum = `REC-TEST-${Date.now()}`
    const payment = await prisma.payment.create({
      data: {
        studentId: student.id,
        branchId: branch!.id,
        receiptNumber: receiptNum,
        totalAmount: 14000,
        paymentMode: 'UPI',
      },
    })

    const allocation = await prisma.paymentAllocation.create({
      data: {
        paymentId: payment.id,
        installmentId: inst1.id,
        allocatedAmount: 14000,
      },
    })

    expect(allocation.allocatedAmount).toBe(14000)

    // Verify balances
    const payments = await prisma.payment.findMany({
      where: { studentId: student.id, isReversed: false },
    })
    const totalPaid = payments.reduce((sum, p) => sum + p.totalAmount, 0)
    expect(totalPaid).toBe(14000)

    const remainingDue = feePlan.netPayable - totalPaid
    expect(remainingDue).toBe(14000)
  })

  it('should isolate records between different branches', async () => {
    const branches = await prisma.branch.findMany()
    const nagpur = branches.find((b) => b.code === 'NGP')
    const wardha = branches.find((b) => b.code === 'WRD')

    const nagpurAdmissions = await prisma.studentAdmission.findMany({
      where: { branchId: nagpur!.id },
    })
    const wardhaAdmissions = await prisma.studentAdmission.findMany({
      where: { branchId: wardha!.id },
    })

    // Admissions from Nagpur must not appear under Wardha
    const overlap = nagpurAdmissions.filter((na) =>
      wardhaAdmissions.some((wa) => wa.id === na.id)
    )
    expect(overlap.length).toBe(0)
  })
})
