import { Injectable, Logger } from '@nestjs/common';
import { extractMessage, normalizeTr } from '@komuta/money';
import {
  decideResolution,
  resolveStoreFromTokens,
  type OutletCandidate,
  type EmployeeCandidate,
  type ResolutionDecision,
} from '@komuta/shared';
import { DEFAULT_TIMEZONE } from '@komuta/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { businessDateInTz, dateOnly } from '../common/date.util.js';

export interface InboundMessage {
  waMessageId: string;
  fromPhone: string;
  toPhone: string;
  body: string;
  timestamp: Date;
  rawPayload?: unknown;
}

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Process one inbound WhatsApp message end-to-end. Idempotent by waMessageId. */
  async handleInbound(msg: InboundMessage): Promise<ResolutionDecision> {
    // 1. Idempotency.
    const existing = await this.prisma.whatsAppMessage.findUnique({
      where: { waMessageId: msg.waMessageId },
    });
    if (existing) {
      return {
        status: 'DUPLICATE',
        outletId: null,
        entryStatus: null,
        action: 'IGNORE_DUPLICATE',
        reason: 'already processed',
      };
    }

    // 2. Extract amount + prefix tokens.
    const extracted = extractMessage(msg.body);

    // 3. Sender mapping → mapped outlet ids (ACTIVE only).
    const mapping = await this.prisma.phoneMapping.findUnique({
      where: { phoneE164: msg.fromPhone },
      include: { links: true },
    });
    const mappedOutletIds: string[] = [];
    if (mapping && mapping.status === 'ACTIVE') {
      if (mapping.outletId) mappedOutletIds.push(mapping.outletId);
      for (const l of mapping.links) mappedOutletIds.push(l.outletId);
    }

    // 4. Resolve store from prefix tokens.
    const storeOutletId = await this.resolveStore(extracted.prefixTokens);

    // 5. Decide.
    const decision = decideResolution({
      isDuplicate: false,
      amountStatus: extracted.amountStatus,
      mappedOutletIds: [...new Set(mappedOutletIds)],
      storeOutletId,
    });

    // 6. Persist the raw message log.
    await this.prisma.whatsAppMessage.create({
      data: {
        waMessageId: msg.waMessageId,
        direction: 'IN',
        fromPhone: msg.fromPhone,
        toPhone: msg.toPhone,
        body: msg.body,
        type: 'text',
        parsedAmount: extracted.amount ? extracted.amount.toFixed(2) : null,
        resolvedOutletId: decision.outletId,
        resolutionStatus: decision.status,
        rawPayload: (msg.rawPayload ?? undefined) as object | undefined,
      },
    });

    // 7. Track 24h window.
    if (mapping) {
      await this.prisma.phoneMapping.update({
        where: { id: mapping.id },
        data: { lastInboundAt: msg.timestamp },
      });
    }

    // 8. Store revenue when the decision says so.
    if (decision.outletId && decision.entryStatus && extracted.amount) {
      const outlet = await this.prisma.outlet.findUnique({ where: { id: decision.outletId } });
      const tz = outlet?.reportingTimezone ?? DEFAULT_TIMEZONE;
      const businessDate = dateOnly(businessDateInTz(msg.timestamp, tz));

      if (decision.entryStatus === 'CONFIRMED') {
        // Supersede any prior confirmed entry for the same outlet/day (keep history).
        await this.prisma.revenueEntry.updateMany({
          where: { outletId: decision.outletId, businessDate, status: 'CONFIRMED' },
          data: { status: 'SUPERSEDED' },
        });
      }

      await this.prisma.revenueEntry.create({
        data: {
          outletId: decision.outletId,
          businessDate,
          amount: extracted.amount.toFixed(2),
          source: 'WHATSAPP',
          rawMessageId: msg.waMessageId,
          status: decision.entryStatus,
        },
      });
    }

    // 9. Create a PENDING mapping when an unknown sender resolved to a store.
    if (decision.action === 'CREATE_PENDING_MAPPING' && decision.outletId && !mapping) {
      await this.prisma.phoneMapping.create({
        data: {
          phoneE164: msg.fromPhone,
          outletId: decision.outletId,
          status: 'PENDING',
          lastInboundAt: msg.timestamp,
        },
      });
    }

    this.logger.log(`Inbound ${msg.waMessageId}: ${decision.status} (${decision.reason})`);
    return decision;
  }

  /** Build outlet/employee candidate lists and resolve a store from the prefix tokens. */
  private async resolveStore(prefixTokens: string[]): Promise<string | null> {
    if (prefixTokens.length === 0) return null;

    const outlets = await this.prisma.outlet.findMany({
      where: { isActive: true },
      include: { aliases: true },
    });
    const candidates: OutletCandidate[] = outlets.map((o) => ({
      outletId: o.id,
      code: o.code,
      normalizedNames: [normalizeTr(o.name), ...o.aliases.map((a) => a.normalizedAlias)],
    }));

    const employees = await this.prisma.employee.findMany({ where: { isActive: true } });
    const empCandidates: EmployeeCandidate[] = employees.map((e) => ({
      employeeId: e.id,
      outletId: e.outletId,
      normalizedName: e.normalizedName,
    }));

    const resolved = resolveStoreFromTokens(prefixTokens, candidates, empCandidates);
    return resolved?.outletId ?? null;
  }
}
