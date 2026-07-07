import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { OutletsController } from '../src/org/outlets.controller.js';
import type { AuthUser } from '../src/common/current-user.decorator.js';

/**
 * DB-backed tests for outlet create/update persisting student counts.
 * Requires DATABASE_URL (skipped automatically when unset).
 */
const hasDb = !!process.env.DATABASE_URL;
const d = hasDb ? describe : describe.skip;

const prisma = new PrismaClient();
const controller = new OutletsController(prisma as never);

const stamp = Date.now();
let companyId = '';
let createdOutletId = '';

const owner: AuthUser = {
  id: 'test-owner',
  email: 'owner@test',
  role: 'OWNER',
  permissions: [],
  scopeCompanyIds: [],
  scopeOutletIds: [],
  unscoped: true,
};

d('Outlet student counts (e2e)', () => {
  beforeAll(async () => {
    await prisma.$connect();
    const company = await prisma.company.create({
      data: { name: `StuTest Co ${stamp}`, slug: `stutest-${stamp}` },
    });
    companyId = company.id;
  });

  afterAll(async () => {
    if (createdOutletId) await prisma.outlet.delete({ where: { id: createdOutletId } }).catch(() => {});
    await prisma.company.delete({ where: { id: companyId } });
    await prisma.$disconnect();
  });

  it('create persists studentOrtaokul/studentLise', async () => {
    const outlet = await controller.create({
      companyId,
      name: `Stu Outlet ${stamp}`,
      code: `STU${stamp}`,
      type: 'SCHOOL_CANTEEN',
      expectsDailyRevenue: true,
      studentOrtaokul: 800,
      studentLise: 200,
    });
    createdOutletId = outlet.id;
    expect(outlet.studentOrtaokul).toBe(800);
    expect(outlet.studentLise).toBe(200);
  });

  it('update persists new student counts', async () => {
    const updated = await controller.update(createdOutletId, owner, {
      studentOrtaokul: 950,
      studentLise: 250,
    });
    expect(updated.studentOrtaokul).toBe(950);
    expect(updated.studentLise).toBe(250);
  });
});
