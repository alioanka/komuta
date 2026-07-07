import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { ReportsService } from '../src/reports/reports.service.js';
import { dateOnly } from '../src/common/date.util.js';
import type { AuthUser } from '../src/common/current-user.decorator.js';

/**
 * DB-backed tests for the reports aggregation service.
 * Requires DATABASE_URL (skipped automatically when unset).
 */
const hasDb = !!process.env.DATABASE_URL;
const d = hasDb ? describe : describe.skip;

const prisma = new PrismaClient();
const reports = new ReportsService(prisma as never);

const stamp = Date.now();
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

d('Reports aggregation (e2e)', () => {
  beforeAll(async () => {
    await prisma.$connect();
    const company = await prisma.company.create({
      data: { name: `RepTest Co ${stamp}`, slug: `reptest-${stamp}` },
    });
    companyId = company.id;
    const a = await prisma.outlet.create({
      data: {
        companyId,
        name: `Çamlıca ${stamp}`,
        code: `RA${stamp}`,
        type: 'SCHOOL_CANTEEN',
        studentOrtaokul: 1200,
        studentLise: 150,
      },
    });
    const b = await prisma.outlet.create({
      data: {
        companyId,
        name: `Kadıköy ${stamp}`,
        code: `RB${stamp}`,
        type: 'CAFE',
      },
    });
    outletAId = a.id;
    outletBId = b.id;

    // Outlet A: two days, 100 + 300 = 400 over 2 distinct days.
    await prisma.revenueEntry.create({
      data: { outletId: outletAId, businessDate: dateOnly('2026-01-01'), amount: '100.00', source: 'MANUAL', status: 'CONFIRMED' },
    });
    await prisma.revenueEntry.create({
      data: { outletId: outletAId, businessDate: dateOnly('2026-01-02'), amount: '300.00', source: 'MANUAL', status: 'CONFIRMED' },
    });
    // Outlet B: one day, 50.
    await prisma.revenueEntry.create({
      data: { outletId: outletBId, businessDate: dateOnly('2026-01-01'), amount: '50.00', source: 'MANUAL', status: 'CONFIRMED' },
    });
    // Noise: must not be counted (non-CONFIRMED).
    await prisma.revenueEntry.create({
      data: { outletId: outletBId, businessDate: dateOnly('2026-01-02'), amount: '9999.00', source: 'WHATSAPP', status: 'PENDING_REVIEW' },
    });
  });

  afterAll(async () => {
    await prisma.revenueEntry.deleteMany({ where: { outletId: { in: [outletAId, outletBId] } } });
    await prisma.outlet.deleteMany({ where: { id: { in: [outletAId, outletBId] } } });
    await prisma.company.delete({ where: { id: companyId } });
    await prisma.$disconnect();
  });

  it('revenue groupBy=outlet returns correct per-outlet totals/avg', async () => {
    const res = await reports.revenue(owner, {
      companyId,
      status: 'CONFIRMED',
      groupBy: 'outlet',
    } as never);
    const a = res.rows.find((r) => r.key === outletAId);
    const b = res.rows.find((r) => r.key === outletBId);
    expect(a).toBeDefined();
    expect(a!.total).toBe('400.00');
    expect(a!.count).toBe(2);
    expect(a!.avg).toBe('200.00');
    expect(a!.label).toContain('Çamlıca');
    expect(b!.total).toBe('50.00');
    expect(res.totalSum).toBe('450.00');
    expect(res.totalCount).toBe(3);
    // Sorted by total desc → outlet A first.
    expect(res.rows[0]!.key).toBe(outletAId);
  });

  it('branches join student counts with revenue window', async () => {
    const rows = await reports.branches(owner, {
      companyId,
      status: 'CONFIRMED',
    } as never);
    const a = rows.find((r) => r.outletId === outletAId)!;
    const b = rows.find((r) => r.outletId === outletBId)!;
    expect(a.studentOrtaokul).toBe(1200);
    expect(a.studentLise).toBe(150);
    expect(a.studentTotal).toBe(1350);
    expect(a.totalRevenue).toBe('400.00');
    expect(a.dayCount).toBe(2);
    expect(a.avgDailyRevenue).toBe('200.00');
    expect(b.studentTotal).toBe(0);
    expect(b.dayCount).toBe(1);
    // Sorted by totalRevenue desc.
    expect(rows[0]!.outletId).toBe(outletAId);
  });

  it('branches respects from/to window', async () => {
    const rows = await reports.branches(owner, {
      companyId,
      status: 'CONFIRMED',
      from: '2026-01-02',
      to: '2026-01-02',
    } as never);
    const a = rows.find((r) => r.outletId === outletAId)!;
    expect(a.totalRevenue).toBe('300.00');
    expect(a.dayCount).toBe(1);
  });
});
