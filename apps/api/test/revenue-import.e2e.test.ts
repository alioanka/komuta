import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { RevenueController } from '../src/revenue/revenue.controller.js';
import type { AuthUser } from '../src/common/current-user.decorator.js';

/**
 * DB-backed tests for POST /revenue/import.
 * Requires DATABASE_URL (skipped automatically when unset).
 */
const hasDb = !!process.env.DATABASE_URL;
const d = hasDb ? describe : describe.skip;

const prisma = new PrismaClient();
const controller = new RevenueController(prisma as never);

const stamp = Date.now();
let companyId = '';
let outletId = '';
const code = `IMP${stamp}`;

const owner: AuthUser = {
  id: 'test-owner',
  email: 'owner@test',
  role: 'OWNER',
  permissions: [],
  scopeCompanyIds: [],
  scopeOutletIds: [],
  unscoped: true,
};

d('Revenue import (e2e)', () => {
  beforeAll(async () => {
    await prisma.$connect();
    const company = await prisma.company.create({
      data: { name: `ImpTest Co ${stamp}`, slug: `imptest-${stamp}` },
    });
    companyId = company.id;
    const o = await prisma.outlet.create({
      data: { companyId, name: `Imp Outlet ${stamp}`, code, type: 'CAFE' },
    });
    outletId = o.id;
  });

  afterAll(async () => {
    await prisma.revenueEntry.deleteMany({ where: { outletId } });
    await prisma.outlet.delete({ where: { id: outletId } });
    await prisma.company.delete({ where: { id: companyId } });
    await prisma.$disconnect();
  });

  it('imports good rows and accumulates bad-storeCode + unparseable-amount errors', async () => {
    const res = await controller.import(owner, {
      rows: [
        { date: '2026-02-01', storeCode: code, amount: '1.234,56' },
        { date: '2026-02-02', storeCode: 'NOPE', amount: '100' },
        { date: '2026-02-03', storeCode: code, amount: 'abc' },
        { date: '2026-02-04', storeCode: code, amount: 500 },
      ],
      defaultStatus: 'CONFIRMED',
    });

    expect(res.imported).toBe(2);
    expect(res.skipped).toBe(2);
    expect(res.errors).toHaveLength(2);
    expect(res.errors.find((e) => e.row === 1)!.reason).toContain('store code');
    expect(res.errors.find((e) => e.row === 2)!.reason).toContain('Unparseable');

    const entries = await prisma.revenueEntry.findMany({
      where: { outletId, status: 'CONFIRMED' },
      orderBy: { businessDate: 'asc' },
    });
    expect(entries).toHaveLength(2);
    expect(entries[0]!.source).toBe('IMPORT');
    expect(entries[0]!.amount.toFixed(2)).toBe('1234.56');
    expect(entries[0]!.enteredByUserId).toBe(owner.id);
    expect(entries[1]!.amount.toFixed(2)).toBe('500.00');
  });

  it('CONFIRMED import supersedes a prior confirmed entry for the same day', async () => {
    await controller.import(owner, {
      rows: [{ date: '2026-02-01', storeCode: code, amount: '2000' }],
      defaultStatus: 'CONFIRMED',
    });
    const confirmed = await prisma.revenueEntry.findMany({
      where: { outletId, businessDate: new Date('2026-02-01T00:00:00.000Z'), status: 'CONFIRMED' },
    });
    expect(confirmed).toHaveLength(1);
    expect(confirmed[0]!.amount.toFixed(2)).toBe('2000.00');
    const superseded = await prisma.revenueEntry.count({
      where: { outletId, businessDate: new Date('2026-02-01T00:00:00.000Z'), status: 'SUPERSEDED' },
    });
    expect(superseded).toBe(1);
  });
});
