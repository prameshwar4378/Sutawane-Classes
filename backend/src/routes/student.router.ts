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
export function calculateInstallmentStatus(amountDue: number, amountPaid: number, dueDate: Date): string {
  if (amountPaid >= amountDue && amountDue > 0) {
    return 'PAID'
  }
  if (amountPaid > 0 && amountPaid < amountDue) {
    return 'PARTIAL'
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)

  if (today.getTime() > due.getTime()) {
    return 'OVERDUE'
  }
  if (today.getTime() === due.getTime()) {
    return 'DUE'
  }
  return 'UPCOMING'
}

// GET all students with search, standard, branch and session filters
studentRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { branchId, sessionId, standard, search, isActive } = req.query

    // Build admission filter
    const admissionWhere: any = {}

    if (isActive !== 'ALL') {
      admissionWhere.isActive = isActive === 'false' ? false : true
    }

    if (branchId && branchId !== 'ALL') {
      admissionWhere.branchId = String(branchId)
    }
    if (sessionId) {
      admissionWhere.sessionId = String(sessionId)
    }
    if (standard && standard !== 'ALL') {
      admissionWhere.standard = String(standard)
    }

    // Search query on student bio or roll number
    if (search && String(search).trim()) {
      const q = String(search).trim()
      admissionWhere.OR = [
        { rollNumber: { contains: q } },
        { student: { fullName: { contains: q } } },
        { student: { parentPhone: { contains: q } } },
        { student: { studentCode: { contains: q } } },
      ]
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

// GET detailed student profile by ID
studentRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)

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
          },
          orderBy: { createdAt: 'desc' },
        },
        payments: {
          include: {
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

    const currentAdmission = student.admissions[0] || null
    const feePlan = currentAdmission?.feePlan || null

    // Compute installments with status
    const installmentsWithStatus = feePlan?.installments.map((inst) => {
      // Sum non-reversed allocations
      const paid = inst.allocations.reduce((sum, alloc) => {
        return alloc.payment.isReversed ? sum : sum + alloc.allocatedAmount
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
    }) || []

    const totalFees = feePlan?.totalFees || 0
    const totalDiscount = feePlan?.totalDiscount || 0
    const netPayable = feePlan?.netPayable || totalFees - totalDiscount

    const totalPaid = student.payments.reduce((acc, p) => {
      return p.isReversed ? acc : acc + p.totalAmount
    }, 0)

    const totalPending = Math.max(0, netPayable - totalPaid)

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
      },
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
        allocations: p.allocations.map((a) => ({
          id: a.id,
          allocatedAmount: a.allocatedAmount,
          installmentLabel: a.installment.label,
        })),
      })),
      allAdmissions: student.admissions.map((a) => ({
        id: a.id,
        rollNumber: a.rollNumber,
        standard: a.standard,
        branchName: a.branch.name,
        sessionName: a.session.name,
        isActive: a.isActive,
        admissionDate: a.admissionDate.toISOString(),
      })),
      previousSessionDues: student.previousSessionDues.map((d) => ({
        id: d.id,
        outstandingAmount: d.outstandingAmount,
        collectedAmount: d.collectedAmount,
        balanceRemaining: Math.max(0, d.outstandingAmount - d.collectedAmount),
        description: d.description,
        originalSessionName: d.originalSession?.name,
        currentSessionName: d.currentSession?.name,
        createdAt: d.createdAt.toISOString(),
      })),
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
      customInstallments, // optional custom installment schedule array
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

      // If custom installments provided, use them; otherwise auto-generate 3 installments
      if (Array.isArray(customInstallments) && customInstallments.length > 0) {
        await tx.installment.createMany({
          data: customInstallments.map((inst: any, idx: number) => ({
            feePlanId: feePlan.id,
            installmentNo: idx + 1,
            label: inst.label || `Installment ${idx + 1}`,
            dueDate: new Date(inst.dueDate || now),
            amountDue: Number(inst.amountDue) || 0,
          })),
        })
      } else {
        // Auto-generate 3 installments: 40% admission, 30% month 2, 30% month 3
        const inst1Amount = Math.round(feesNumber * 0.4)
        const inst2Amount = Math.round(feesNumber * 0.3)
        const inst3Amount = feesNumber - (inst1Amount + inst2Amount)

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
      }

      return { student, admission, feePlan }
    })

    res.status(201).json(result)
  } catch (error) {
    res.status(500).json({ error: 'Failed to admit student', details: String(error) })
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
          },
          orderBy: { createdAt: 'desc' },
        },
        payments: {
          where: { isReversed: false },
        },
      },
    })

    if (!student || student.admissions.length === 0) {
      return res.status(404).json({ error: 'Student or admission record not found' })
    }

    const currentAdmission = student.admissions[0]
    const currentFeePlan = currentAdmission.feePlan
    const totalFees = currentFeePlan?.netPayable || currentFeePlan?.totalFees || 0
    const totalPaid = student.payments.reduce((acc, p) => acc + p.totalAmount, 0)
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
          },
          orderBy: { createdAt: 'desc' },
        },
        payments: {
          where: { isReversed: false },
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

    // Calculate pending dues from previous session
    const prevPlanFees = previousAdmission.feePlan?.netPayable || previousAdmission.feePlan?.totalFees || 0
    const prevPaid = student.payments.reduce((sum, p) => sum + p.totalAmount, 0)
    const prevPendingDue = Math.max(0, prevPlanFees - prevPaid)

    const numFees = Number(newTotalFees) || 0

    // Transaction to create new admission, fee plan, and previous session due record
    const result = await prisma.$transaction(async (tx) => {
      // 1. If previous dues exist and carry forward is enabled, record PreviousSessionDue
      let dueRecord = null
      if (carryForwardDue && prevPendingDue > 0) {
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

      // 3. Create fresh FeePlan for target session
      const newFeePlan = await tx.feePlan.create({
        data: {
          admissionId: newAdmission.id,
          sessionId: targetSessionId,
          totalFees: numFees,
          totalDiscount: 0,
          netPayable: numFees,
        },
      })

      // 4. Create standard 3 installments for new session
      const now = new Date()
      const inst1 = Math.round(numFees * 0.4)
      const inst2 = Math.round(numFees * 0.3)
      const inst3 = numFees - (inst1 + inst2)

      await tx.installment.createMany({
        data: [
          {
            feePlanId: newFeePlan.id,
            installmentNo: 1,
            label: 'Installment 1 (Session Admission)',
            dueDate: now,
            amountDue: inst1,
          },
          {
            feePlanId: newFeePlan.id,
            installmentNo: 2,
            label: 'Installment 2',
            dueDate: new Date(now.getTime() + 45 * 24 * 3600 * 1000),
            amountDue: inst2,
          },
          {
            feePlanId: newFeePlan.id,
            installmentNo: 3,
            label: 'Installment 3 (Final)',
            dueDate: new Date(now.getTime() + 90 * 24 * 3600 * 1000),
            amountDue: inst3,
          },
        ],
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
            include: { session: true, feePlan: true },
            orderBy: { createdAt: 'desc' },
          },
          payments: { where: { isReversed: false } },
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

      // Calculate dues
      const prevFees = prevAdm.feePlan?.netPayable || prevAdm.feePlan?.totalFees || 0
      const prevPaid = student.payments.reduce((sum, p) => sum + p.totalAmount, 0)
      const prevPendingDue = Math.max(0, prevFees - prevPaid)

      // Promote in transaction
      await prisma.$transaction(async (tx) => {
        if (carryForwardDues && prevPendingDue > 0) {
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
        const inst1 = Math.round(numFees * 0.4)
        const inst2 = Math.round(numFees * 0.3)
        const inst3 = numFees - (inst1 + inst2)

        await tx.installment.createMany({
          data: [
            {
              feePlanId: newPlan.id,
              installmentNo: 1,
              label: 'Installment 1',
              dueDate: now,
              amountDue: inst1,
            },
            {
              feePlanId: newPlan.id,
              installmentNo: 2,
              label: 'Installment 2',
              dueDate: new Date(now.getTime() + 45 * 24 * 3600 * 1000),
              amountDue: inst2,
            },
            {
              feePlanId: newPlan.id,
              installmentNo: 3,
              label: 'Installment 3',
              dueDate: new Date(now.getTime() + 90 * 24 * 3600 * 1000),
              amountDue: inst3,
            },
          ],
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
