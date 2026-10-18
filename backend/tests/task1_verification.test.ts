import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app'
import { prisma } from '../src/services/db'

describe('TASK 1 Comprehensive Verification Test Suite', () => {
  const app = createApp()
  let branchId: string
  let branchCode: string
  let session2026Id: string
  let session2027Id: string
  let studentId: string
  let studentCode: string
  let admission2026Id: string
  let admission2027Id: string
  let previousDueId: string
  let payment1Id: string
  let payment2Id: string

  beforeAll(async () => {
    // 1. Get or create an active branch
    let branch = await prisma.branch.findFirst({ where: { isActive: true } })
    if (!branch) {
      branch = await prisma.branch.create({
        data: {
          name: 'Main Campus',
          code: 'MAIN',
          address: 'Central Avenue',
          city: 'Nagpur',
          phone: '9876543210',
          isActive: true,
        },
      })
    }
    branchId = branch.id
    branchCode = branch.code

    // 2. Setup Academic Sessions
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
    session2026Id = session2026.id

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
    session2027Id = session2027.id
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  // ---------------------------------------------------------------------------
  // 1. Permanent Student Identity & Admission Creation
  // ---------------------------------------------------------------------------
  it('1. should create student Rahul with permanent identity and session 2026-27 admission', async () => {
    studentCode = `SC-RAHUL-${Date.now()}`
    const res = await request(app)
      .post('/api/students')
      .send({
        studentCode,
        fullName: 'Rahul Sharma',
        parentName: 'Ramesh Sharma',
        parentPhone: '9822001122',
        gender: 'MALE',
        branchId,
        sessionId: session2026Id,
        standard: 'Class 8',
        rollNumber: `R-08-${Date.now().toString().slice(-4)}`,
        totalFees: 12000,
        totalDiscount: 0,
      })

    expect(res.status).toBe(201)
    expect(res.body.student).toBeDefined()
    expect(res.body.student.fullName).toBe('Rahul Sharma')
    expect(res.body.admission).toBeDefined()
    expect(res.body.admission.standard).toBe('Class 8')

    studentId = res.body.student.id
    admission2026Id = res.body.admission.id

    // Check fee plan created with open flexible installment
    const planRes = await request(app).get(`/api/fees/plans/${admission2026Id}`)
    expect(planRes.status).toBe(200)
    expect(planRes.body.totalFees).toBe(12000)
    expect(planRes.body.netPayable).toBe(12000)
    expect(planRes.body.totalPaid).toBe(0)
    expect(planRes.body.totalPending).toBe(12000)
    expect(planRes.body.installments.length).toBeGreaterThanOrEqual(1)
    expect(planRes.body.installments[0].amountDue).toBe(12000)
  })

  // ---------------------------------------------------------------------------
  // 2. Flexible Payments: arbitrary amount, date support, sequential receipts
  // ---------------------------------------------------------------------------
  it('2. should accept flexible payment of arbitrary amount with specific paymentDate', async () => {
    // Payment 1: ₹5,000 on 2026-08-10
    const res1 = await request(app)
      .post('/api/fees/payments')
      .send({
        studentId,
        admissionId: admission2026Id,
        branchId,
        sessionId: session2026Id,
        amount: 5000,
        paymentMode: 'UPI',
        paymentDate: '2026-08-10',
        referenceNumber: 'UPI-RAHUL-001',
        notes: 'First flexible payment',
      })

    expect(res1.status).toBe(201)
    expect(res1.body.success).toBe(true)
    expect(res1.body.payment.totalAmount).toBe(5000)
    expect(res1.body.payment.receiptNumber).toMatch(new RegExp(`^SC/2026-27/${branchCode}/REC-\\d+$`))
    payment1Id = res1.body.payment.id

    // Verify fee plan reflects remaining balance: 12000 - 5000 = 7000
    const planRes1 = await request(app).get(`/api/fees/plans/${admission2026Id}`)
    expect(planRes1.body.totalPaid).toBe(5000)
    expect(planRes1.body.totalPending).toBe(7000)

    // Payment 2: ₹2,000 on 2026-08-15
    const res2 = await request(app)
      .post('/api/fees/payments')
      .send({
        studentId,
        admissionId: admission2026Id,
        branchId,
        sessionId: session2026Id,
        amount: 2000,
        paymentMode: 'CASH',
        paymentDate: '2026-08-15',
        notes: 'Second payment irregular amount',
      })

    expect(res2.status).toBe(201)
    expect(res2.body.payment.totalAmount).toBe(2000)
    payment2Id = res2.body.payment.id

    // Verify sequential receipt increment
    const num1 = parseInt(res1.body.payment.receiptNumber.split('REC-')[1], 10)
    const num2 = parseInt(res2.body.payment.receiptNumber.split('REC-')[1], 10)
    expect(num2).toBe(num1 + 1)

    // Verify fee plan: 12000 - 7000 = 5000 pending
    const planRes2 = await request(app).get(`/api/fees/plans/${admission2026Id}`)
    expect(planRes2.body.totalPaid).toBe(7000)
    expect(planRes2.body.totalPending).toBe(5000)
  })

  // ---------------------------------------------------------------------------
  // 3. Overpayment Prevention
  // ---------------------------------------------------------------------------
  it('3. should reject payments that exceed the remaining balance (Overpayment Prevention)', async () => {
    // Current pending is 5000. Attempt to pay 6000.
    const res = await request(app)
      .post('/api/fees/payments')
      .send({
        studentId,
        admissionId: admission2026Id,
        branchId,
        sessionId: session2026Id,
        amount: 6000,
        paymentMode: 'BANK_TRANSFER',
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/exceeds/i)
  })

  // ---------------------------------------------------------------------------
  // 4. Duplicate Payment Prevention
  // ---------------------------------------------------------------------------
  it('4. should detect potential duplicate payments submitted in quick succession', async () => {
    // Attempt exact duplicate of payment 2 (same amount, same mode)
    const res = await request(app)
      .post('/api/fees/payments')
      .send({
        studentId,
        admissionId: admission2026Id,
        branchId,
        sessionId: session2026Id,
        amount: 2000,
        paymentMode: 'CASH',
      })

    expect(res.status).toBe(409)
    expect(res.body.warning).toBe('POTENTIAL_DUPLICATE')
  })

  // ---------------------------------------------------------------------------
  // 5. Payment Reversal & Authoritative Balance Recalculation
  // ---------------------------------------------------------------------------
  it('5. should safely reverse payment, log audit details, and recalculate balance', async () => {
    // Reverse payment 2 (₹2,000)
    const revRes = await request(app)
      .post(`/api/fees/payments/${payment2Id}/reverse`)
      .send({
        reversalReason: 'Parent paid cash for wrong sibling account',
      })

    expect(revRes.status).toBe(200)
    expect(revRes.body.success).toBe(true)
    expect(revRes.body.payment.isReversed).toBe(true)
    expect(revRes.body.payment.reversalReason).toBe('Parent paid cash for wrong sibling account')

    // Verify balance after reversal: paid is back to 5000, pending is 7000
    const planRes = await request(app).get(`/api/fees/plans/${admission2026Id}`)
    expect(planRes.body.totalPaid).toBe(5000)
    expect(planRes.body.totalPending).toBe(7000)

    // Re-record ₹2,000 with CHEQUE so pending is exactly ₹5,000 before promotion
    const rePayRes = await request(app)
      .post('/api/fees/payments')
      .send({
        studentId,
        admissionId: admission2026Id,
        branchId,
        sessionId: session2026Id,
        amount: 2000,
        paymentMode: 'CHEQUE',
        referenceNumber: 'CHQ-889900',
        paymentDate: '2026-08-20',
      })

    expect(rePayRes.status).toBe(201)
    const planFinal = await request(app).get(`/api/fees/plans/${admission2026Id}`)
    expect(planFinal.body.totalPaid).toBe(7000)
    expect(planFinal.body.totalPending).toBe(5000)
  })

  // ---------------------------------------------------------------------------
  // 6. Student Promotion to Session 2027-28 & Clean Dues Carry Forward
  // ---------------------------------------------------------------------------
  it('6. should promote student to 2027-28, preserving identity and isolating session financials', async () => {
    // Preview promotion
    const previewRes = await request(app).get(`/api/students/${studentId}/promotion-preview`)
    expect(previewRes.status).toBe(200)
    expect(previewRes.body.currentPendingDue).toBe(5000)
    expect(previewRes.body.suggestedStandard).toBe('Class 9')

    // Perform promotion
    const promoteRes = await request(app)
      .post(`/api/students/${studentId}/promote`)
      .send({
        targetSessionId: session2027Id,
        targetBranchId: branchId,
        targetStandard: 'Class 9',
        newRollNumber: `R-09-${Date.now().toString().slice(-4)}`,
        newTotalFees: 15000,
        carryForwardDue: true,
      })

    expect(promoteRes.status).toBe(201)
    expect(promoteRes.body.success).toBe(true)
    expect(promoteRes.body.admission).toBeDefined()
    expect(promoteRes.body.admission.studentId).toBe(studentId) // Identity preserved!
    expect(promoteRes.body.previousDueRecorded).toBe(5000)
    admission2027Id = promoteRes.body.admission.id

    // Check PreviousSessionDue record in database
    const dueRecord = await prisma.previousSessionDue.findFirst({
      where: { studentId, originalSessionId: session2026Id },
    })
    expect(dueRecord).toBeDefined()
    expect(dueRecord!.outstandingAmount).toBe(5000)
    expect(dueRecord!.collectedAmount).toBe(0)
    previousDueId = dueRecord!.id

    // Verify new session 2027-28 fee plan:
    // Agreed fee MUST be ₹15,000, NOT polluted to ₹20,000
    const plan2027 = await request(app).get(`/api/fees/plans/${admission2027Id}`)
    expect(plan2027.body.netPayable).toBe(15000)
    expect(plan2027.body.totalPaid).toBe(0) // Previous 7000 does NOT reduce new session
    expect(plan2027.body.totalPending).toBe(15000)
    expect(plan2027.body.previousDuesPending).toBe(5000)
    expect(plan2027.body.overallPendingAmount).toBe(20000)

    // Prevent duplicate carry-forward / duplicate promotion
    const dupPromote = await request(app)
      .post(`/api/students/${studentId}/promote`)
      .send({
        targetSessionId: session2027Id,
        targetBranchId: branchId,
        targetStandard: 'Class 9',
        newRollNumber: `R-09-DUP`,
        newTotalFees: 15000,
        carryForwardDue: true,
      })
    expect(dupPromote.status).toBe(409)
    expect(dupPromote.body.error).toMatch(/already admitted|already enrolled/i)
  })

  // ---------------------------------------------------------------------------
  // 7. Multi-Session History Inspection on Student Profile
  // ---------------------------------------------------------------------------
  it('7. should display all academic session admissions in one permanent student profile', async () => {
    const profileRes = await request(app).get(`/api/students/${studentId}`)
    expect(profileRes.status).toBe(200)

    const profile = profileRes.body
    expect(profile.fullName).toBe('Rahul Sharma')
    expect(profile.allAdmissions).toBeDefined()
    expect(profile.allAdmissions.length).toBe(2)

    // 2026-27 admission
    const adm26 = profile.allAdmissions.find((a: any) => a.sessionId === session2026Id)
    expect(adm26).toBeDefined()
    expect(adm26.standard).toBe('Class 8')
    expect(adm26.agreedFees).toBe(12000)
    expect(adm26.paidFees).toBe(7000)
    expect(adm26.pendingFees).toBe(5000)

    // 2027-28 admission
    const adm27 = profile.allAdmissions.find((a: any) => a.sessionId === session2027Id)
    expect(adm27).toBeDefined()
    expect(adm27.standard).toBe('Class 9')
    expect(adm27.agreedFees).toBe(15000)
    expect(adm27.paidFees).toBe(0)
    expect(adm27.pendingFees).toBe(15000)

    // Previous dues tracked
    expect(profile.previousSessionDues.length).toBe(1)
    expect(profile.previousSessionDues[0].outstandingAmount).toBe(5000)
    expect(profile.overallPendingAmount).toBe(20000)
  })

  // ---------------------------------------------------------------------------
  // 8. Payment against Previous Dues
  // ---------------------------------------------------------------------------
  it('8. should allow recording payments specifically against carried-forward previous dues', async () => {
    // Pay ₹3,000 toward the ₹5,000 previous session due
    const res = await request(app)
      .post('/api/fees/payments')
      .send({
        studentId,
        previousDueId,
        branchId,
        sessionId: session2027Id,
        amount: 3000,
        paymentMode: 'UPI',
        referenceNumber: 'PREV-DUE-PAY-01',
        notes: 'Partial payment of 2026-27 carried forward dues',
      })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)

    // Previous due should now have collectedAmount = 3000, remaining = 2000
    const updatedDue = await prisma.previousSessionDue.findUnique({
      where: { id: previousDueId },
    })
    expect(updatedDue!.collectedAmount).toBe(3000)

    // Profile check: current pending = 15000, previous pending = 2000, overall = 17000
    const profileRes = await request(app).get(`/api/students/${studentId}`)
    expect(profileRes.body.previousDuesPending).toBe(2000)
    expect(profileRes.body.overallPendingAmount).toBe(17000)
  })

  // ---------------------------------------------------------------------------
  // 9. Universal Filters across Students, Fees, and Dashboard
  // ---------------------------------------------------------------------------
  it('9. should return accurate filtered data for combinations of Branch, Session, and Standard', async () => {
    // A. All Branches + All Sessions
    const allRes = await request(app).get('/api/students?branchId=ALL&sessionId=ALL')
    expect(allRes.status).toBe(200)
    expect(Array.isArray(allRes.body)).toBe(true)
    const foundAll = allRes.body.find((s: any) => s.id === studentId)
    expect(foundAll).toBeDefined()

    // B. Specific Branch + Specific Session 2026-27
    const s26Res = await request(app).get(`/api/students?branchId=${branchId}&sessionId=${session2026Id}`)
    expect(s26Res.status).toBe(200)
    const studentS26 = s26Res.body.find((s: any) => s.id === studentId)
    expect(studentS26).toBeDefined()
    expect(studentS26.standard).toBe('Class 8')
    expect(studentS26.agreedFees).toBe(12000)
    expect(studentS26.paidFees).toBe(7000)
    expect(studentS26.pendingFees).toBe(5000)

    // C. Specific Branch + Specific Session 2027-28
    const s27Res = await request(app).get(`/api/students?branchId=${branchId}&sessionId=${session2027Id}`)
    expect(s27Res.status).toBe(200)
    const studentS27 = s27Res.body.find((s: any) => s.id === studentId)
    expect(studentS27).toBeDefined()
    expect(studentS27.standard).toBe('Class 9')
    expect(studentS27.agreedFees).toBe(15000)
    expect(studentS27.paidFees).toBe(0)
    expect(studentS27.pendingFees).toBe(15000)

    // D. Class Filter: Class 8 should show 2026 admission
    const c8Res = await request(app).get(`/api/students?branchId=${branchId}&sessionId=ALL&standard=Class 8`)
    expect(c8Res.status).toBe(200)
    const studentC8 = c8Res.body.find((s: any) => s.id === studentId)
    expect(studentC8).toBeDefined()
    expect(studentC8.standard).toBe('Class 8')

    // E. Blank or unselected filter returns all records without crash
    const blankRes = await request(app).get('/api/students')
    expect(blankRes.status).toBe(200)
    expect(Array.isArray(blankRes.body)).toBe(true)

    // F. Dashboard stats with universal filters
    const dashRes = await request(app).get(`/api/dashboard?branchId=${branchId}&sessionId=${session2027Id}`)
    expect(dashRes.status).toBe(200)
    expect(dashRes.body.session).toBeDefined()
    expect(dashRes.body.session.activeStudentsCount).toBeGreaterThanOrEqual(1)
  })

  // ---------------------------------------------------------------------------
  // 10. Multiple Students with Same Mobile Number (Siblings Support)
  // ---------------------------------------------------------------------------
  it('10. should allow multiple students (siblings) to share the exact same parent mobile number without restrictions', async () => {
    const sharedParentPhone = `9822${Math.floor(100000 + Math.random() * 900000)}`

    // Sibling 1: Aarav Deshmukh
    const res1 = await request(app)
      .post('/api/students')
      .send({
        fullName: 'Aarav Deshmukh',
        parentName: 'Sanjay Deshmukh',
        parentPhone: sharedParentPhone,
        studentPhone: '9988776611',
        branchId,
        sessionId: session2026Id,
        standard: 'Class 9',
        rollNumber: `SIB-A-${Date.now().toString().slice(-4)}`,
        totalFees: 18000,
        totalDiscount: 0,
      })
    expect(res1.status).toBe(201)
    expect(res1.body.student).toBeDefined()
    expect(res1.body.student.parentPhone).toBe(sharedParentPhone)
    const aaravId = res1.body.student.id

    // Sibling 2: Ananya Deshmukh (exact same parent phone number)
    const res2 = await request(app)
      .post('/api/students')
      .send({
        fullName: 'Ananya Deshmukh',
        parentName: 'Sanjay Deshmukh',
        parentPhone: sharedParentPhone,
        studentPhone: '9988776622',
        branchId,
        sessionId: session2026Id,
        standard: 'Class 11 Science',
        rollNumber: `SIB-B-${Date.now().toString().slice(-4)}`,
        totalFees: 35000,
        totalDiscount: 2000,
      })
    expect(res2.status).toBe(201)
    expect(res2.body.student).toBeDefined()
    expect(res2.body.student.parentPhone).toBe(sharedParentPhone)
    const ananyaId = res2.body.student.id

    // Verify distinct permanent identities
    expect(aaravId).not.toBe(ananyaId)

    // Sibling 3: Aditya Deshmukh (exact same parent phone and exact same branch/session)
    const res3 = await request(app)
      .post('/api/students')
      .send({
        fullName: 'Aditya Deshmukh',
        parentName: 'Sanjay Deshmukh',
        parentPhone: sharedParentPhone,
        branchId,
        sessionId: session2026Id,
        standard: 'Class 8',
        rollNumber: `SIB-C-${Date.now().toString().slice(-4)}`,
        totalFees: 15000,
      })
    expect(res3.status).toBe(201)
    expect(res3.body.student).toBeDefined()
    expect(res3.body.student.parentPhone).toBe(sharedParentPhone)
    const adityaId = res3.body.student.id

    // Search by the shared parent phone number
    const searchRes = await request(app).get(`/api/students?search=${sharedParentPhone}`)
    expect(searchRes.status).toBe(200)
    expect(Array.isArray(searchRes.body)).toBe(true)

    // All 3 siblings must be returned by the search!
    const foundIds = searchRes.body.map((s: any) => s.id)
    expect(foundIds).toContain(aaravId)
    expect(foundIds).toContain(ananyaId)
    expect(foundIds).toContain(adityaId)

    // Pay fee for Sibling 1; verify Sibling 2 & 3 fees remain independent
    const payRes = await request(app)
      .post('/api/fees/payments')
      .send({
        studentId: aaravId,
        admissionId: res1.body.admission.id,
        branchId,
        sessionId: session2026Id,
        amount: 5000,
        paymentMode: 'UPI',
      })
    expect(payRes.status).toBe(201)

    // Aarav paid 5000, pending 13000
    const aaravPlan = await request(app).get(`/api/fees/plans/${res1.body.admission.id}`)
    expect(aaravPlan.body.totalPaid).toBe(5000)
    expect(aaravPlan.body.totalPending).toBe(13000)

    // Ananya paid 0, pending 35000
    const ananyaPlan = await request(app).get(`/api/fees/plans/${res2.body.admission.id}`)
    expect(ananyaPlan.body.totalPaid).toBe(0)
    expect(ananyaPlan.body.totalPending).toBe(35000)
  })
})

