const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function repairData() {
  console.log('--- Step 1: Starting Data Isolation & Session Repair ---');

  // 1. Fetch academic sessions
  const session26 = await prisma.academicSession.findFirst({ where: { name: '2026-27' } });
  const session27 = await prisma.academicSession.findFirst({ where: { name: '2027-28' } });

  if (!session26) {
    throw new Error('Academic session 2026-27 not found');
  }

  // 2. Normalize isCurrent flag: Set 2026-27 as Current, testing as false
  console.log('Normalizing Academic Sessions isCurrent flag...');
  await prisma.academicSession.updateMany({
    data: { isCurrent: false },
  });

  await prisma.academicSession.update({
    where: { id: session26.id },
    data: { isCurrent: true },
  });
  console.log(`✓ Academic Session 2026-27 set to isCurrent = true`);

  // 3. Resolve all orphan payments
  const orphans = await prisma.payment.findMany({
    where: { sessionId: null },
    include: {
      student: {
        include: {
          admissions: {
            include: { session: true },
          },
        },
      },
    },
  });

  console.log(`Found ${orphans.length} orphan payments with sessionId = null. Repairing...`);

  let repairedCount = 0;
  for (const p of orphans) {
    let targetSessionId = null;

    if (p.receiptNumber.includes('2026-27')) {
      targetSessionId = session26.id;
    } else if (p.receiptNumber.includes('2027-28') && session27) {
      targetSessionId = session27.id;
    } else {
      // Find matching session in student admissions
      const adm26 = p.student?.admissions.find((a) => a.sessionId === session26.id);
      if (adm26) {
        targetSessionId = session26.id;
      } else if (p.student?.admissions && p.student.admissions.length > 0) {
        targetSessionId = p.student.admissions[0].sessionId;
      } else {
        targetSessionId = session26.id;
      }
    }

    const matchingAdm =
      p.student?.admissions.find((a) => a.sessionId === targetSessionId) ||
      p.student?.admissions[0];

    await prisma.payment.update({
      where: { id: p.id },
      data: {
        sessionId: targetSessionId,
        admissionId: matchingAdm ? matchingAdm.id : p.admissionId,
      },
    });

    repairedCount++;
  }

  console.log(`✓ Successfully repaired ${repairedCount} payments with accurate sessionId and admissionId.`);

  // 4. Verify no orphan payments remain
  const remainingOrphans = await prisma.payment.count({ where: { sessionId: null } });
  console.log(`Remaining orphan payments: ${remainingOrphans}`);

  // 5. Verification summary across sessions
  const payments26 = await prisma.payment.count({ where: { sessionId: session26.id } });
  const payments27 = session27 ? await prisma.payment.count({ where: { sessionId: session27.id } }) : 0;
  const totalPayments = await prisma.payment.count();

  console.log('\n--- Post-Repair Verification ---');
  console.log(`Session 2026-27 Payments: ${payments26}`);
  console.log(`Session 2027-28 Payments: ${payments27}`);
  console.log(`Total System Payments: ${totalPayments}`);
  console.log(`Sum of Session Payments: ${payments26 + payments27}`);
  console.log(`Symmetry Check: ${payments26 + payments27 === totalPayments ? 'PERFECT MATCH ✓' : 'MISMATCH'}`);
}

repairData()
  .catch((err) => {
    console.error('Repair failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
