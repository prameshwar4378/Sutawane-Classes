import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app'
import { prisma } from '../src/services/db'
import { calculateInstallmentStatus } from '../src/routes/student.router'

describe('Advanced Student Management & Installment Logic', () => {
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('should correctly calculate installment statuses based on amount and due date', () => {
    const today = new Date()
    const yesterday = new Date(today.getTime() - 24 * 3600 * 1000)
    const futureDate = new Date(today.getTime() + 10 * 24 * 3600 * 1000)

    // Paid
    expect(calculateInstallmentStatus(10000, 10000, yesterday)).toBe('PAID')
    expect(calculateInstallmentStatus(10000, 12000, futureDate)).toBe('PAID')

    // Partial
    expect(calculateInstallmentStatus(10000, 5000, yesterday)).toBe('PARTIAL')
    expect(calculateInstallmentStatus(10000, 5000, futureDate)).toBe('PARTIAL')

    // Overdue
    expect(calculateInstallmentStatus(10000, 0, yesterday)).toBe('OVERDUE')

    // Due Today
    expect(calculateInstallmentStatus(10000, 0, today)).toBe('DUE')

    // Upcoming
    expect(calculateInstallmentStatus(10000, 0, futureDate)).toBe('UPCOMING')
  })

  it('should create a student and query the full profile with calculated fees and installments', async () => {
    const branch = await prisma.branch.findFirst({ where: { isActive: true } })
    const session = await prisma.academicSession.findFirst({ where: { isCurrent: true } })
    expect(branch).toBeDefined()
    expect(session).toBeDefined()

    const rollNumber = `PROF-${Date.now().toString().slice(-5)}`

    // Create student
    const student = await prisma.student.create({
      data: {
        studentCode: `SC-PROF-${Date.now()}`,
        fullName: 'Sneha Kulkarni',
        parentPhone: '9988776655',
        address: 'Dharampeth, Nagpur',
      },
    })

    // Create admission
    const admission = await prisma.studentAdmission.create({
      data: {
        studentId: student.id,
        branchId: branch!.id,
        sessionId: session!.id,
        rollNumber,
        standard: 'Class 12 Science',
      },
    })

    // Create fee plan: 40000, discount 5000 -> net 35000
    const feePlan = await prisma.feePlan.create({
      data: {
        admissionId: admission.id,
        sessionId: session!.id,
        totalFees: 40000,
        totalDiscount: 5000,
        netPayable: 35000,
      },
    })

    // Create installments
    const inst1 = await prisma.installment.create({
      data: {
        feePlanId: feePlan.id,
        installmentNo: 1,
        label: 'Term 1',
        dueDate: new Date(),
        amountDue: 20000,
      },
    })

    const inst2 = await prisma.installment.create({
      data: {
        feePlanId: feePlan.id,
        installmentNo: 2,
        label: 'Term 2',
        dueDate: new Date(Date.now() + 60 * 24 * 3600 * 1000),
        amountDue: 15000,
      },
    })

    // Record partial payment of 10000 on Term 1
    const payment = await prisma.payment.create({
      data: {
        studentId: student.id,
        branchId: branch!.id,
        receiptNumber: `REC-PROF-${Date.now()}`,
        totalAmount: 10000,
        paymentMode: 'CASH',
      },
    })

    await prisma.paymentAllocation.create({
      data: {
        paymentId: payment.id,
        installmentId: inst1.id,
        allocatedAmount: 10000,
      },
    })

    // Verify payments and allocations
    const profile = await prisma.student.findUnique({
      where: { id: student.id },
      include: {
        admissions: {
          include: {
            feePlan: {
              include: {
                installments: {
                  include: { allocations: true },
                },
              },
            },
          },
        },
        payments: true,
      },
    })

    expect(profile).toBeDefined()
    expect(profile?.fullName).toBe('Sneha Kulkarni')
    expect(profile?.admissions[0].standard).toBe('Class 12 Science')
    expect(profile?.payments[0].totalAmount).toBe(10000)

    // Safe Archive test: toggle admission isActive without deleting payment records
    await prisma.studentAdmission.update({
      where: { id: admission.id },
      data: { isActive: false },
    })

    const archivedAdmission = await prisma.studentAdmission.findUnique({
      where: { id: admission.id },
    })
    expect(archivedAdmission?.isActive).toBe(false)

    // Payments must still exist
    const preservedPayments = await prisma.payment.findMany({
      where: { studentId: student.id },
    })
    expect(preservedPayments.length).toBe(1)
    expect(preservedPayments[0].totalAmount).toBe(10000)

    // Permanent Deletion: DELETE /api/students/:id cascades everything cleanly
    const app = createApp()
    const deleteRes = await request(app).delete(`/api/students/${student.id}`)
    expect(deleteRes.status).toBe(200)
    expect(deleteRes.body.success).toBe(true)

    // Verify all records deleted
    const deletedStudent = await prisma.student.findUnique({ where: { id: student.id } })
    expect(deletedStudent).toBeNull()

    const remainingAdmissions = await prisma.studentAdmission.findMany({ where: { studentId: student.id } })
    expect(remainingAdmissions.length).toBe(0)

    const remainingFeePlans = await prisma.feePlan.findMany({ where: { id: feePlan.id } })
    expect(remainingFeePlans.length).toBe(0)

    const remainingInstallments = await prisma.installment.findMany({ where: { feePlanId: feePlan.id } })
    expect(remainingInstallments.length).toBe(0)

    const remainingPayments = await prisma.payment.findMany({ where: { studentId: student.id } })
    expect(remainingPayments.length).toBe(0)

    // Calling delete on already-deleted student returns 404
    const notFoundRes = await request(app).delete(`/api/students/${student.id}`)
    expect(notFoundRes.status).toBe(404)
  })
})
