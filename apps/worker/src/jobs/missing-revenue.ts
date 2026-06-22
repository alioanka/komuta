import { PrismaClient } from '@prisma/client';
import { sendTelegram } from '../telegram.js';
import { env } from '../env.js';

function businessDateInTz(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Scan for outlets that have not reported confirmed revenue today and raise a
 * MISSING_REVENUE notification (in-app rows + Telegram via active rules).
 */
export async function runMissingRevenueScan(prisma: PrismaClient): Promise<{ missing: number }> {
  const dateStr = businessDateInTz(new Date(), env.DEFAULT_TIMEZONE);
  const date = new Date(`${dateStr}T00:00:00.000Z`);

  const outlets = await prisma.outlet.findMany({
    where: { isActive: true, expectsDailyRevenue: true },
    include: { company: true },
  });
  const reported = await prisma.revenueEntry.findMany({
    where: { businessDate: date, status: 'CONFIRMED', outletId: { in: outlets.map((o) => o.id) } },
    select: { outletId: true },
  });
  const reportedSet = new Set(reported.map((r) => r.outletId));
  const missing = outlets.filter((o) => !reportedSet.has(o.id));

  if (missing.length === 0) return { missing: 0 };

  const rules = await prisma.notificationRule.findMany({
    where: { event: 'MISSING_REVENUE', isActive: true },
  });
  const title = `Eksik ciro — ${dateStr}`;
  const list = missing.map((o) => `• ${o.name} (${o.company.name})`).join('\n');
  const body = `${missing.length} şube bugün ciro göndermedi:\n${list}`;

  for (const rule of rules) {
    for (const channel of rule.channels) {
      if (channel === 'INAPP') {
        const targets = rule.targetUserIds.length > 0 ? rule.targetUserIds : [null];
        for (const userId of targets) {
          await prisma.notification.create({
            data: {
              userId,
              channel: 'INAPP',
              event: 'MISSING_REVENUE',
              title,
              body,
              status: 'SENT',
              sentAt: new Date(),
            },
          });
        }
      } else if (channel === 'TELEGRAM') {
        const chatIds = rule.targetTelegramChatIds.length > 0 ? rule.targetTelegramChatIds : [undefined];
        for (const chatId of chatIds) {
          await sendTelegram(`<b>${title}</b>\n${body}`, chatId);
        }
      }
    }
  }

  return { missing: missing.length };
}
