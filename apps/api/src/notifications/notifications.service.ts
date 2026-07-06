import { Injectable, Logger } from '@nestjs/common';
import { Subject } from 'rxjs';
import type { NotificationChannel, NotificationEvent } from '@komuta/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { TelegramService, escapeTelegramHtml } from './telegram.service.js';
import { OutboundService } from '../whatsapp/outbound.service.js';

export interface DispatchInput {
  event: NotificationEvent;
  title: string;
  body: string;
  payload?: Record<string, unknown>;
  /** Optional explicit user targets (overrides rule targets for in-app). */
  userIds?: string[];
}

interface InAppEvent {
  id: string;
  event: NotificationEvent;
  title: string;
  body: string;
  createdAt: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  /** Per-user SSE streams for in-app notifications. */
  private readonly streams = new Map<string, Subject<InAppEvent>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
    private readonly outbound: OutboundService,
  ) {}

  stream(userId: string): Subject<InAppEvent> {
    let s = this.streams.get(userId);
    if (!s) {
      s = new Subject<InAppEvent>();
      this.streams.set(userId, s);
    }
    return s;
  }

  /** Dispatch an event to all matching active rules and their channels. */
  async dispatch(input: DispatchInput): Promise<{ channels: NotificationChannel[] }> {
    const rules = await this.prisma.notificationRule.findMany({
      where: { event: input.event, isActive: true },
    });
    const channels = new Set<NotificationChannel>();

    for (const rule of rules) {
      for (const channel of rule.channels) {
        channels.add(channel);
        if (channel === 'INAPP') {
          const userIds = input.userIds ?? rule.targetUserIds;
          await this.emitInApp(channel, input, userIds);
        } else if (channel === 'TELEGRAM') {
          const chatIds = rule.targetTelegramChatIds.length > 0 ? rule.targetTelegramChatIds : [undefined];
          for (const chatId of chatIds) {
            await this.telegram.sendMessage(
              `<b>${escapeTelegramHtml(input.title)}</b>\n${escapeTelegramHtml(input.body)}`,
              chatId,
            );
          }
        } else if (channel === 'WHATSAPP') {
          const phone = (input.payload?.toPhone as string | undefined) ?? undefined;
          if (phone) {
            await this.outbound.sendMessage(phone, {
              body: `${input.title}\n${input.body}`,
              templateName: input.payload?.templateName as string | undefined,
              templateVars: input.payload?.templateVars as string[] | undefined,
            });
          }
        }
      }
    }
    this.logger.log(`Dispatched ${input.event} via [${[...channels].join(', ')}]`);
    return { channels: [...channels] };
  }

  private async emitInApp(
    channel: NotificationChannel,
    input: DispatchInput,
    userIds: string[],
  ): Promise<void> {
    const targets = userIds.length > 0 ? userIds : [null];
    for (const userId of targets) {
      const row = await this.prisma.notification.create({
        data: {
          userId,
          channel,
          event: input.event,
          title: input.title,
          body: input.body,
          payload: (input.payload ?? undefined) as object | undefined,
          status: 'SENT',
          sentAt: new Date(),
        },
      });
      if (userId) {
        this.stream(userId).next({
          id: row.id,
          event: input.event,
          title: input.title,
          body: input.body,
          createdAt: row.createdAt.toISOString(),
        });
      }
    }
  }

  async list(userId: string) {
    return this.prisma.notification.findMany({
      where: { OR: [{ userId }, { userId: null }] },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(userId: string, id: string) {
    return this.prisma.notification.updateMany({
      where: { id, OR: [{ userId }, { userId: null }] },
      data: { readAt: new Date() },
    });
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { readAt: null, OR: [{ userId }, { userId: null }] },
    });
  }

  /** Test a channel end-to-end ("send test alert"). */
  async testChannel(channel: NotificationChannel, userId: string): Promise<boolean> {
    if (channel === 'TELEGRAM') return this.telegram.sendMessage('🔔 Komuta test bildirimi');
    if (channel === 'INAPP') {
      await this.emitInApp('INAPP', {
        event: 'DAILY_SUMMARY',
        title: 'Test bildirimi',
        body: 'In-app bildirim kanalı çalışıyor.',
      }, [userId]);
      return true;
    }
    // WHATSAPP test requires a target phone; treated as not-applicable here.
    return false;
  }
}
