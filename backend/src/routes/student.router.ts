import { Router, Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { prisma } from '../services/db'
import { storagePaths } from '../config/index'

export const studentRouter = Router()

// Configure Multer for student photographs
const photoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, storagePaths.photosDir)
  },
  filename: (req, file, cb) => {
    const studentId = String(req.params.id || 'new')
    const ext = path.extname(file.originalname) || '.jpg'
    cb(null, `photo-${studentId}-${Date.now()}${ext}`)
  },
})

const photoUpload = multer({
  storage: photoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Only image files (JPEG, PNG, WebP) are allowed'))
    }
  },
})

// Helper function to compute installment status
export function calculateInstallmentStatus(amountDue: number, amountPaid: number, dueDate?: Date | string | null): string {
  const due = Number(amountDue) || 0
  const paid = Number(amountPaid) || 0
  const balance = Math.max(0, due - paid)

  // STRICT RULE: If fees/balance is cleared or 0, status is PAID and NEVER OVERDUE
  if (balance <= 0) {
    return 'PAID'
  }
  if (paid > 0 && paid < due) {
    return 'PARTIAL'
  }

  // If no due date provided
  if (!dueDate) {
    return 'UPCOMING'
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dDate = new Date(dueDate)
  if (isNaN(dDate.getTime())) {
    return 'UPCOMING'
  }
  dDate.setHours(0, 0, 0, 0)

  if (today.getTime() > dDate.getTime()) {
    return 'OVERDUE'
  }
  if (today.getTime() === dDate.getTime()) {
    return 'DUE'
  }
  return 'UPCOMING'
}

// GET all students with search, standard, branch and session universal filters
studentRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { branchId, sessionId, standard, search, isActive } = req.query

    // Build admission filter
    const admissionWhere: any = {}

    // Universal active filter
    if (isActive && isActive !== 'ALL') {
      admissionWhere.isActive = isActive === 'true'
    }

    // Universal branch filter: blank or "ALL" means all branches
    if (branchId && branchId !== 'ALL') {
      admissionWhere.branchId = String(branchId)
    }

    // Universal session filter: blank or "ALL" means all sessions
    if (sessionId && sessionId !== 'ALL') {
      admissionWhere.sessionId = String(sessionId)
    }

    // Universal standard filter: blank or "ALL" means all standards
    if (standard && standard !== 'ALL') {
      admissionWhere.standard = String(standard)
    }

    // Search query on student bio, roll number, or course/standard
    if (search && String(search).trim()) {
      const q = String(search).trim()
      admissionWhere.OR = [
        { rollNumber: { contains: q } },
        { student: { fullName: { contains: q } } },
        { student: { parentPhone: { contains: q } } },
        { student: { studentPhone: { contains: q } } },
        { student: { studentCode: { contains: q } } },
        { standard: { contains: q } },
      ]
    }

    const admissions = await prisma.studentAdmission.findMany({
      where: admissionWhere,
      include: {
        student: {
          include: {
            previousSessionDues: true,
            admissions: {
              include: {
                feePlan: true,
                payments: {
                  where: { isReversed: false },
                },
              },
            },
          },
        },
        branch: true,
        session: true,
        feePlan: {
          include: {
            installments: {
              include: {
                allocations: {
                  include: { payment: true },
                },
              },
            },
          },
        },
        payments: {
          where: { isReversed: false },
          orderBy: { paymentDate: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const summary = admissions.map((adm) => {
      const student = adm.student
      const feePlan = adm.feePlan
      const agreedFees = feePlan?.totalFees || 0
      const totalDiscount = feePlan?.totalDiscount || 0
      const totalFees = feePlan?.netPayable ?? feePlan?.totalFees ?? 0

      // Paid fees strictly for this admission's session
      const paidFees = (adm.payments || []).reduce((sum, p) => sum + p.totalAmount, 0)
      const pendingFees = Math.max(0, totalFees - paidFees)

      // Reconcile carried-forward previous session dues against original session payments
      const previousDues = student.previousSessionDues || []
      const carriedForwardSessionIds = new Set<string>()
      let prevDuesPending = 0

      for (const pd of previousDues) {
        carriedForwardSessionIds.add(pd.originalSessionId)
        const origAdm = student.admissions.find((a) => a.sessionId === pd.originalSessionId)
        if (origAdm && origAdm.feePlan) {
          const origTotal = origAdm.feePlan.netPayable ?? origAdm.feePlan.totalFees ?? pd.outstandingAmount
          const origPaid = (origAdm.payments || []).reduce((sum, p) => sum + p.totalAmount, 0)
          prevDuesPending += Math.max(0, origTotal - Math.max(origPaid, pd.collectedAmount || 0))
        } else {
          prevDuesPending += Math.max(0, pd.outstandingAmount - (pd.collectedAmount || 0))
        }
      }

      // Calculate overall pending amount across all admissions of this permanent student
      let allAdmissionsPending = 0
      for (const a of student.admissions) {
        // Skip inactive/deactivated admissions so cancelled admissions do not skew active dues
        if (!a.isActive) {
          continue
        }
        if (carriedForwardSessionIds.has(a.sessionId)) {
          continue
        }
        const aTotal = a.feePlan?.netPayable ?? a.feePlan?.totalFees ?? 0
        const aPaid = (a.payments || []).reduce((sum, p) => sum + p.totalAmount, 0)
        allAdmissionsPending += Math.max(0, aTotal - aPaid)
      }

      const overallPendingAmount = allAdmissionsPending + prevDuesPending

      // Next Due Date & Status calculation
      let nextDueDate: string | null = null
      let dueStatus = 'PAID'
      if (pendingFees > 0 && feePlan?.installments && feePlan.installments.length > 0) {
        // Find earliest unpaid installment
        const pendingInst = feePlan.installments.find((inst) => {
          const instPaid = (inst.allocations || []).reduce(
            (sum: number, a: any) => (a.payment?.isReversed ? sum : sum + a.allocatedAmount),
            0
          )
          return inst.amountDue > instPaid
        }) || feePlan.installments[0]

        if (pendingInst) {
          const instPaid = (pendingInst.allocations || []).reduce(
            (sum: number, a: any) => (a.payment?.isReversed ? sum : sum + a.allocatedAmount),
            0
          )
          nextDueDate = pendingInst.dueDate.toISOString()
          dueStatus = calculateInstallmentStatus(pendingInst.amountDue, instPaid, pendingInst.dueDate)
        }
      } else {
        // All fees cleared!
        nextDueDate = null
        dueStatus = 'PAID'
      }

      return {
        id: student.id,
        admissionId: adm.id,
        studentCode: student.studentCode,
        fullName: student.fullName,
        photoUrl: student.photoUrl,
        rollNumber: adm.rollNumber,
        standard: adm.standard,
        branchId: adm.branchId,
        branchName: adm.branch.name,
        branchCode: adm.branch.code,
        sessionId: adm.sessionId,
        sessionName: adm.session.name,
        parentPhone: student.parentPhone,
        studentPhone: student.studentPhone,
        address: student.address,
        isActive: adm.isActive,
        admissionDate: adm.admissionDate.toISOString(),
        agreedFees,
        totalDiscount,
        totalFees,
        paidFees,
        pendingFees,
        previousDuesPending: prevDuesPending,
        overallPendingAmount,
        dueDate: nextDueDate,
        nextDueDate,
        dueStatus,
        createdAt: adm.createdAt.toISOString(),
      }
    })

    res.json(summary)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch students', details: String(error) })
  }
})

// GET detailed student profile by ID
studentRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    const { admissionId, sessionId, branchId } = req.query

    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        admissions: {
          include: {
            branch: true,
            session: true,
            feePlan: {
              include: {
                discounts: true,
                installments: {
                  include: {
                    allocations: {
                      include: {
                        payment: true,
                      },
                    },
                  },
                  orderBy: { installmentNo: 'asc' },
                },
              },
            },
            payments: {
              where: { isReversed: false },
              orderBy: { paymentDate: 'desc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        payments: {
          include: {
            branch: true,
            session: true,
            admission: true,
            allocations: {
              include: {
                installment: true,
              },
            },
          },
          orderBy: { paymentDate: 'desc' },
        },
        previousSessionDues: {
          include: {
            originalSession: true,
            currentSession: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!student) {
      return res.status(404).json({ error: 'Student not found' })
    }

    // Check branch compatibility
    let isEnrolledInBranch = true
    if (branchId && branchId !== 'ALL') {
      isEnrolledInBranch = student.admissions.some((a) => a.branchId === String(branchId))
    }

    // Resolve target admission: either specifically requested by admissionId, or matching sessionId, or first active, or latest
    let currentAdmission: any = null
    let isEnrolledInSession = true

    if (admissionId) {
      const match = student.admissions.find((a) => a.id === String(admissionId))
      if (match) currentAdmission = match
    } else if (sessionId && sessionId !== 'ALL') {
      const match = student.admissions.find((a) => a.sessionId === String(sessionId) && a.isActive)
        || student.admissions.find((a) => a.sessionId === String(sessionId))
      if (match) {
        currentAdmission = match
      } else {
        isEnrolledInSession = false
        currentAdmission = null
      }
    } else {
      const active = student.admissions.find((a) => a.isActive)
      currentAdmission = active || student.admissions[0] || null
    }

    // If branchId is specified, ensure currentAdmission is from that branch if possible
    if (branchId && branchId !== 'ALL' && currentAdmission && currentAdmission.branchId !== String(branchId)) {
      const branchMatch = student.admissions.find(
        (a) => a.branchId === String(branchId) && (!sessionId || sessionId === 'ALL' || a.sessionId === String(sessionId))
      )
      if (branchMatch) {
        currentAdmission = branchMatch
      }
    }

    const feePlan = currentAdmission?.feePlan || null
    const totalFees = feePlan?.totalFees || 0
    const totalDiscount = feePlan?.totalDiscount || 0
    const netPayable = feePlan?.netPayable || totalFees - totalDiscount

    // Authoritative session paid fees: only payments for this admission
    const sessionPayments = currentAdmission?.payments || []
    const totalPaid = sessionPayments.reduce((acc: number, p: any) => acc + p.totalAmount, 0)
    const totalPending = Math.max(0, netPayable - totalPaid)
    const isFeesCleared = totalPending <= 0

    // Compute installments with status for selected admission
    const installmentsWithStatus = feePlan?.installments.map((inst: any) => {
      const paid = inst.allocations.reduce((sum: number, alloc: any) => {
        return alloc.payment.isReversed ? sum : sum + alloc.allocatedAmount
      }, 0)

      const balanceRemaining = Math.max(0, inst.amountDue - paid)
      const isCleared = balanceRemaining <= 0 || isFeesCleared
      const status = isCleared ? 'PAID' : calculateInstallmentStatus(inst.amountDue, paid, inst.dueDate)

      return {
        id: inst.id,
        installmentNo: inst.installmentNo,
        label: inst.label,
        dueDate: isCleared ? null : inst.dueDate.toISOString(),
        rawDueDate: inst.dueDate.toISOString(),
        amountDue: inst.amountDue,
        amountPaid: paid,
        balanceRemaining,
        status,
      }
    }) || []

    // Reconcile previous session dues against original session payments
    const previousDues = student.previousSessionDues || []
    const carriedForwardSessionIds = new Set<string>()

    const reconciledPreviousDues = previousDues.map((d: any) => {
      carriedForwardSessionIds.add(d.originalSessionId)
      const origAdm = student.admissions.find((a: any) => a.sessionId === d.originalSessionId)
      let balanceRemaining = Math.max(0, d.outstandingAmount - (d.collectedAmount || 0))
      let collectedAmount = d.collectedAmount || 0

      if (origAdm && origAdm.feePlan) {
        const origTotal = origAdm.feePlan.netPayable ?? origAdm.feePlan.totalFees ?? d.outstandingAmount
        const origPaid = (origAdm.payments || []).filter((p: any) => !p.isReversed).reduce((sum: number, p: any) => sum + p.totalAmount, 0)
        const pdDirectPaid = (student.payments || []).filter((p: any) => p.previousDueId === d.id && !p.isReversed).reduce((sum: number, p: any) => sum + p.totalAmount, 0)
        const totalPaidForOrig = Math.max(origPaid, pdDirectPaid, d.collectedAmount || 0)

        balanceRemaining = Math.max(0, origTotal - totalPaidForOrig)
        collectedAmount = Math.min(d.outstandingAmount, Math.max(0, d.outstandingAmount - balanceRemaining))
      }

      const isCleared = balanceRemaining <= 0

      // Sync database record in background if divergent
      if (d.collectedAmount !== collectedAmount) {
        prisma.previousSessionDue.update({
          where: { id: d.id },
          data: { collectedAmount },
        }).catch(() => {})
      }

      return {
        id: d.id,
        originalSessionId: d.originalSessionId,
        currentSessionId: d.currentSessionId,
        outstandingAmount: d.outstandingAmount,
        collectedAmount,
        balanceRemaining,
        isCleared,
        description: d.description,
        originalSessionName: d.originalSession?.name,
        currentSessionName: d.currentSession?.name,
        createdAt: d.createdAt.toISOString(),
      }
    })

    const previousDuesPending = reconciledPreviousDues.reduce(
      (sum: number, d: any) => sum + (d.isCleared ? 0 : d.balanceRemaining),
      0
    )

    // Overall pending across all admissions (strictly active admissions)
    let allAdmissionsPending = 0
    for (const a of student.admissions) {
      // Skip inactive/deactivated admissions
      if (!a.isActive) {
        continue
      }
      if (carriedForwardSessionIds.has(a.sessionId)) {
        continue
      }
      const aNet = a.feePlan?.netPayable ?? a.feePlan?.totalFees ?? 0
      const aPaid = (a.payments || []).filter((p: any) => !p.isReversed).reduce((sum: number, p: any) => sum + p.totalAmount, 0)
      allAdmissionsPending += Math.max(0, aNet - aPaid)
    }
    const overallPendingAmount = allAdmissionsPending + previousDuesPending

    let nextDueDate: string | null = null
    let nextDueStatus = 'PAID'
    if (!isFeesCleared && feePlan?.installments && feePlan.installments.length > 0) {
      const pendingInst = feePlan.installments.find((inst: any) => {
        const paid = inst.allocations.reduce((sum: number, alloc: any) => (alloc.payment.isReversed ? sum : sum + alloc.allocatedAmount), 0)
        return inst.amountDue > paid
      }) || feePlan.installments[0]

      if (pendingInst) {
        const paid = pendingInst.allocations.reduce((sum: number, alloc: any) => (alloc.payment.isReversed ? sum : sum + alloc.allocatedAmount), 0)
        nextDueDate = pendingInst.dueDate.toISOString()
        nextDueStatus = calculateInstallmentStatus(pendingInst.amountDue, paid, pendingInst.dueDate)
      }
    }

    res.json({
      id: student.id,
      studentCode: student.studentCode,
      fullName: student.fullName,
      photoUrl: student.photoUrl,
      parentPhone: student.parentPhone,
      studentPhone: student.studentPhone,
      address: student.address,
      dateOfBirth: student.dateOfBirth ? student.dateOfBirth.toISOString() : null,
      createdAt: student.createdAt.toISOString(),
      currentAdmission: currentAdmission
        ? {
            id: currentAdmission.id,
            rollNumber: currentAdmission.rollNumber,
            standard: currentAdmission.standard,
            admissionDate: currentAdmission.admissionDate.toISOString(),
            isActive: currentAdmission.isActive,
            branch: currentAdmission.branch,
            session: currentAdmission.session,
          }
        : null,
      feeSummary: {
        totalFees,
        totalDiscount,
        netPayable,
        totalPaid,
        totalPending,
        previousDuesPending,
        overallPendingAmount,
      },
      isEnrolledInSession,
      isEnrolledInBranch,
      previousDuesPending,
      overallPendingAmount,
      dueDate: nextDueDate,
      nextDueDate,
      dueStatus: nextDueStatus,
      installments: installmentsWithStatus,
      payments: student.payments.map((p) => ({
        id: p.id,
        receiptNumber: p.receiptNumber,
        totalAmount: p.totalAmount,
        paymentDate: p.paymentDate.toISOString(),
        paymentMode: p.paymentMode,
        referenceNumber: p.referenceNumber,
        notes: p.notes,
        isReversed: p.isReversed,
        reversalReason: p.reversalReason,
        reversedAt: p.reversedAt ? p.reversedAt.toISOString() : null,
        sessionName: p.session?.name,
        branchId: p.branch?.id || p.branchId,
        branchName: p.branch?.name,
        branchCode: p.branch?.code,
        branchAddress: p.branch?.address,
        branchPhone: p.branch?.phone,
        branchLogoUrl: p.branch?.logoUrl,
        standard: p.admission?.standard,
        allocations: p.allocations.map((a) => ({
          id: a.id,
          allocatedAmount: a.allocatedAmount,
          installmentLabel: a.installment.label,
        })),
      })),
      allAdmissions: student.admissions.map((a) => {
        const aNet = a.feePlan?.netPayable ?? a.feePlan?.totalFees ?? 0
        const aPaid = (a.payments || []).reduce((s, p) => s + p.totalAmount, 0)
        return {
          id: a.id,
          rollNumber: a.rollNumber,
          standard: a.standard,
          branchName: a.branch.name,
          branchId: a.branchId,
          sessionName: a.session.name,
          sessionId: a.sessionId,
          isActive: a.isActive,
          admissionDate: a.admissionDate.toISOString(),
          totalFees: a.feePlan?.totalFees || 0,
          totalDiscount: a.feePlan?.totalDiscount || 0,
          agreedFees: aNet,
          netPayable: aNet,
          paidFees: aPaid,
          pendingFees: Math.max(0, aNet - aPaid),
        }
      }),
      previousSessionDues: reconciledPreviousDues,
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch student profile', details: String(error) })
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
      dueDate,
      customInstallments, // optional custom installment schedule array
    } = req.body

    if (!fullName || !rollNumber || !parentPhone) {
      return res.status(400).json({ error: 'Full name, roll number, and parent phone are required' })
    }

    // Resolve branch
    let targetBranchId = branchId
    if (!targetBranchId || targetBranchId === 'ALL') {
      const defaultBranch = await prisma.branch.findFirst({ where: { isActive: true } })
      targetBranchId = defaultBranch?.id
    }
    // Verify branch actually exists in DB
    let branchRecord = targetBranchId ? await prisma.branch.findUnique({ where: { id: targetBranchId } }) : null
    if (!branchRecord) {
      const defaultBranch = await prisma.branch.findFirst({ where: { isActive: true } })
      if (!defaultBranch) {
        return res.status(400).json({ error: 'No active branch available' })
      }
      targetBranchId = defaultBranch.id
    }

    // Resolve session
    let targetSessionId = sessionId
    if (!targetSessionId || targetSessionId === 'ALL') {
      const currentSession = await prisma.academicSession.findFirst({ where: { isCurrent: true } })
      targetSessionId = currentSession?.id
    }
    if (!targetSessionId || targetSessionId === 'ALL') {
      const fallbackSession = await prisma.academicSession.findFirst()
      targetSessionId = fallbackSession?.id
    }
    // Verify session actually exists in DB
    let sessionRecord = targetSessionId ? await prisma.academicSession.findUnique({ where: { id: targetSessionId } }) : null
    if (!sessionRecord) {
      const currentSession = (await prisma.academicSession.findFirst({ where: { isCurrent: true } })) || (await prisma.academicSession.findFirst())
      if (!currentSession) {
        return res.status(400).json({ error: 'No academic session available' })
      }
      targetSessionId = currentSession.id
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

    // Transaction to create student, admission, fee plan, and installments
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

      const now = new Date()
      // If dueDate is specified, use it; otherwise default to 30 days ahead so new students aren't instantly overdue
      const parsedDueDate = dueDate && !isNaN(new Date(dueDate).getTime())
        ? new Date(dueDate)
        : new Date(Date.now() + 30 * 24 * 3600 * 1000)

      // If custom installments provided, use them; otherwise create 1 flexible open installment
      if (Array.isArray(customInstallments) && customInstallments.length > 0) {
        await tx.installment.createMany({
          data: customInstallments.map((inst: any, idx: number) => ({
            feePlanId: feePlan.id,
            installmentNo: idx + 1,
            label: inst.label || `Installment ${idx + 1}`,
            dueDate: new Date(inst.dueDate || parsedDueDate),
            amountDue: Number(inst.amountDue) || 0,
          })),
        })
      } else {
        // Create 1 open flexible milestone for the session fee
        await tx.installment.create({
          data: {
            feePlanId: feePlan.id,
            installmentNo: 1,
            label: 'Session Fee',
            dueDate: parsedDueDate,
            amountDue: feesNumber,
          },
        })
      }

      return { student, admission, feePlan }
    })

    res.status(201).json(result)
  } catch (error: any) {
    console.error('[Student Admission Error]:', error)
    res.status(500).json({ error: error.message || 'Failed to admit student', details: String(error) })
  }
})

// PUT update student bio and current admission details
studentRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    const { fullName, parentPhone, studentPhone, address, dateOfBirth, standard, rollNumber } = req.body

    const student = await prisma.student.findUnique({
      where: { id },
      include: { admissions: { where: { isActive: true }, take: 1 } },
    })

    if (!student) {
      return res.status(404).json({ error: 'Student not found' })
    }

    const currentAdmission = student.admissions[0]

    // If rollNumber changed, check for collision in the branch/session
    if (rollNumber && currentAdmission && rollNumber !== currentAdmission.rollNumber) {
      const collision = await prisma.studentAdmission.findFirst({
        where: {
          branchId: currentAdmission.branchId,
          sessionId: currentAdmission.sessionId,
          rollNumber,
          NOT: { id: currentAdmission.id },
        },
      })
      if (collision) {
        return res.status(409).json({ error: `Roll number ${rollNumber} is already taken in this branch & session` })
      }
    }

    // Transaction to update student and admission
    const updated = await prisma.$transaction(async (tx) => {
      const updatedStudent = await tx.student.update({
        where: { id },
        data: {
          fullName: fullName !== undefined ? fullName : undefined,
          parentPhone: parentPhone !== undefined ? parentPhone : undefined,
          studentPhone: studentPhone !== undefined ? studentPhone || null : undefined,
          address: address !== undefined ? address || null : undefined,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        },
      })

      if (currentAdmission && (standard || rollNumber)) {
        await tx.studentAdmission.update({
          where: { id: currentAdmission.id },
          data: {
            standard: standard || undefined,
            rollNumber: rollNumber || undefined,
          },
        })
      }

      return updatedStudent
    })

    res.json(updated)
  } catch (error) {
    res.status(500).json({ error: 'Failed to update student profile', details: String(error) })
  }
})

// PATCH toggle student active / archived status
studentRouter.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    const { isActive } = req.body

    const student = await prisma.student.findUnique({
      where: { id },
      include: { admissions: true },
    })

    if (!student) {
      return res.status(404).json({ error: 'Student not found' })
    }

    // Toggle active flag on admissions without deleting financial records
    await prisma.studentAdmission.updateMany({
      where: { studentId: id },
      data: { isActive: Boolean(isActive) },
    })

    res.json({ success: true, studentId: id, isActive: Boolean(isActive) })
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle student archive status', details: String(error) })
  }
})

