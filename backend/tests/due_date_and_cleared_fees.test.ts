import { describe, it, expect, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app'
import { prisma } from '../src/services/db'
import { calculateInstallmentStatus } from '../src/routes/student.router'

const app = createApp()

describe('Due Date Management & Cleared Fees Blank Due Date Feature', () => {
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('calculateInstallmentStatus returns PAID and never OVERDUE when balance is 0 or paid in full', () => {
    const yesterday = new Date(Date.now() - 5 * 24 * 3600 * 1000)
    const longAgo = new Date(Date.now() - 365 * 24 * 3600 * 1000)

    // Paid in full even if due date was long ago
    expect(calculateInstallmentStatus(10000, 10000, yesterday)).toBe('PAID')
    expect(calculateInstallmentStatus(10000, 10000, longAgo)).toBe('PAID')

    // Overpaid or 0 amount due
    expect(calculateInstallmentStatus(0, 0, yesterday)).toBe('PAID')
    expect(calculateInstallmentStatus(5000, 6000, yesterday)).toBe('PAID')

    // Unpaid past due should be OVERDUE
    expect(calculateInstallmentStatus(10000, 0, yesterday)).toBe('OVERDUE')
  })

  it('allows setting due date directly on student and blanks due date when fees are fully paid', async () => {
    // 1. Fetch a branch and session
    const branch = await prisma.branch.findFirst({ where: { isActive: true } })
    const session = (await prisma.academicSession.findFirst({ where: { isCurrent: true } })) || (await prisma.academicSession.findFirst())

    expect(branch).toBeDefined()
    expect(session).toBeDefined()

    // 2. Admit a new student with explicit due date
    const uniqueRoll = `ROLL-DD-${Date.now().toString().slice(-6)}`
    const initialDue = new Date(Date.now() + 20 * 24 * 3600 * 1000).toISOString().split('T')[0]

    const admitRes = await request(app)
      .post('/api/students')
      .send({
        fullName: 'Due Date Test Student',
        rollNumber: uniqueRoll,
        standard: 'Class 12',
        branchId: branch?.id,
        sessionId: session?.id,
        parentPhone: '9888877777',
        totalFees: 15000,
        dueDate: initialDue,
      })

    expect(admitRes.status).toBe(201)
    const studentId = admitRes.body.student.id
    expect(studentId).toBeDefined()

    // 3. Query student profile and verify dueDate is set
    const profileRes = await request(app).get(`/api/students/${studentId}`)
    expect(profileRes.status).toBe(200)
    expect(profileRes.body.feeSummary.totalPending).toBe(15000)
    expect(profileRes.body.nextDueDate).toBeDefined()
    expect(profileRes.body.installments[0].dueDate).toBeDefined()
    expect(profileRes.body.installments[0].status).toBe('UPCOMING')

    const installmentId = profileRes.body.installments[0].id

    // 4. Update due date via POST /api/fees/student/:studentId/due-date
    const newDueDate = new Date(Date.now() + 45 * 24 * 3600 * 1000).toISOString()
    const updateDueRes = await request(app)
      .post(`/api/fees/student/${studentId}/due-date`)
      .send({ dueDate: newDueDate })

    expect(updateDueRes.status).toBe(200)
    expect(updateDueRes.body.success).toBe(true)

    // Verify updated profile
    const profileUpdated = await request(app).get(`/api/students/${studentId}`)
    expect(new Date(profileUpdated.body.nextDueDate).getTime()).toBe(new Date(newDueDate).getTime())

    // 5. Update due date via PATCH /api/fees/installments/:id/due-date
    const patchDueDate = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString()
    const patchDueRes = await request(app)
      .patch(`/api/fees/installments/${installmentId}/due-date`)
      .send({ dueDate: patchDueDate })

    expect(patchDueRes.status).toBe(200)
    expect(patchDueRes.body.success).toBe(true)
    expect(new Date(patchDueRes.body.installment.dueDate).getTime()).toBe(new Date(patchDueDate).getTime())

    // 6. Pay full fees: ₹15,000
    const paymentRes = await request(app)
      .post('/api/fees/payments')
      .send({
        studentId,
        amount: 15000,
        paymentMode: 'UPI',
        notes: 'Full fee clearance',
      })

    expect(paymentRes.status).toBe(201)
    expect(paymentRes.body.remainingBalance).toBe(0)

    // 7. Verify student profile: fees are all cleared => nextDueDate must be NULL and status PAID
    const clearedProfile = await request(app).get(`/api/students/${studentId}`)
    expect(clearedProfile.status).toBe(200)
    expect(clearedProfile.body.feeSummary.totalPending).toBe(0)
    expect(clearedProfile.body.nextDueDate).toBeNull()
    expect(clearedProfile.body.dueDate).toBeNull()
    expect(clearedProfile.body.installments[0].dueDate).toBeNull()
    expect(clearedProfile.body.installments[0].status).toBe('PAID')

    // 8. Verify student does NOT appear in dues register or overdue queries
    const duesRes = await request(app).get('/api/fees/dues?status=OVERDUE')
    expect(duesRes.status).toBe(200)
    const inOverdue = duesRes.body.some((item: any) => item.student.id === studentId)
    expect(inOverdue).toBe(false)

    const allDuesRes = await request(app).get('/api/fees/dues')
    expect(allDuesRes.status).toBe(200)
    const inDues = allDuesRes.body.some((item: any) => item.student.id === studentId)
    expect(inDues).toBe(false)
  })
})
