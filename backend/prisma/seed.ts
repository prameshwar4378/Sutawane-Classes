import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('[Seed] Seeding initial data for Sutawane Classes...')

  // 1. Seed Default Branches
  const nagpur = await prisma.branch.upsert({
    where: { code: 'NGP' },
    update: {},
    create: {
      name: 'Nagpur Central Branch',
      code: 'NGP',
      address: 'Main Coaching Complex, Sitabuldi, Nagpur',
      phone: '9876543210',
      contactPerson: 'Director Sutawane Sir',
      isActive: true,
    },
  })

  const wardha = await prisma.branch.upsert({
    where: { code: 'WRD' },
    update: {},
    create: {
      name: 'Wardha Branch',
      code: 'WRD',
      address: 'Near Gandhi Chowk, Wardha',
      phone: '9876543211',
      contactPerson: 'Center Incharge',
      isActive: true,
    },
  })

  console.log(`[Seed] Branches ready: ${nagpur.name}, ${wardha.name}`)

  // 2. Seed Default Academic Session
  const session2026 = await prisma.academicSession.upsert({
    where: { name: '2026-27' },
    update: {},
    create: {
      name: '2026-27',
      displayName: 'Academic Year 2026–27',
      startDate: new Date('2026-06-01T00:00:00.000Z'),
      endDate: new Date('2027-05-31T23:59:59.000Z'),
      isCurrent: true,
      isActive: true,
    },
  })

  console.log(`[Seed] Current Academic Session: ${session2026.displayName}`)

  // 3. Seed Default Expense Categories
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
    await prisma.expenseCategory.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    })
  }

  // 4. Seed Default System Settings
  await prisma.systemSetting.upsert({
    where: { key: 'institute_name' },
    update: {},
    create: { key: 'institute_name', value: 'Sutawane Classes' },
  })

  await prisma.systemSetting.upsert({
    where: { key: 'tagline' },
    update: {},
    create: { key: 'tagline', value: 'Excellence in Coaching & Board Preparations' },
  })

  console.log('[Seed] Seeding completed successfully!')
}

main()
  .catch((e) => {
    console.error('[Seed] Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
