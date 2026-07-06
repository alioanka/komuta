import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DEFAULT_TIMEZONE } from '@komuta/config';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from '../common/current-user.decorator.js';
import { outletScopeWhere } from '../common/scope.js';
import { businessDateInTz, dateOnly } from '../common/date.util.js';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private today(): Date {
    return dateOnly(businessDateInTz(new Date(), DEFAULT_TIMEZONE));
  }

  /** Global KPI overview (scope-aware). */
  async overview(user: AuthUser) {
    const outletWhere = outletScopeWhere(user);
    const outlets = await this.prisma.outlet.findMany({
      where: { isActive: true, ...outletWhere },
      select: { id: true, companyId: true, expectsDailyRevenue: true },
    });
    const outletIds = outlets.map((o) => o.id);
    const expectedIds = outlets.filter((o) => o.expectsDailyRevenue).map((o) => o.id);
    const today = this.today();

    const todayConfirmed = await this.prisma.revenueEntry.findMany({
      where: { outletId: { in: outletIds }, businessDate: today, status: 'CONFIRMED' },
      select: { outletId: true, amount: true },
    });
    const reportedOutletIds = new Set(todayConfirmed.map((r) => r.outletId));
    const totalToday = todayConfirmed.reduce((acc, r) => acc + Number(r.amount), 0);

    const pendingRevenue = await this.prisma.revenueEntry.count({
      where: { outletId: { in: outletIds }, status: 'PENDING_REVIEW' },
    });
    const pendingMappings = await this.prisma.phoneMapping.count({ where: { status: 'PENDING' } });

    const trend = await this.revenueTrend(outletIds, 14);
    const perCompany = await this.perCompany(user, outlets, today);

    return {
      date: businessDateInTz(new Date(), DEFAULT_TIMEZONE),
      totalRevenueToday: totalToday.toFixed(2),
      outletsExpected: expectedIds.length,
      outletsReported: expectedIds.filter((id) => reportedOutletIds.has(id)).length,
      pendingConfirmations: pendingRevenue + pendingMappings,
      trend,
      perCompany,
    };
  }

  private async revenueTrend(outletIds: string[], days: number) {
    const start = new Date(this.today());
    start.setUTCDate(start.getUTCDate() - (days - 1));
    const rows = await this.prisma.revenueEntry.findMany({
      where: { outletId: { in: outletIds }, status: 'CONFIRMED', businessDate: { gte: start } },
      select: { businessDate: true, amount: true },
    });
    const byDate = new Map<string, number>();
    for (const r of rows) {
      const key = r.businessDate.toISOString().slice(0, 10);
      byDate.set(key, (byDate.get(key) ?? 0) + Number(r.amount));
    }
    const out: { date: string; total: string }[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      const key = d.toISOString().slice(0, 10);
      out.push({ date: key, total: (byDate.get(key) ?? 0).toFixed(2) });
    }
    return out;
  }

  /**
   * Per-company KPI breakdown using two grouped queries instead of a per-company
   * loop: the (already scope-filtered) outlets are grouped in memory and today's
   * confirmed revenue is aggregated in a single groupBy on RevenueEntry.
   */
  private async perCompany(
    user: AuthUser,
    outlets: { id: string; companyId: string }[],
    today: Date,
  ) {
    const companies = await this.prisma.company.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const grouped = outlets.length
      ? await this.prisma.revenueEntry.groupBy({
          by: ['outletId'],
          where: { outletId: { in: outlets.map((o) => o.id) }, businessDate: today, status: 'CONFIRMED' },
          _sum: { amount: true },
          _count: { _all: true },
        })
      : [];
    const byOutlet = new Map(grouped.map((g) => [g.outletId, g]));
    const outletsByCompany = new Map<string, string[]>();
    for (const o of outlets) {
      const list = outletsByCompany.get(o.companyId) ?? [];
      list.push(o.id);
      outletsByCompany.set(o.companyId, list);
    }

    const results = [];
    for (const c of companies) {
      const ids = outletsByCompany.get(c.id) ?? [];
      if (ids.length === 0 && !user.unscoped) continue;
      let total = new Prisma.Decimal(0);
      let reported = 0;
      for (const id of ids) {
        const g = byOutlet.get(id);
        if (!g) continue;
        total = total.plus(g._sum.amount ?? 0);
        reported += g._count._all;
      }
      results.push({
        companyId: c.id,
        name: c.name,
        outletCount: ids.length,
        totalToday: total.toFixed(2),
        reported,
      });
    }
    return results;
  }

  /** Full metric set for a single outlet over a date range. */
  async outletDetail(user: AuthUser, outletId: string) {
    const outlet = await this.prisma.outlet.findFirst({
      where: { id: outletId, ...outletScopeWhere(user) },
      include: { company: true, brand: true },
    });
    if (!outlet) return null;

    const [revenue, inventory, payroll, purchases, studentCounts, headcounts] = await Promise.all([
      this.prisma.revenueEntry.findMany({
        where: { outletId, status: 'CONFIRMED' },
        orderBy: { businessDate: 'desc' },
        take: 60,
      }),
      this.prisma.inventorySnapshot.findMany({
        where: { outletId },
        orderBy: { asOfDate: 'desc' },
        take: 12,
      }),
      this.prisma.payrollEntry.findMany({ where: { outletId }, orderBy: { periodMonth: 'desc' }, take: 12 }),
      this.prisma.purchaseEntry.findMany({ where: { outletId }, orderBy: { periodMonth: 'desc' }, take: 12 }),
      this.prisma.studentCount.findMany({ where: { outletId }, orderBy: { periodMonth: 'desc' }, take: 12 }),
      this.prisma.headcountCorrection.findMany({ where: { outletId }, orderBy: { periodMonth: 'desc' }, take: 12 }),
    ]);

    return { outlet, revenue, inventory, payroll, purchases, studentCounts, headcounts };
  }
}
