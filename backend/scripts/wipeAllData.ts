import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import { storagePaths } from '../src/config/index'

const prisma = new PrismaClient()

async function wipeAllData() {
  console.log('[Wipe] Starting full database and storage wipe...')

  // 1. Delete all student & fee transaction records in cascade-safe order
  console.log('[Wipe] Deleting payment allocations...')
  await prisma.paymentAllocation.deleteMany({})

  console.log('[Wipe] Deleting payments...')
  await prisma.payment.deleteMany({})

  console.log('[Wipe] Deleting receipt counters...')
  await prisma.receiptCounter.deleteMany({})

  console.log('[Wipe] Deleting installments...')
  await prisma.installment.deleteMany({})

  console.log('[Wipe] Deleting fee discounts...')
  await prisma.feeDiscount.deleteMany({})

  console.log('[Wipe] Deleting fee plans...')
  await prisma.feePlan.deleteMany({})

  console.log('[Wipe] Deleting previous session dues...')
  await prisma.previousSessionDue.deleteMany({})

  console.log('[Wipe] Deleting student admissions...')
  await prisma.studentAdmission.deleteMany({})

  console.log('[Wipe] Deleting students...')
  await prisma.student.deleteMany({})

  // 2. Delete all expense records and attachments
  console.log('[Wipe] Deleting expense attachments...')
  await prisma.expenseAttachment.deleteMany({})

  console.log('[Wipe] Deleting expenses...')
  await prisma.expense.deleteMany({})

  // 3. Delete health logs
  console.log('[Wipe] Deleting health logs...')
  await prisma.healthLog.deleteMany({})

  // 4. Clean up uploaded photos and attachments files from disk
  console.log('[Wipe] Cleaning up uploaded photo files on disk...')
  if (fs.existsSync(storagePaths.photosDir)) {
    const photoFiles = fs.readdirSync(storagePaths.photosDir)
    for (const f of photoFiles) {
      if (f !== '.gitkeep') {
        try {
          fs.unlinkSync(path.join(storagePaths.photosDir, f))
        } catch {}
      }
    }
  }

  console.log('[Wipe] Cleaning up uploaded attachment files on disk...')
  if (fs.existsSync(storagePaths.attachmentsDir)) {
    const attachmentFiles = fs.readdirSync(storagePaths.attachmentsDir)
    for (const f of attachmentFiles) {
      if (f !== '.gitkeep') {
        try {
          fs.unlinkSync(path.join(storagePaths.attachmentsDir, f))
        } catch {}
      }
    }
  }

  // 5. Ensure default branches exist
  console.log('[Wipe] Ensuring clean default branches and sessions...')
  await prisma.branch.deleteMany({})
  await prisma.branch.create({
    data: {
      name: 'Nagpur Central Branch',
      code: 'NGP',
      address: 'Main Coaching Complex, Sitabuldi, Nagpur',
      phone: '9876543210',
      contactPerson: 'Director Sutawane Sir',
      isActive: true,
    },
  })
  await prisma.branch.create({
    data: {
      name: 'Wardha Branch',
      code: 'WRD',
      address: 'Near Gandhi Chowk, Wardha',
      phone: '9876543211',
      contactPerson: 'Center Incharge',
      isActive: true,
    },
  })

  // 6. Ensure clean default session
  await prisma.academicSession.deleteMany({})
  await prisma.academicSession.create({
    data: {
      name: '2026-27',
      displayName: 'Academic Year 2026–27',
      startDate: new Date('2026-06-01T00:00:00.000Z'),
      endDate: new Date('2027-05-31T23:59:59.000Z'),
      isCurrent: true,
      isActive: true,
    },
  })

  // 7. Ensure clean default expense categories
  await prisma.expenseCategory.deleteMany({})
  const categories = [
    { name: 'Rent', sortOrder: 1 },
    { name: 'Salaries', sortOrder: 2 },
    { name: 'Electricity', sortOrder: 3 },
    { name: 'Internet', sortOrder: 4 },
    { name: 'Stationery', sortOrder: 5 },
    { name: 'Maintenance', sortOrder: 6 },
    { name: 'Marketing', sortOrder: 7 },
    { name: 'Miscellaneous', sortOrder: 8 },
  ]
  for (const cat of categories) {
    await prisma.expenseCategory.create({ data: cat })
  }

  // 8. Reset system settings
  await prisma.systemSetting.deleteMany({})
  await prisma.systemSetting.create({
    data: { key: 'institute_name', value: 'Sutawane Classes' },
  })
  await prisma.systemSetting.create({
    data: { key: 'tagline', value: 'Excellence in Coaching & Board Preparations' },
  })
  await prisma.systemSetting.create({
    data: { key: 'phone', value: '+91 98765 43210' },
  })
  await prisma.systemSetting.create({
    data: { key: 'email', value: 'contact@sutawaneclasses.com' },
  })
  await prisma.systemSetting.create({
    data: { key: 'address', value: 'Main Head Office, Station Road, Maharashtra' },
  })
  await prisma.systemSetting.create({
    data: { key: 'receipt_footer', value: 'Fees once paid are non-refundable. Thank you!' },
  })

  console.log('[Wipe] All data successfully deleted! Database is completely fresh and clean.')
}

wipeAllData()
  .catch((e) => {
    console.error('[Wipe] Error during wipe:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