// POST upload student photograph
studentRouter.post('/:id/photo', photoUpload.single('photo'), async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)

    if (!req.file) {
      return res.status(400).json({ error: 'No photograph file was provided' })
    }

    const student = await prisma.student.findUnique({
      where: { id },
    })

    if (!student) {
      // Remove uploaded file if student does not exist
      fs.unlinkSync(req.file.path)
      return res.status(404).json({ error: 'Student not found' })
    }

    // Delete old photo if exists
    if (student.photoUrl) {
      const oldFileName = path.basename(student.photoUrl)
      const oldFilePath = path.join(storagePaths.photosDir, oldFileName)
      if (fs.existsSync(oldFilePath)) {
        try {
          fs.unlinkSync(oldFilePath)
        } catch {
          // ignore unlink error
        }
      }
    }

    const photoUrl = `/api/uploads/photos/${req.file.filename}`

    const updated = await prisma.student.update({
      where: { id },
      data: { photoUrl },
    })

    res.json({
      success: true,
      studentId: id,
      photoUrl: updated.photoUrl,
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload student photograph', details: String(error) })
  }
})

// DELETE remove student photo
studentRouter.delete('/:id/photo', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)

    const student = await prisma.student.findUnique({
      where: { id },
    })

    if (!student) {
      return res.status(404).json({ error: 'Student not found' })
    }

    if (student.photoUrl) {
      const oldFileName = path.basename(student.photoUrl)
      const oldFilePath = path.join(storagePaths.photosDir, oldFileName)
      if (fs.existsSync(oldFilePath)) {
        try {
          fs.unlinkSync(oldFilePath)
        } catch {
          // ignore
        }
      }
    }

    const updated = await prisma.student.update({
      where: { id },
      data: { photoUrl: null },
    })

    res.json({ success: true, studentId: id, photoUrl: updated.photoUrl })
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete student photo', details: String(error) })
  }
})

