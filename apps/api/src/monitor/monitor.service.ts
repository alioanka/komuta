import { Injectable } from '@nestjs/common';
import { DEFAULT_TIMEZONE } from '@komuta/config';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from '../common/current-user.decorator.js';
import { outletScopeWhere } from '../common/scope.js';
import { businessDateInTz, dateOnly } from '../common/date.util.js';

export type CellStatus = 'received' | 'missing' | 'pending';

@Injectable()
export class MonitorService {
  constructor(private readonly prisma: PrismaService) {}

  /** Build an outlets × recent-dates matrix of reporting status. */
  async matrix(user: AuthUser, days = 7) {
    const todayStr = businessDateInTz(new Date(), DEFAULT_TIMEZONE);
    const today = dateOnly(todayStr);
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - (days - 1));

    const dates: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      dates.push(d.toISOString().slice(0, 10));
    }

    const outlets = await this.prisma.outlet.findMany({
      where: { isActive: true, expectsDailyRevenue: true, ...outletScopeWhere(user) },
      include: { company: true },
      orderBy: { name: 'asc' },
    });
    const outletIds = outlets.map((o) => o.id);

    const entries = await this.prisma.revenueEntry.findMany({
      where: {
        outletId: { in: outletIds },
        businessDate: { gte: start, lte: today },
        status: { in: ['CONFIRMED', 'PENDING_REVIEW'] },
      },
      select: { outletId: true, businessDate: true, status: true },
    });

    const key = (oid: string, d: string) => `${oid}|${d}`;
    const lookup = new Map<string, CellStatus>();
    for (const e of entries) {
      const d = e.businessDate.toISOString().slice(0, 10);
      const k = key(e.outletId, d);
      const status: CellStatus = e.status === 'CONFIRMED' ? 'received' : 'pending';
      // CONFIRMED wins over pending.
      if (status === 'received' || !lookup.has(k)) lookup.set(k, status);
    }

    const rows = outlets.map((o) => ({
      outletId: o.id,
      name: o.name,
      code: o.code,
      company: o.company.name,
      cells: dates.map((d) => ({ date: d, status: lookup.get(key(o.id, d)) ?? 'missing' })),
    }));

    return { dates, rows };
  }

  /** Outlets with no confirmed revenue for a specific date. */
  async missingForDate(user: AuthUser, dateStr: string) {
    const date = dateOnly(dateStr);
    const outlets = await this.prisma.outlet.findMany({
      where: { isActive: true, expectsDailyRevenue: true, ...outletScopeWhere(user) },
      include: { company: true },
    });
    const reported = await this.prisma.revenueEntry.findMany({
      where: { businessDate: date, status: 'CONFIRMED', outletId: { in: outlets.map((o) => o.id) } },
      select: { outletId: true },
    });
    const reportedSet = new Set(reported.map((r) => r.outletId));
    return outlets
      .filter((o) => !reportedSet.has(o.id))
      .map((o) => ({ outletId: o.id, name: o.name, code: o.code, company: o.company.name }));
  }
}
