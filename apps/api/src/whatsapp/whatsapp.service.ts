import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { loadEnv } from '../config/env.js';
import type { InboundMessage } from './ingestion.service.js';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  /** Verify Meta's X-Hub-Signature-256 HMAC over the raw request body. */
  verifySignature(rawBody: Buffer | string, signatureHeader: string | undefined): boolean {
    const env = loadEnv();
    if (!env.META_APP_SECRET) {
      // In dev with no secret configured, skip verification but never in production.
      return env.NODE_ENV !== 'production';
    }
    if (!signatureHeader?.startsWith('sha256=')) return false;
    const expected = signatureHeader.slice('sha256='.length);
    const digest = createHmac('sha256', env.META_APP_SECRET)
      .update(rawBody)
      .digest('hex');
    const a = Buffer.from(digest, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  /** Verify the webhook subscription challenge. */
  verifyChallenge(mode: string, token: string, challenge: string): string | null {
    const env = loadEnv();
    if (mode === 'subscribe' && token === env.META_VERIFY_TOKEN) return challenge;
    return null;
  }

  /**
   * Flatten a Meta webhook payload into a list of inbound text messages.
   * When WHATSAPP_PHONE_NUMBER_ID is configured, messages addressed to any
   * other number hosted on the same WABA are skipped — a shared WABA delivers
   * every number's traffic to the same webhook.
   */
  parseInbound(payload: unknown): InboundMessage[] {
    const env = loadEnv();
    const ownPhoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;
    const out: InboundMessage[] = [];
    const body = payload as MetaWebhookBody;
    for (const entry of body?.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        const phoneNumberId = value?.metadata?.phone_number_id;
        if (ownPhoneNumberId && phoneNumberId !== ownPhoneNumberId) {
          const count = value?.messages?.length ?? 0;
          if (count > 0) {
            this.logger.debug(
              `Skipping ${count} message(s) for foreign phone_number_id ${phoneNumberId ?? 'unknown'}`,
            );
          }
          continue;
        }
        const toPhone = value?.metadata?.display_phone_number ?? '';
        for (const m of value?.messages ?? []) {
          if (m.type !== 'text' || !m.text) continue;
          out.push({
            waMessageId: m.id,
            fromPhone: normalizePhone(m.from),
            toPhone: normalizePhone(toPhone),
            body: m.text.body ?? '',
            timestamp: m.timestamp ? new Date(Number(m.timestamp) * 1000) : new Date(),
            rawPayload: m,
          });
        }
      }
    }
    return out;
  }
}

function normalizePhone(p: string): string {
  if (!p) return '';
  const trimmed = p.trim();
  return trimmed.startsWith('+') ? trimmed : `+${trimmed.replace(/[^\d]/g, '')}`;
}

interface MetaWebhookBody {
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: { display_phone_number?: string; phone_number_id?: string };
        messages?: Array<{
          id: string;
          from: string;
          type: string;
          timestamp?: string;
          text?: { body?: string };
        }>;
      };
    }>;
  }>;
}
