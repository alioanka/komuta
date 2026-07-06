import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Unit tests for WhatsAppService.parseInbound — no DB required.
 * Uses vi.resetModules so each test gets a fresh loadEnv() cache.
 */

function payload(phoneNumberId: string | undefined, messageId = 'wamid.X1') {
  return {
    entry: [
      {
        changes: [
          {
            value: {
              metadata: {
                display_phone_number: '900000000000',
                ...(phoneNumberId ? { phone_number_id: phoneNumberId } : {}),
              },
              messages: [
                {
                  id: messageId,
                  from: '905551112233',
                  type: 'text',
                  timestamp: '1700000000',
                  text: { body: '73256,76' },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

async function freshService(env: Record<string, string>) {
  vi.resetModules();
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://unused/test';
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  for (const [k, v] of Object.entries(env)) process.env[k] = v;
  const { WhatsAppService } = await import('../src/whatsapp/whatsapp.service.js');
  return new WhatsAppService();
}

describe('WhatsAppService.parseInbound phone_number_id filtering', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('accepts messages addressed to the configured phone_number_id', async () => {
    const svc = await freshService({ WHATSAPP_PHONE_NUMBER_ID: '111111' });
    const msgs = svc.parseInbound(payload('111111'));
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.fromPhone).toBe('+905551112233');
    expect(msgs[0]!.body).toBe('73256,76');
  });

  it('skips messages addressed to another number on the same WABA', async () => {
    const svc = await freshService({ WHATSAPP_PHONE_NUMBER_ID: '111111' });
    expect(svc.parseInbound(payload('222222'))).toHaveLength(0);
  });

  it('skips messages with no phone_number_id metadata when a number is configured', async () => {
    const svc = await freshService({ WHATSAPP_PHONE_NUMBER_ID: '111111' });
    expect(svc.parseInbound(payload(undefined))).toHaveLength(0);
  });

  it('accepts everything when WHATSAPP_PHONE_NUMBER_ID is unset (dev mode)', async () => {
    const svc = await freshService({});
    expect(svc.parseInbound(payload('222222'))).toHaveLength(1);
    expect(svc.parseInbound(payload(undefined))).toHaveLength(1);
  });

  it('mixed payload keeps only own-number messages', async () => {
    const svc = await freshService({ WHATSAPP_PHONE_NUMBER_ID: '111111' });
    const mixed = {
      entry: [
        ...payload('111111', 'wamid.OWN').entry,
        ...payload('222222', 'wamid.FOREIGN').entry,
      ],
    };
    const msgs = svc.parseInbound(mixed);
    expect(msgs.map((m) => m.waMessageId)).toEqual(['wamid.OWN']);
  });
});
