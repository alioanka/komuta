import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { IngestionService } from '../src/whatsapp/ingestion.service.js';
import { businessDateInTz, dateOnly } from '../src/common/date.util.js';

/**
 * End-to-end ingestion test against a real database.
 * Requires DATABASE_URL pointing at a seeded Komuta DB (see /docs/01_LOCAL_DEVELOPMENT.md).
 * Skipped automatically when DATABASE_URL is not set.
 */
const hasDb = !!process.env.DATABASE_URL;
const d = hasDb ? describe : describe.skip;

const prisma = new PrismaClient();
// IngestionService only uses PrismaClient methods → structural compatibility.
// Notifications are stubbed (dispatch is a no-op) for the isolated e2e test.
const notificationsStub = { dispatch: async () => ({ channels: [] }) };
const ingestion = new IngestionService(prisma as never, notificationsStub as never);

let counter = 0;
const wa = () => `wamid.TEST.${Date.now()}.${counter++}`;
const today = dateOnly(businessDateInTz(new Date(), 'Europe/Istanbul'));

d('WhatsApp ingestion (e2e)', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('mapped sender sending only the amount → CONFIRMED revenue for their outlet', async () => {
    const camlica = await prisma.outlet.findUniqueOrThrow({ where: { code: '1234' } });
    const id = wa();
    const decision = await ingestion.handleInbound({
      waMessageId: id,
      fromPhone: '+905551112233', // ACTIVE mapping → Çamlıca
      toPhone: '+900000000000',
      body: '73256,76',
      timestamp: new Date(),
    });
    expect(decision.status).toBe('MAPPED');
    expect(decision.entryStatus).toBe('CONFIRMED');

    const entry = await prisma.revenueEntry.findFirst({
      where: { rawMessageId: id, status: 'CONFIRMED' },
    });
    expect(entry).not.toBeNull();
    expect(entry!.outletId).toBe(camlica.id);
    expect(Number(entry!.amount)).toBe(73256.76);
    expect(entry!.businessDate.toISOString().slice(0, 10)).toBe(today.toISOString().slice(0, 10));
  });

  it('is idempotent — same waMessageId is not double-counted', async () => {
    const id = wa();
    const msg = {
      waMessageId: id,
      fromPhone: '+905551112233',
      toPhone: '+900000000000',
      body: '1000',
      timestamp: new Date(),
    };
    await ingestion.handleInbound(msg);
    const second = await ingestion.handleInbound(msg);
    expect(second.status).toBe('DUPLICATE');
    const count = await prisma.revenueEntry.count({ where: { rawMessageId: id } });
    expect(count).toBe(1);
  });

  it('unknown sender with a valid store code → pending mapping + pending revenue', async () => {
    const phone = `+9055500${String(1000 + counter).padStart(4, '0')}`;
    const id = wa();
    const decision = await ingestion.handleInbound({
      waMessageId: id,
      fromPhone: phone,
      toPhone: '+900000000000',
      body: '1234 9999,50', // store code 1234 = Çamlıca
      timestamp: new Date(),
    });
    expect(decision.status).toBe('NEEDS_CONFIRMATION');
    expect(decision.action).toBe('CREATE_PENDING_MAPPING');

    const mapping = await prisma.phoneMapping.findUnique({ where: { phoneE164: phone } });
    expect(mapping?.status).toBe('PENDING');
    const entry = await prisma.revenueEntry.findFirst({ where: { rawMessageId: id } });
    expect(entry?.status).toBe('PENDING_REVIEW');
  });

  it('unknown sender, no store id → NEEDS_STORE_ID, nothing stored', async () => {
    const phone = `+9055501${String(2000 + counter).padStart(4, '0')}`;
    const id = wa();
    const decision = await ingestion.handleInbound({
      waMessageId: id,
      fromPhone: phone,
      toPhone: '+900000000000',
      body: '5000',
      timestamp: new Date(),
    });
    expect(decision.status).toBe('NEEDS_STORE_ID');
    const entry = await prisma.revenueEntry.findFirst({ where: { rawMessageId: id } });
    expect(entry).toBeNull();
  });

  it('unparseable message → UNPARSEABLE, nothing stored', async () => {
    const id = wa();
    const decision = await ingestion.handleInbound({
      waMessageId: id,
      fromPhone: '+905551112233',
      toPhone: '+900000000000',
      body: 'merhaba nasilsin',
      timestamp: new Date(),
    });
    expect(decision.status).toBe('UNPARSEABLE');
  });

  it('repeat message from a still-PENDING sender → no duplicate mapping row', async () => {
    const phone = `+9055502${String(3000 + counter).padStart(4, '0')}`;
    const first = await ingestion.handleInbound({
      waMessageId: wa(),
      fromPhone: phone,
      toPhone: '+900000000000',
      body: '1234 5000',
      timestamp: new Date(),
    });
    expect(first.action).toBe('CREATE_PENDING_MAPPING');
    const second = await ingestion.handleInbound({
      waMessageId: wa(),
      fromPhone: phone,
      toPhone: '+900000000000',
      body: '1234 6000',
      timestamp: new Date(),
    });
    // Still needs confirmation, entry held for review, but only ONE mapping row.
    expect(second.status).toBe('NEEDS_CONFIRMATION');
    const mappings = await prisma.phoneMapping.count({ where: { phoneE164: phone } });
    expect(mappings).toBe(1);
    const entries = await prisma.revenueEntry.count({
      where: { status: 'PENDING_REVIEW', rawMessageId: { startsWith: 'wamid.TEST.' } },
    });
    expect(entries).toBeGreaterThanOrEqual(2);
  });

  it('BLOCKED sender → message logged, no revenue, no pending mapping', async () => {
    const phone = `+9055503${String(4000 + counter).padStart(4, '0')}`;
    await prisma.phoneMapping.upsert({
      where: { phoneE164: phone },
      create: { phoneE164: phone, status: 'BLOCKED' },
      update: { status: 'BLOCKED', outletId: null },
    });
    const id = wa();
    const decision = await ingestion.handleInbound({
      waMessageId: id,
      fromPhone: phone,
      toPhone: '+900000000000',
      body: '1234 7777', // valid store code + amount — must still be ignored
      timestamp: new Date(),
    });
    expect(decision.status).toBe('BLOCKED');
    expect(decision.action).toBe('IGNORE_BLOCKED');

    const logged = await prisma.whatsAppMessage.findUnique({ where: { waMessageId: id } });
    expect(logged?.resolutionStatus).toBe('BLOCKED');
    const entry = await prisma.revenueEntry.findFirst({ where: { rawMessageId: id } });
    expect(entry).toBeNull();
    const mapping = await prisma.phoneMapping.findUnique({ where: { phoneE164: phone } });
    expect(mapping?.status).toBe('BLOCKED'); // unchanged, no second row possible (unique)
  });

  it('two concurrent webhooks with the same waMessageId store exactly one entry', async () => {
    const id = wa();
    const msg = {
      waMessageId: id,
      fromPhone: '+905551112233',
      toPhone: '+900000000000',
      body: '4321,00',
      timestamp: new Date(),
    };
    const [a, b] = await Promise.all([ingestion.handleInbound(msg), ingestion.handleInbound(msg)]);
    const statuses = [a.status, b.status].sort();
    // One side wins, the other must be treated as a duplicate (never an error).
    expect(statuses).toContain('MAPPED');
    const messages = await prisma.whatsAppMessage.count({ where: { waMessageId: id } });
    expect(messages).toBe(1);
    const entries = await prisma.revenueEntry.count({ where: { rawMessageId: id } });
    expect(entries).toBe(1);
  });
});
