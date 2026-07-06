import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { MappingsController } from '../src/mappings/mappings.controller.js';
import type { AuthUser } from '../src/common/current-user.decorator.js';

/**
 * DB-backed tests for mapping approval: confirming held revenue must be
 * limited to entries that came from the approved mapping's phone.
 * Requires DATABASE_URL (skipped automatically when unset).
 */
const hasDb = !!process.env.DATABASE_URL;
const d = hasDb ? describe : describe.skip;

const prisma = new PrismaClient();
const controller = new MappingsController(prisma as never);

const owner: AuthUser = {
  id: 'test-owner',
  email: 'owner@test',
  role: 'OWNER',
  permissions: [],
  scopeCompanyIds: [],
  scopeOutletIds: [],
  unscoped: true,
};

const stamp = Date.now();
const phoneA = `+90555200${String(stamp).slice(-4)}1`;
const phoneB = `+90555200${String(stamp).slice(-4)}2`;
const day = new Date('2026-07-01T00:00:00.000Z');

let outletId = '';
let companyId = '';
let mappingAId = '';
let entryAId = '';
let entryBId = '';
let priorConfirmedId = '';

d('Mapping approval scoping (e2e)', () => {
  beforeAll(async () => {
    await prisma.$connect();
    const company = await prisma.company.create({
      data: { name: `MapTest Co ${stamp}`, slug: `maptest-${stamp}` },
    });
    companyId = company.id;
    const outlet = await prisma.outlet.create({
      data: {
        companyId,
        name: `MapTest Outlet ${stamp}`,
        code: `MT${stamp}`,
        type: 'CAFE',
      },
    });
    outletId = outlet.id;

    // Two unknown senders each sent a pending revenue message for this outlet.
    await prisma.whatsAppMessage.create({
      data: {
        waMessageId: `wamid.MAP.${stamp}.A`,
        direction: 'IN',
        fromPhone: phoneA,
        toPhone: '+900000000000',
        body: 'test 1000',
        resolutionStatus: 'NEEDS_CONFIRMATION',
      },
    });
    await prisma.whatsAppMessage.create({
      data: {
        waMessageId: `wamid.MAP.${stamp}.B`,
        direction: 'IN',
        fromPhone: phoneB,
        toPhone: '+900000000000',
        body: 'test 2000',
        resolutionStatus: 'NEEDS_CONFIRMATION',
      },
    });
    const entryA = await prisma.revenueEntry.create({
      data: {
        outletId,
        businessDate: day,
        amount: '1000.00',
        source: 'WHATSAPP',
        rawMessageId: `wamid.MAP.${stamp}.A`,
        status: 'PENDING_REVIEW',
      },
    });
    entryAId = entryA.id;
    const entryB = await prisma.revenueEntry.create({
      data: {
        outletId,
        businessDate: day,
        amount: '2000.00',
        source: 'WHATSAPP',
        rawMessageId: `wamid.MAP.${stamp}.B`,
        status: 'PENDING_REVIEW',
      },
    });
    entryBId = entryB.id;
    // A previously confirmed manual entry for the same day (supersede target).
    const prior = await prisma.revenueEntry.create({
      data: { outletId, businessDate: day, amount: '500.00', source: 'MANUAL', status: 'CONFIRMED' },
    });
    priorConfirmedId = prior.id;

    const mappingA = await prisma.phoneMapping.create({
      data: { phoneE164: phoneA, outletId, status: 'PENDING' },
    });
    mappingAId = mappingA.id;
    await prisma.phoneMapping.create({
      data: { phoneE164: phoneB, outletId, status: 'PENDING' },
    });
  });

  afterAll(async () => {
    await prisma.revenueEntry.deleteMany({ where: { outletId } });
    await prisma.phoneMapping.deleteMany({ where: { phoneE164: { in: [phoneA, phoneB] } } });
    await prisma.whatsAppMessage.deleteMany({ where: { fromPhone: { in: [phoneA, phoneB] } } });
    await prisma.outlet.delete({ where: { id: outletId } });
    await prisma.company.delete({ where: { id: companyId } });
    await prisma.$disconnect();
  });

  it('rejects approval for an outlet outside the caller scope', async () => {
    const scopedManager: AuthUser = { ...owner, role: 'MANAGER', unscoped: false };
    await expect(
      controller.approve(scopedManager, { mappingId: mappingAId, outletId }),
    ).rejects.toThrow('Outlet outside your scope');
  });

  it('confirms only the approved sender entries, keeping other senders pending', async () => {
    const mapping = await controller.approve(owner, { mappingId: mappingAId, outletId });
    expect(mapping.status).toBe('ACTIVE');

    const a = await prisma.revenueEntry.findUniqueOrThrow({ where: { id: entryAId } });
    const b = await prisma.revenueEntry.findUniqueOrThrow({ where: { id: entryBId } });
    const prior = await prisma.revenueEntry.findUniqueOrThrow({ where: { id: priorConfirmedId } });

    expect(a.status).toBe('CONFIRMED'); // sender A approved
    expect(b.status).toBe('PENDING_REVIEW'); // sender B untouched
    expect(prior.status).toBe('SUPERSEDED'); // supersede logic preserved

    const confirmed = await prisma.revenueEntry.count({
      where: { outletId, businessDate: day, status: 'CONFIRMED' },
    });
    expect(confirmed).toBe(1); // at most one CONFIRMED per outlet/day
  });

  it('404s on unknown mapping id', async () => {
    await expect(
      controller.approve(owner, { mappingId: 'nonexistent', outletId }),
    ).rejects.toThrow('Mapping not found');
  });
});
