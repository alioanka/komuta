/**
 * Komuta seed — representative org structure, users, mappings, history.
 * Run with: pnpm db:seed   (tsx prisma/seed.ts)
 *
 * Prints the seeded login credentials at the end. CHANGE THESE IMMEDIATELY in
 * production (see /docs/SETUP_CHECKLIST.md).
 */
import { PrismaClient, type OutletType } from '@prisma/client';
import * as argon2 from 'argon2';
import { normalizeTr } from '@komuta/money';

const prisma = new PrismaClient();

function slug(s: string): string {
  return normalizeTr(s).replace(/\s+/g, '-');
}

async function hash(pw: string): Promise<string> {
  return argon2.hash(pw, { type: argon2.argon2id });
}

async function main(): Promise<void> {
  console.log('Seeding Komuta…');

  // --- Companies ---
  const kakao = await prisma.company.upsert({
    where: { slug: 'kakao-gida' },
    update: {},
    create: { name: 'Kakao Gıda', slug: 'kakao-gida' },
  });
  const zerkay = await prisma.company.upsert({
    where: { slug: 'zerkay-gida' },
    update: {},
    create: { name: 'ZerKay Gıda', slug: 'zerkay-gida' },
  });
  const roka = await prisma.company.upsert({
    where: { slug: 'roka-gida' },
    update: {},
    create: { name: 'Roka Gıda', slug: 'roka-gida' },
  });
  const bakir = await prisma.company.upsert({
    where: { slug: 'bakir-kupa-gida' },
    update: {},
    create: { name: 'Bakır Kupa Gıda', slug: 'bakir-kupa-gida' },
  });

  // --- Brands (Kakao) ---
  const bkKoleji = await prisma.brand.upsert({
    where: { slug: 'bahcesehir-koleji' },
    update: {},
    create: { companyId: kakao.id, name: 'Bahçeşehir Koleji', slug: 'bahcesehir-koleji' },
  });
  const bkUni = await prisma.brand.upsert({
    where: { slug: 'bahcesehir-universitesi' },
    update: {},
    create: { companyId: kakao.id, name: 'Bahçeşehir Üniversitesi', slug: 'bahcesehir-universitesi' },
  });

  // --- Outlet helper ---
  async function outlet(args: {
    companyId: string;
    brandId?: string;
    name: string;
    code: string;
    type: OutletType;
    city?: string;
    campus?: string;
    aliases?: string[];
    expectsDailyRevenue?: boolean;
  }) {
    const o = await prisma.outlet.upsert({
      where: { code: args.code },
      update: {},
      create: {
        companyId: args.companyId,
        brandId: args.brandId,
        name: args.name,
        code: args.code,
        type: args.type,
        city: args.city,
        campus: args.campus,
        expectsDailyRevenue: args.expectsDailyRevenue ?? true,
      },
    });
    for (const alias of args.aliases ?? []) {
      await prisma.outletAlias.upsert({
        where: { outletId_normalizedAlias: { outletId: o.id, normalizedAlias: normalizeTr(alias) } },
        update: {},
        create: { outletId: o.id, alias, normalizedAlias: normalizeTr(alias) },
      });
    }
    return o;
  }

  // --- Kakao: Bahçeşehir Koleji canteens (code 1234 = Çamlıca so §6.1 works e2e) ---
  const camlica = await outlet({
    companyId: kakao.id,
    brandId: bkKoleji.id,
    name: 'Çamlıca BK',
    code: '1234',
    type: 'SCHOOL_CANTEEN',
    city: 'İstanbul',
    aliases: ['Çamlıca', 'Camlica BK', 'camlica'],
  });
  await outlet({ companyId: kakao.id, brandId: bkKoleji.id, name: 'Ataşehir BK', code: '1235', type: 'SCHOOL_CANTEEN', city: 'İstanbul', aliases: ['Atasehir'] });
  await outlet({ companyId: kakao.id, brandId: bkKoleji.id, name: 'Beylikdüzü BK', code: '1236', type: 'SCHOOL_CANTEEN', city: 'İstanbul', aliases: ['Beylikduzu'] });
  await outlet({ companyId: kakao.id, brandId: bkKoleji.id, name: 'Bahçeşehir BK', code: '1237', type: 'SCHOOL_CANTEEN', city: 'İstanbul' });
  await outlet({ companyId: kakao.id, brandId: bkKoleji.id, name: 'Kadıköy BK', code: '1238', type: 'SCHOOL_CANTEEN', city: 'İstanbul', aliases: ['Kadikoy'] });

  // --- Kakao: Bahçeşehir Üniversitesi canteens + refectories ---
  await outlet({ companyId: kakao.id, brandId: bkUni.id, name: 'BAU Beşiktaş Kantin', code: '2001', type: 'UNIVERSITY_CANTEEN', city: 'İstanbul', campus: 'Beşiktaş', aliases: ['BAU Besiktas'] });
  await outlet({ companyId: kakao.id, brandId: bkUni.id, name: 'BAU Galata Kantin', code: '2002', type: 'UNIVERSITY_CANTEEN', city: 'İstanbul', campus: 'Galata' });
  await outlet({ companyId: kakao.id, brandId: bkUni.id, name: 'BAU Güney Kampüs Yemekhane', code: '2101', type: 'REFECTORY', city: 'İstanbul', campus: 'Güney', aliases: ['BAU Guney Yemekhane'] });

  // --- ZerKay ---
  const pizza = await outlet({ companyId: zerkay.id, name: 'Pizza Sando', code: '3001', type: 'RESTAURANT', city: 'İstanbul', aliases: ['Pizza Sando', 'Sando'] });
  await outlet({ companyId: zerkay.id, name: 'LCW Kantin 1', code: '3101', type: 'CANTEEN', city: 'İstanbul', aliases: ['LCW 1'] });
  await outlet({ companyId: zerkay.id, name: 'LCW Kantin 2', code: '3102', type: 'CANTEEN', city: 'İstanbul', aliases: ['LCW 2'] });
  await outlet({ companyId: zerkay.id, name: 'SuperMoon Kruvasan Fabrikası', code: '3201', type: 'FACTORY', city: 'İstanbul', aliases: ['SuperMoon'] });

  // --- Roka ---
  await outlet({ companyId: roka.id, name: 'Biruni Üniversitesi Yemekhane', code: '4001', type: 'REFECTORY', city: 'İstanbul', aliases: ['Biruni'] });

  // --- Bakır Kupa ---
  await outlet({ companyId: bakir.id, name: 'Espressolab İyaşpark', code: '5001', type: 'CAFE', city: 'Isparta', aliases: ['Espressolab', 'Iyaspark'] });

  // --- Users ---
  const ownerEmail = process.env.SEED_OWNER_EMAIL ?? 'ozer@komuta.local';
  const ownerPw = process.env.SEED_OWNER_PASSWORD ?? 'ChangeMe!Owner1';
  const accEmail = process.env.SEED_ACCOUNTANT_EMAIL ?? 'salih@komuta.local';
  const accPw = process.env.SEED_ACCOUNTANT_PASSWORD ?? 'ChangeMe!Salih1';

  await prisma.user.upsert({
    where: { email: ownerEmail },
    update: {},
    create: {
      email: ownerEmail,
      fullName: 'Özer Kaya',
      role: 'OWNER',
      passwordHash: await hash(ownerPw),
      phoneE164: process.env.SEED_OWNER_PHONE ?? null,
    },
  });
  await prisma.user.upsert({
    where: { email: accEmail },
    update: {},
    create: { email: accEmail, fullName: 'Salih (Muhasebe)', role: 'ACCOUNTANT', passwordHash: await hash(accPw) },
  });
  const manager = await prisma.user.upsert({
    where: { email: 'manager@komuta.local' },
    update: {},
    create: { email: 'manager@komuta.local', fullName: 'Test Yönetici', role: 'MANAGER', passwordHash: await hash('ChangeMe!Mgr1') },
  });
  await prisma.userScope.create({ data: { userId: manager.id, companyId: kakao.id } }).catch(() => undefined);
  await prisma.user.upsert({
    where: { email: 'viewer@komuta.local' },
    update: {},
    create: { email: 'viewer@komuta.local', fullName: 'Test Görüntüleyici', role: 'VIEWER', passwordHash: await hash('ChangeMe!View1') },
  });

  // --- Employees + phone mappings (ACTIVE / PENDING / BLOCKED) ---
  const hatice = await prisma.employee.create({
    data: { outletId: camlica.id, fullName: 'Hatice Yılmaz', normalizedName: normalizeTr('Hatice Yılmaz'), isActive: true },
  });
  await prisma.phoneMapping.upsert({
    where: { phoneE164: '+905551112233' },
    update: {},
    create: { phoneE164: '+905551112233', outletId: camlica.id, employeeId: hatice.id, status: 'ACTIVE' },
  });
  await prisma.phoneMapping.upsert({
    where: { phoneE164: '+905552223344' },
    update: {},
    create: { phoneE164: '+905552223344', outletId: pizza.id, status: 'PENDING' },
  });
  await prisma.phoneMapping.upsert({
    where: { phoneE164: '+905553334455' },
    update: {},
    create: { phoneE164: '+905553334455', status: 'BLOCKED' },
  });

  // --- Historical revenue (last 14 days) so charts render ---
  const outlets = await prisma.outlet.findMany({ where: { expectsDailyRevenue: true } });
  for (let d = 14; d >= 1; d--) {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - d);
    for (const o of outlets) {
      // ~85% reporting rate; deterministic-ish via hash of id+day
      if ((o.code.charCodeAt(o.code.length - 1) + d) % 7 === 0) continue;
      const base = 5000 + (o.code.charCodeAt(0) % 9) * 2500;
      const amount = (base + ((d * 137) % 1500)).toFixed(2);
      await prisma.revenueEntry.create({
        data: { outletId: o.id, businessDate: date, amount, source: 'WHATSAPP', status: 'CONFIRMED' },
      });
    }
  }

  // --- Student counts for canteens (current month) ---
  const month = new Date().toISOString().slice(0, 7);
  for (const o of outlets.filter((x) => x.type === 'SCHOOL_CANTEEN')) {
    await prisma.studentCount
      .create({ data: { outletId: o.id, periodMonth: month, ortaokul: 300, lise: 450 } })
      .catch(() => undefined);
  }

  // --- Message templates (local mirror of Meta templates) ---
  const templates = [
    { name: 'revenue_confirmation', metaTemplateName: 'revenue_confirmation', category: 'UTILITY' as const },
    { name: 'missing_revenue_reminder', metaTemplateName: 'missing_revenue_reminder', category: 'UTILITY' as const },
    { name: 'store_id_request', metaTemplateName: 'store_id_request', category: 'UTILITY' as const },
    { name: 'manager_confirmation', metaTemplateName: 'manager_confirmation', category: 'UTILITY' as const },
    { name: 'daily_summary', metaTemplateName: 'daily_summary', category: 'UTILITY' as const },
  ];
  for (const t of templates) {
    await prisma.messageTemplate.upsert({
      where: { name: t.name },
      update: {},
      create: { ...t, language: 'tr', status: 'PENDING' },
    });
  }

  // --- Notification rules ---
  await prisma.notificationRule.create({
    data: {
      name: 'Eksik ciro hatırlatması (cutoff)',
      event: 'MISSING_REVENUE',
      channels: ['INAPP', 'TELEGRAM'],
      scheduleCron: '0 21 * * *',
    },
  }).catch(() => undefined);
  await prisma.notificationRule.create({
    data: {
      name: 'Eşleşmeyen gönderen',
      event: 'UNMAPPED_SENDER',
      channels: ['INAPP', 'TELEGRAM'],
    },
  }).catch(() => undefined);

  // --- Settings ---
  await prisma.setting.upsert({
    where: { key: 'reporting' },
    update: {},
    create: { key: 'reporting', value: { cutoffLocal: '21:00', timezone: 'Europe/Istanbul', anomalyThresholdPct: 40 } },
  });

  console.log('\n✅ Seed complete. Login credentials (CHANGE IMMEDIATELY):');
  console.log(`   OWNER      → ${ownerEmail} / ${ownerPw}`);
  console.log(`   ACCOUNTANT → ${accEmail} / ${accPw}`);
  console.log('   MANAGER    → manager@komuta.local / ChangeMe!Mgr1');
  console.log('   VIEWER     → viewer@komuta.local / ChangeMe!View1');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
