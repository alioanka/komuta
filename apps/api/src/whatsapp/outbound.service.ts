import { Injectable, Logger } from '@nestjs/common';
import { WHATSAPP_SERVICE_WINDOW_MS } from '@komuta/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { loadEnv } from '../config/env.js';

export interface SendResult {
  ok: boolean;
  usedTemplate: boolean;
  waMessageId?: string;
  error?: string;
}

/**
 * Outbound WhatsApp sending via the Meta Cloud API.
 *  - Free-form text is only allowed inside an open 24h customer-service window
 *    (the contact messaged us within the last 24h).
 *  - Otherwise a pre-approved UTILITY template must be used.
 * sendMessage() auto-selects based on the window.
 */
@Injectable()
export class OutboundService {
  private readonly logger = new Logger(OutboundService.name);

  constructor(private readonly prisma: PrismaService) {}

  private graphUrl(path: string): string {
    const env = loadEnv();
    return `https://graph.facebook.com/${env.META_GRAPH_VERSION}/${path}`;
  }

  /**
   * Is the 24h service window open for this phone?
   * Source of truth is the inbound message log, NOT PhoneMapping.lastInboundAt:
   * unknown senders (NEEDS_STORE_ID) have no mapping row yet, but their inbound
   * message still opens the window. `createdAt` is our receive time — close
   * enough to Meta's window semantics.
   */
  async isWindowOpen(phoneE164: string): Promise<boolean> {
    const lastInbound = await this.prisma.whatsAppMessage.findFirst({
      where: { fromPhone: phoneE164, direction: 'IN' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (!lastInbound) return false;
    return Date.now() - lastInbound.createdAt.getTime() < WHATSAPP_SERVICE_WINDOW_MS;
  }

  /** Auto-select free-form text (window open) vs template (closed). */
  async sendMessage(
    toPhone: string,
    opts: { body?: string; templateName?: string; templateVars?: string[] },
  ): Promise<SendResult> {
    const windowOpen = await this.isWindowOpen(toPhone);
    if (windowOpen && opts.body) {
      return this.sendText(toPhone, opts.body);
    }
    if (opts.templateName) {
      return this.sendTemplate(toPhone, opts.templateName, opts.templateVars ?? []);
    }
    // Window closed and no template: cannot send.
    return { ok: false, usedTemplate: false, error: 'window_closed_no_template' };
  }

  async sendText(toPhone: string, body: string): Promise<SendResult> {
    return this.dispatch(toPhone, {
      messaging_product: 'whatsapp',
      to: toPhone,
      type: 'text',
      text: { body },
    }, false, body);
  }

  async sendTemplate(toPhone: string, templateName: string, vars: string[]): Promise<SendResult> {
    const components =
      vars.length > 0
        ? [{ type: 'body', parameters: vars.map((v) => ({ type: 'text', text: v })) }]
        : [];
    return this.dispatch(
      toPhone,
      {
        messaging_product: 'whatsapp',
        to: toPhone,
        type: 'template',
        template: { name: templateName, language: { code: 'tr' }, components },
      },
      true,
      `[template:${templateName}] ${vars.join(' | ')}`,
    );
  }

  private async dispatch(
    toPhone: string,
    payload: Record<string, unknown>,
    usedTemplate: boolean,
    logBody: string,
  ): Promise<SendResult> {
    const env = loadEnv();
    if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
      this.logger.warn('WhatsApp outbound not configured — logging only');
      await this.log(toPhone, logBody, null, 'NOT_CONFIGURED');
      return { ok: false, usedTemplate, error: 'not_configured' };
    }
    try {
      const res = await fetch(this.graphUrl(`${env.WHATSAPP_PHONE_NUMBER_ID}/messages`), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { messages?: { id: string }[]; error?: { message: string } };
      if (!res.ok) {
        await this.log(toPhone, logBody, null, 'FAILED');
        return { ok: false, usedTemplate, error: json.error?.message ?? `http_${res.status}` };
      }
      const waMessageId = json.messages?.[0]?.id;
      await this.log(toPhone, logBody, waMessageId ?? null, 'SENT');
      return { ok: true, usedTemplate, waMessageId };
    } catch (err) {
      this.logger.error('WhatsApp send error', err as Error);
      await this.log(toPhone, logBody, null, 'ERROR');
      return { ok: false, usedTemplate, error: 'network' };
    }
  }

  private async log(
    toPhone: string,
    body: string,
    waMessageId: string | null,
    status: string,
  ): Promise<void> {
    const env = loadEnv();
    await this.prisma.whatsAppMessage.create({
      data: {
        waMessageId: waMessageId ?? `out-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        direction: 'OUT',
        fromPhone: env.WHATSAPP_PHONE_NUMBER_ID || 'komuta',
        toPhone,
        body,
        type: 'text',
        status,
      },
    });
  }
}
