/**
 * Komuta demo-data purge — removes the fake data created by prisma/seed.ts,
 * leaving real WhatsApp-sourced data, your companies/outlets and real users
 * intact.
 *
 * Run:
 *   npx tsx prisma/purge-demo.ts --dry-run   # count only, change nothing
 *   npx tsx prisma/purge-demo.ts             # delete
 *
 * What it removes:
 *   - RevenueEntry with rawMessageId IS NULL  (seeded history; real WhatsApp
 *     entries always carry a rawMessageId)
 *   - Inventory/Payroll/Purchase/StudentCount/Headcount with enteredByUserId
 *     IS NULL (the seed leaves it null; real manual entries always set it)
 *   - the three demo PhoneMappings and the demo employee "Hatice Yılmaz"
 *   - demo users manager@komuta.local and viewer@komuta.local (+ their scopes
 *     and refresh tokens, via cascade)
 *   - all Notification rows (in-app history)
 * It KEEPS: companies, outlets, real users, NotificationRules, templates,
 * settings, and every WhatsApp message / real revenue entry.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

const DEMO_PHONES = ['+905551112233', '+905552223344', '+905553334455'];
const DEMO_USER_EMAILS = ['manager@komuta.local', 'viewer@komuta.local'];

async function main(): Promise<void> {
  console.log(DRY_RUN ? '— DRY RUN (nothing will be deleted) —\n' : '— PURGING DEMO DATA —\n');

  const counts = {
    revenueEntries: await prisma.revenueEntry.count({ where: { rawMessageId: null } }),
    inventory: await prisma.inventorySnapshot.count({ where: { enteredByUserId: null } }),
    payroll: await prisma.payrollEntry.count({ where: { enteredByUserId: null } }),
    purchases: await prisma.purchaseEntry.count({ where: { enteredByUserId: null } }),
    studentCounts: await prisma.studentCount.count({ where: { enteredByUserId: null } }),
    headcounts: await prisma.headcountCorrection.count({ where: { enteredByUserId: null } }),
    phoneMappings: await prisma.phoneMapping.count({ where: { phoneE164: { in: DEMO_PHONES } } }),
    employees: await prisma.employee.count({ where: { fullName: 'Hatice Yılmaz' } }),
    demoUsers: await prisma.user.count({ where: { email: { in: DEMO_USER_EMAILS } } }),
    notifications: await prisma.notification.count(),
  };

  console.table(counts);

  if (DRY_RUN) {
    console.log('\nDry run complete — re-run without --dry-run to delete.');
    return;
  }

  await prisma.$transaction([
    prisma.revenueEntry.deleteMany({ where: { rawMessageId: null } }),
    prisma.inventorySnapshot.deleteMany({ where: { enteredByUserId: null } }),
    prisma.payrollEntry.deleteMany({ where: { enteredByUserId: null } }),
    prisma.purchaseEntry.deleteMany({ where: { enteredByUserId: null } }),
    prisma.studentCount.deleteMany({ where: { enteredByUserId: null } }),
    prisma.headcountCorrection.deleteMany({ where: { enteredByUserId: null } }),
    prisma.phoneMapping.deleteMany({ where: { phoneE164: { in: DEMO_PHONES } } }),
    prisma.employee.deleteMany({ where: { fullName: 'Hatice Yılmaz' } }),
    prisma.notification.deleteMany({}),
    prisma.user.deleteMany({ where: { email: { in: DEMO_USER_EMAILS } } }),
  ]);

  console.log('\n✅ Demo data purged. Companies, outlets and real data are untouched.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
