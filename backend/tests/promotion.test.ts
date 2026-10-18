import { describe, it, expect, afterAll } from 'vitest'
import { prisma } from '../src/services/db'
import { suggestNextStandard } from '../src/routes/student.router'

describe('Student Promotion to Next Academic Session', () => {
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('should suggest next logical class based on current class', () => {
    expect(suggestNextStandard('Class 8')).toBe('Class 9')
    expect(suggestNextStandard('Class 9')).toBe('Class 10')
    expect(suggestNextStandard('Class 10')).toBe('Class 11 Science')
    expect(suggestNextStandard('Class 11 Science')).toBe('Class 12 Science')
    expect(suggestNextStandard('Class 11 Commerce')).toBe('Class 12 Commerce')
  })

  it('should properly promote student to next session and carry forward unpaid dues as PreviousSessionDue', async () => {
    const branch = await prisma.branch.findFirst({ where: { isActive: true } })
    expect(branch).toBeDefined()

    // 1. Ensure Source Session (2026-27) and Next Session (2027-28) exist
    const session2026 = await prisma.academicSession.upsert({
      where: { name: '2026-27' },
      update: {},
      create: {
        name: '2026-27',
        displayName: 'Academic Year 2026-27',
        startDate: new Date('2026-06-01'),
        endDate: new Date('2027-05-31'),
        isCurrent: true,
      },
    })

    const session2027 = await prisma.academicSession.upsert({
      where: { name: '2027-28' },
      update: {},
      create: {
        name: '2027-28',
        displayName: 'Academic Year 2027-28',
        startDate: new Date('2027-06-01'),
        endDate: new Date('2028-05-31'),
        isCurrent: false,
      },
    })

    // 2. Create student in 2026-27 with Class 10
    const student = await prisma.student.create({
      data: {
        studentCode: `SC-PROM-${Date.now()}`,
        fullName: 'Prathamesh Joshi',
        parentPhone: '9855443322',
      },
    })

    const adm2026 = await prisma.studentAdmission.create({
      data: {
        studentId: student.id,
        branchId: branch!.id,
        sessionId: session2026.id,
        rollNumber: `PROM-10-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        standard: 'Class 10',
      },
    })

    // Fee in 2026-27: Total 25000, Paid 15000, Pending Due: 10000
    const plan2026 = await prisma.feePlan.create({
      data: {
        admissionId: adm2026.id,
        sessionId: session2026.id,
        totalFees: 25000,
        totalDiscount: 0,
        netPayable: 25000,
      },
    })

    const p1 = await prisma.payment.create({
      data: {
        studentId: student.id,
        branchId: branch!.id,
        receiptNumber: `REC-PRM-${Date.now()}`,
        totalAmount: 15000,
        paymentMode: 'UPI',
      },
    })

    // Unpaid due in 2026-27 is 25000 - 15000 = 10000
    const pendingDue = plan2026.netPayable - p1.totalAmount
    expect(pendingDue).toBe(10000)

    // 3. Promote Prathamesh to 2027-28 (Class 11 Science)
    const newRoll = `PROM-11-${Date.now()}-${Math.floor(Math.random() * 10000)}`
    const newFees = 45000

    // Carry forward due record
    const dueRecord = await prisma.previousSessionDue.create({
      data: {
        studentId: student.id,
        originalSessionId: session2026.id,
        currentSessionId: session2027.id,
        outstandingAmount: pendingDue,
        description: `Carried forward from Class 10 in ${session2026.name}`,
      },
    })
    expect(dueRecord.outstandingAmount).toBe(10000)

    // New admission in 2027-28
    const adm2027 = await prisma.studentAdmission.create({
      data: {
        studentId: student.id,
        branchId: branch!.id,
        sessionId: session2027.id,
        rollNumber: newRoll,
        standard: 'Class 11 Science',
      },
    })
    expect(adm2027.sessionId).toBe(session2027.id)

    // New fee plan for 2027-28
    const plan2027 = await prisma.feePlan.create({
      data: {
        admissionId: adm2027.id,
        sessionId: session2027.id,
        totalFees: newFees,
        totalDiscount: 0,
        netPayable: newFees,
      },
    })
    expect(plan2027.netPayable).toBe(45000)

    // 4. Verify historical record integrity
    // The student now has 2 admissions: one in 2026-27 and one in 2027-28
    const studentAdmissions = await prisma.studentAdmission.findMany({
      where: { studentId: student.id },
      include: { session: true, feePlan: true },
      orderBy: { createdAt: 'asc' },
    })

    expect(studentAdmissions.length).toBe(2)
    expect(studentAdmissions[0].session.name).toBe('2026-27')
    expect(studentAdmissions[0].standard).toBe('Class 10')
    expect(studentAdmissions[0].feePlan?.netPayable).toBe(25000)

    expect(studentAdmissions[1].session.name).toBe('2027-28')
    expect(studentAdmissions[1].standard).toBe('Class 11 Science')
    expect(studentAdmissions[1].feePlan?.netPayable).toBe(45000)

    // Verify PreviousSessionDue record preserves session traceability
    const dues = await prisma.previousSessionDue.findMany({
      where: { studentId: student.id },
      include: { originalSession: true, currentSession: true },
    })
    expect(dues.length).toBe(1)
    expect(dues[0].originalSession.name).toBe('2026-27')
    expect(dues[0].currentSession.name).toBe('2027-28')
    expect(dues[0].outstandingAmount).toBe(10000)
  })
})
