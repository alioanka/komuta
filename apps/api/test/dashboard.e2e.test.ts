import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { DashboardService } from '../src/dashboard/dashboard.service.js';
import { businessDateInTz, dateOnly } from '../src/common/date.util.js';
import type { AuthUser } from '../src/common/current-user.decorator.js';

/**
 * DB-backed tests for the grouped perCompany dashboard aggregation.
 * Requires DATABASE_URL (skipped automatically when unset).
 */
const hasDb = !!process.env.DATABASE_URL;
const d = hasDb ? describe : describe.skip;

const prisma = new PrismaClient();
const dashboard = new DashboardService(prisma as never);

const stamp = Date.now();
const today = dateOnly(businessDateInTz(new Date(), 'Europe/Istanbul'));

let companyId = '';
let outletAId = '';
let outletBId = '';

const owner: AuthUser = {
  id: 'test-owner',
  email: 'owner@test',
  role: 'OWNER',
  permissions: [],
  scopeCompanyIds: [],
  scopeOutletIds: [],
  unscoped: true,
};

d('Dashboard perCompany aggregation (e2e)', () => {
  beforeAll(async () => {
    await prisma.$connect();
    const company = await prisma.company.create({
      data: { name: `DashTest Co ${stamp}`, slug: `dashtest-${stamp}` },
    });
    companyId = company.id;
    const a = await prisma.outlet.create({
      data: { companyId, name: `Dash A ${stamp}`, code: `DA${stamp}`, type: 'CAFE' },
    });
    const b = await prisma.outlet.create({
      data: { companyId, name: `Dash B ${stamp}`, code: `DB${stamp}`, type: 'CAFE' },
    });
    outletAId = a.id;
    outletBId = b.id;
    await prisma.revenueEntry.create({
      data: { outletId: outletAId, businessDate: today, amount: '1000.50', source: 'MANUAL', status: 'CONFIRMED' },
    });
    await prisma.revenueEntry.create({
      data: { outletId: outletBId, businessDate: today, amount: '2000.25', source: 'MANUAL', status: 'CONFIRMED' },
    });
    // Noise that must NOT be counted: pending + superseded entries.
    await prisma.revenueEntry.create({
      data: { outletId: outletAId, businessDate: today, amount: '9999.99', source: 'WHATSAPP', status: 'PENDING_REVIEW' },
    });
    await prisma.revenueEntry.create({
      data: { outletId: outletBId, businessDate: today, amount: '8888.88', source: 'MANUAL', status: 'SUPERSEDED' },
    });
  });

  afterAll(async () => {
    await prisma.revenueEntry.deleteMany({ where: { outletId: { in: [outletAId, outletBId] } } });
    await prisma.outlet.deleteMany({ where: { id: { in: [outletAId, outletBId] } } });
    await prisma.company.delete({ where: { id: companyId } });
    await prisma.$disconnect();
  });

  it('sums confirmed revenue per company with exact decimal math', async () => {
    const overview = await dashboard.overview(owner);
    const row = overview.perCompany.find(
      (c: { companyId: string }) => c.companyId === companyId,
    ) as { totalToday: string; outletCount: number; reported: number } | undefined;
    expect(row).toBeDefined();
    expect(row!.totalToday).toBe('3000.75');
    expect(row!.outletCount).toBe(2);
    expect(row!.reported).toBe(2);
  });

  it('scoped users only see their companies in perCompany', async () => {
    const scoped: AuthUser = {
      ...owner,
      role: 'VIEWER',
      unscoped: false,
      scopeCompanyIds: [companyId],
    };
    const overview = await dashboard.overview(scoped);
    expect(overview.perCompany).toHaveLength(1);
    expect(overview.perCompany[0]!.companyId).toBe(companyId);
    expect(overview.perCompany[0]!.totalToday).toBe('3000.75');
    expect(overview.totalRevenueToday).toBe('3000.75');
  });
});