// DELETE permanently remove student and all associated records (admissions, fee plans, installments, payments)
studentRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)

    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        admissions: {
          include: {
            feePlan: true,
          },
        },
        payments: true,
        previousSessionDues: true,
      },
    })

    if (!student) {
      return res.status(404).json({ error: 'Student not found' })
    }

    const paymentIds = student.payments.map((p) => p.id)
    const admissionIds = student.admissions.map((a) => a.id)
    const feePlanIds = student.admissions
      .map((a) => a.feePlan?.id)
      .filter(Boolean) as string[]
    const dueIds = student.previousSessionDues.map((d) => d.id)

    // Execute atomic cascading deletion inside a transaction
    await prisma.$transaction(async (tx) => {
      // 1. Delete payment allocations for all payments associated with this student
      if (paymentIds.length > 0) {
        await tx.paymentAllocation.deleteMany({
          where: { paymentId: { in: paymentIds } },
        })
      }

      // 2. Delete all payment records for this student
      await tx.payment.deleteMany({
        where: { studentId: id },
      })

      // 3. Delete installments, discounts, and fee plans for this student's admissions
      if (feePlanIds.length > 0) {
        await tx.installment.deleteMany({
          where: { feePlanId: { in: feePlanIds } },
        })
        await tx.feeDiscount.deleteMany({
          where: { feePlanId: { in: feePlanIds } },
        })
        await tx.feePlan.deleteMany({
          where: { id: { in: feePlanIds } },
        })
      }

      // 4. Delete all admissions for this student
      if (admissionIds.length > 0) {
        await tx.studentAdmission.deleteMany({
          where: { studentId: id },
        })
      }

      // 5. Delete all previous session dues for this student
      if (dueIds.length > 0) {
        await tx.previousSessionDue.deleteMany({
          where: { studentId: id },
        })
      }

      // 6. Delete the student profile
      await tx.student.delete({
        where: { id },
      })
    })

    // Clean up physical photo file if exists on disk
    if (student.photoUrl) {
      const oldFileName = path.basename(student.photoUrl)
      const oldFilePath = path.join(storagePaths.photosDir, oldFileName)
      if (fs.existsSync(oldFilePath)) {
        try {
          fs.unlinkSync(oldFilePath)
        } catch {
          // ignore unlink error
        }
      }
    }

    res.json({
      success: true,
      message: `Student "${student.fullName}" and all associated fee records deleted permanently.`,
      deletedStudent: {
        id: student.id,
        fullName: student.fullName,
        studentCode: student.studentCode,
      },
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete student and linked records', details: String(error) })
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

          // Filter out reversed payments
          const alreadyPaid = inst.allocations.reduce((sum, a) => {
            return a.payment.isReversed ? sum : sum + a.allocatedAmount
          }, 0)

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

// GET financial statistics with universal filters (backend authoritative calculation)
studentRouter.get('/stats/financial', async (req: Request, res: Response) => {
  try {
    const { branchId, sessionId, standard } = req.query

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

// Suggest next standard helper
export function suggestNextStandard(standard: string): string {
  const map: Record<string, string> = {
    'Class 8': 'Class 9',
    'Class 9': 'Class 10',
    'Class 10': 'Class 11 Science',
    'Class 11 Science': 'Class 12 Science',
    'Class 11 Commerce': 'Class 12 Commerce',
    'Class 11': 'Class 12',
    'MHT-CET / JEE Foundation': 'MHT-CET / JEE Target Batch',
  }
  return map[standard] || standard
}

// GET preview for student promotion
studentRouter.get('/:id/promotion-preview', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    const { targetSessionId } = req.query

    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        admissions: {
          include: {
            branch: true,
            session: true,
            feePlan: true,
            payments: {
              where: { isReversed: false },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!student || student.admissions.length === 0) {
      return res.status(404).json({ error: 'Student or admission record not found' })
    }

    const currentAdmission = student.admissions[0]
    const currentFeePlan = currentAdmission.feePlan
    const totalFees = currentFeePlan?.netPayable || currentFeePlan?.totalFees || 0
    const totalPaid = (currentAdmission.payments || []).reduce((acc, p) => acc + p.totalAmount, 0)
    const currentPendingDue = Math.max(0, totalFees - totalPaid)

    const suggestedStandard = suggestNextStandard(currentAdmission.standard)

    // Check if student already promoted to target session
    let isAlreadyPromoted = false
    if (targetSessionId) {
      const existingInTarget = student.admissions.find((a) => a.sessionId === String(targetSessionId))
      if (existingInTarget) isAlreadyPromoted = true
    }

    // Auto-generate suggested roll number for next session
    const suggestedRoll = `${currentAdmission.rollNumber}-N`

    res.json({
      studentId: student.id,
      fullName: student.fullName,
      studentCode: student.studentCode,
      currentBranch: currentAdmission.branch,
      currentSession: currentAdmission.session,
      currentStandard: currentAdmission.standard,
      currentRollNumber: currentAdmission.rollNumber,
      currentPendingDue,
      suggestedStandard,
      suggestedRoll,
      suggestedFees: totalFees > 0 ? totalFees : 30000,
      isAlreadyPromoted,
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate promotion preview', details: String(error) })
  }
})

// POST promote a student to next academic session
studentRouter.post('/:id/promote', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    const {
      targetSessionId,
      targetBranchId,
      targetStandard,
      newRollNumber,
      newTotalFees,
      carryForwardDue = true,
      dueNotes,
    } = req.body

    if (!targetSessionId || !targetStandard || !newRollNumber) {
      return res.status(400).json({
        error: 'Target session, target standard, and new roll number are required for promotion',
      })
    }

    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        admissions: {
          include: {
            session: true,
            branch: true,
            feePlan: true,
            payments: {
              where: { isReversed: false },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!student || student.admissions.length === 0) {
      return res.status(404).json({ error: 'Student or previous admission not found' })
    }

    const previousAdmission = student.admissions[0]
    const branchId = targetBranchId || previousAdmission.branchId

    // Verify student is not already admitted in target session
    const existingInTarget = await prisma.studentAdmission.findFirst({
      where: {
        studentId: id,
        sessionId: targetSessionId,
      },
    })
    if (existingInTarget) {
      return res.status(409).json({
        error: `Student ${student.fullName} is already admitted in the selected academic session.`,
      })
    }

    // Verify roll number uniqueness in target branch and session
    const rollCollision = await prisma.studentAdmission.findFirst({
      where: {
        branchId,
        sessionId: targetSessionId,
        rollNumber: String(newRollNumber).trim(),
      },
    })
    if (rollCollision) {
      return res.status(409).json({
        error: `Roll number ${newRollNumber} is already in use in the target branch and session.`,
      })
    }

    // Calculate pending dues strictly from previous session
    const prevPlanFees = previousAdmission.feePlan?.netPayable || previousAdmission.feePlan?.totalFees || 0
    const prevPaid = (previousAdmission.payments || []).reduce((sum, p) => sum + p.totalAmount, 0)
    const prevPendingDue = Math.max(0, prevPlanFees - prevPaid)

    const numFees = Number(newTotalFees) || 0

    // Transaction to create new admission, fee plan, and previous session due record
    const result = await prisma.$transaction(async (tx) => {
      // 1. If previous dues exist and carry forward is enabled, record PreviousSessionDue
      // Check for duplicate to prevent carrying forward the same balance multiple times
      let dueRecord = null
      if (carryForwardDue && prevPendingDue > 0) {
        const existingDue = await tx.previousSessionDue.findFirst({
          where: {
            studentId: id,
            originalSessionId: previousAdmission.sessionId,
            currentSessionId: targetSessionId,
          },
        })
        if (!existingDue) {
          dueRecord = await tx.previousSessionDue.create({
            data: {
              studentId: id,
              originalSessionId: previousAdmission.sessionId,
              currentSessionId: targetSessionId,
              outstandingAmount: prevPendingDue,
              description:
                dueNotes ||
                `Outstanding fee balance carried forward from ${previousAdmission.session.name} (${previousAdmission.standard})`,
            },
          })
        }
      }

      // 2. Create new StudentAdmission in target session
      const newAdmission = await tx.studentAdmission.create({
        data: {
          studentId: id,
          branchId,
          sessionId: targetSessionId,
          rollNumber: String(newRollNumber).trim(),
          standard: String(targetStandard).trim(),
          admissionDate: new Date(),
          isActive: true,
        },
        include: {
          session: true,
          branch: true,
        },
      })

      // 3. Create fresh FeePlan for target session (never polluted with previous session dues)
      const newFeePlan = await tx.feePlan.create({
        data: {
          admissionId: newAdmission.id,
          sessionId: targetSessionId,
          totalFees: numFees,
          totalDiscount: 0,
          netPayable: numFees,
        },
      })

      // 4. Create flexible open installment for new session
      const now = new Date()
      await tx.installment.create({
        data: {
          feePlanId: newFeePlan.id,
          installmentNo: 1,
          label: 'Session Fee',
          dueDate: now,
          amountDue: numFees,
        },
      })

      return {
        newAdmission,
        newFeePlan,
        dueRecord,
      }
    })

    res.status(201).json({
      success: true,
      message: `Successfully promoted ${student.fullName} to ${result.newAdmission.standard} for session ${result.newAdmission.session.name}!`,
      admission: result.newAdmission,
      previousDueRecorded: result.dueRecord ? prevPendingDue : 0,
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to promote student' })
  }
})

// POST batch promote students to next session
studentRouter.post('/batch-promote', async (req: Request, res: Response) => {
  try {
    const {
      studentIds,
      targetSessionId,
      targetStandard,
      targetBranchId,
      defaultTotalFees,
      carryForwardDues = true,
    } = req.body

    if (!Array.isArray(studentIds) || studentIds.length === 0 || !targetSessionId || !targetStandard) {
      return res.status(400).json({
        error: 'Student IDs array, target session, and target standard are required for batch promotion',
      })
    }

    const numFees = Number(defaultTotalFees) || 0
    const promotedStudents: string[] = []
    const skippedStudents: Array<{ id: string; name: string; reason: string }> = []

    for (const sId of studentIds) {
      const student = await prisma.student.findUnique({
        where: { id: sId },
        include: {
          admissions: {
            include: {
              session: true,
              feePlan: true,
              payments: { where: { isReversed: false } },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      })

      if (!student || student.admissions.length === 0) {
        skippedStudents.push({ id: sId, name: sId, reason: 'No student record found' })
        continue
      }

      // Check if already in target session
      const alreadyInTarget = student.admissions.find((a) => a.sessionId === targetSessionId)
      if (alreadyInTarget) {
        skippedStudents.push({
          id: sId,
          name: student.fullName,
          reason: 'Already admitted in target session',
        })
        continue
      }

      const prevAdm = student.admissions[0]
      const branchId = targetBranchId || prevAdm.branchId

      // Generate unique roll number
      const baseRoll = `${prevAdm.rollNumber}`
      let newRoll = baseRoll
      const collision = await prisma.studentAdmission.findFirst({
        where: { branchId, sessionId: targetSessionId, rollNumber: newRoll },
      })
      if (collision) {
        newRoll = `${baseRoll}-${Date.now().toString().slice(-3)}`
      }

      // Calculate dues strictly from previous session
      const prevFees = prevAdm.feePlan?.netPayable || prevAdm.feePlan?.totalFees || 0
      const prevPaid = (prevAdm.payments || []).reduce((sum, p) => sum + p.totalAmount, 0)
      const prevPendingDue = Math.max(0, prevFees - prevPaid)

      // Promote in transaction
      await prisma.$transaction(async (tx) => {
        if (carryForwardDues && prevPendingDue > 0) {
          const existingDue = await tx.previousSessionDue.findFirst({
            where: {
              studentId: sId,
              originalSessionId: prevAdm.sessionId,
              currentSessionId: targetSessionId,
            },
          })
          if (!existingDue) {
            await tx.previousSessionDue.create({
              data: {
                studentId: sId,
                originalSessionId: prevAdm.sessionId,
                currentSessionId: targetSessionId,
                outstandingAmount: prevPendingDue,
                description: `Batch carry forward balance from ${prevAdm.session.name}`,
              },
            })
          }
        }

        const newAdm = await tx.studentAdmission.create({
          data: {
            studentId: sId,
            branchId,
            sessionId: targetSessionId,
            rollNumber: newRoll,
            standard: targetStandard,
            admissionDate: new Date(),
            isActive: true,
          },
        })

        const newPlan = await tx.feePlan.create({
          data: {
            admissionId: newAdm.id,
            sessionId: targetSessionId,
            totalFees: numFees,
            totalDiscount: 0,
            netPayable: numFees,
          },
        })

        const now = new Date()
        await tx.installment.create({
          data: {
            feePlanId: newPlan.id,
            installmentNo: 1,
            label: 'Session Fee',
            dueDate: now,
            amountDue: numFees,
          },
        })
      })

      promotedStudents.push(student.fullName)
    }

    res.status(200).json({
      success: true,
      promotedCount: promotedStudents.length,
      skippedCount: skippedStudents.length,
      promotedStudents,
      skippedStudents,
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Batch promotion failed' })
  }
})
