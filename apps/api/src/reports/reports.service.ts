import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  ReportsRevenueQuery,
  ReportsBranchesQuery,
  ReportGroupBy,
} from '@komuta/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from '../common/current-user.decorator.js';
import { outletScopeWhere } from '../common/scope.js';
import { dateOnly } from '../common/date.util.js';

type OutletMeta = {
  id: string;
  name: string;
  code: string;
  type: string;
  studentOrtaokul: number | null;
  studentLise: number | null;
  company: { id: string; name: string };
  brand: { id: string; name: string } | null;
};

export interface ReportRow {
  key: string;
  label: string;
  total: string;
  count: number;
  avg: string;
}

export interface ReportsRevenueResult {
  rows: ReportRow[];
  totalSum: string;
  totalCount: number;
}

export interface BranchSummary {
  outletId: string;
  name: string;
  code: string;
  company: string;
  brand: string | null;
  type: string;
  studentOrtaokul: number | null;
  studentLise: number | null;
  studentTotal: number;
  totalRevenue: string;
  dayCount: number;
  avgDailyRevenue: string;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build the scope- and filter-constrained Outlet `where`. Scope (OR fragment)
   * and the explicit filters combine with AND, so a caller can never widen past
   * their own scope.
   */
  private outletWhere(
    user: AuthUser,
    q: { companyId?: string; brandId?: string; outletId?: string; type?: string },
  ): Prisma.OutletWhereInput {
    const where: Prisma.OutletWhereInput = { ...(outletScopeWhere(user) as Prisma.OutletWhereInput) };
    if (q.companyId) where.companyId = q.companyId;
    if (q.brandId) where.brandId = q.brandId;
    if (q.outletId) where.id = q.outletId;
    if (q.type) where.type = q.type as Prisma.OutletWhereInput['type'];
    return where;
  }

  private revenueDateWhere(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
    const gte = from ? dateOnly(from) : undefined;
    const lte = to ? dateOnly(to) : undefined;
    if (!gte && !lte) return undefined;
    return { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
  }

  private async loadOutlets(where: Prisma.OutletWhereInput): Promise<OutletMeta[]> {
    const outlets = await this.prisma.outlet.findMany({
      where,
      select: {
        id: true,
        name: true,
        code: true,
        type: true,
        studentOrtaokul: true,
        studentLise: true,
        company: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
      },
    });
    return outlets as OutletMeta[];
  }

  /** Aggregate scoped revenue into grouped rows. */
  async revenue(user: AuthUser, q: ReportsRevenueQuery): Promise<ReportsRevenueResult> {
    const outlets = await this.loadOutlets(this.outletWhere(user, q));
    const byId = new Map(outlets.map((o) => [o.id, o]));
    const outletIds = outlets.map((o) => o.id);

    if (outletIds.length === 0) {
      return { rows: [], totalSum: '0.00', totalCount: 0 };
    }

    const dateWhere = this.revenueDateWhere(q.from, q.to);
    const entries = await this.prisma.revenueEntry.findMany({
      where: {
        outletId: { in: outletIds },
        status: q.status,
        ...(dateWhere ? { businessDate: dateWhere } : {}),
      },
      select: { outletId: true, businessDate: true, amount: true },
    });

    const groups = new Map<string, { label: string; total: Prisma.Decimal; count: number }>();
    let totalSum = new Prisma.Decimal(0);

    for (const e of entries) {
      const meta = byId.get(e.outletId);
      if (!meta) continue;
      const { key, label } = this.groupKey(q.groupBy, e.businessDate, meta);
      const g = groups.get(key) ?? { label, total: new Prisma.Decimal(0), count: 0 };
      g.total = g.total.plus(e.amount);
      g.count += 1;
      groups.set(key, g);
      totalSum = totalSum.plus(e.amount);
    }

    const rows: ReportRow[] = Array.from(groups.entries()).map(([key, g]) => ({
      key,
      label: g.label,
      total: g.total.toFixed(2),
      count: g.count,
      avg: g.count > 0 ? g.total.div(g.count).toFixed(2) : '0.00',
    }));

    // Time buckets read best chronologically; entity buckets by size.
    if (q.groupBy === 'day' || q.groupBy === 'month') {
      rows.sort((a, b) => a.key.localeCompare(b.key));
    } else {
      rows.sort((a, b) => Number(b.total) - Number(a.total));
    }

    return {
      rows,
      totalSum: totalSum.toFixed(2),
      totalCount: entries.length,
    };
  }

  private groupKey(
    groupBy: ReportGroupBy,
    businessDate: Date,
    meta: OutletMeta,
  ): { key: string; label: string } {
    const iso = businessDate.toISOString().slice(0, 10);
    switch (groupBy) {
      case 'day':
        return { key: iso, label: iso };
      case 'month': {
        const ym = iso.slice(0, 7);
        return { key: ym, label: ym };
      }
      case 'outlet':
        return { key: meta.id, label: meta.name };
      case 'company':
        return { key: meta.company.id, label: meta.company.name };
      case 'brand':
        return meta.brand
          ? { key: meta.brand.id, label: meta.brand.name }
          : { key: '__none__', label: 'Markasız' };
      default:
        return { key: iso, label: iso };
    }
  }

  /** Per-branch revenue + student summary, sorted by total revenue desc. */
  async branches(user: AuthUser, q: ReportsBranchesQuery): Promise<BranchSummary[]> {
    const outlets = await this.loadOutlets(this.outletWhere(user, q));
    const outletIds = outlets.map((o) => o.id);

    const totals = new Map<string, Prisma.Decimal>();
    const days = new Map<string, Set<string>>();

    if (outletIds.length > 0) {
      const dateWhere = this.revenueDateWhere(q.from, q.to);
      const entries = await this.prisma.revenueEntry.findMany({
        where: {
          outletId: { in: outletIds },
          status: q.status,
          ...(dateWhere ? { businessDate: dateWhere } : {}),
        },
        select: { outletId: true, businessDate: true, amount: true },
      });
      for (const e of entries) {
        totals.set(e.outletId, (totals.get(e.outletId) ?? new Prisma.Decimal(0)).plus(e.amount));
        const set = days.get(e.outletId) ?? new Set<string>();
        set.add(e.businessDate.toISOString().slice(0, 10));
        days.set(e.outletId, set);
      }
    }

    const rows: BranchSummary[] = outlets.map((o) => {
      const total = totals.get(o.id) ?? new Prisma.Decimal(0);
      const dayCount = days.get(o.id)?.size ?? 0;
      const ortaokul = o.studentOrtaokul ?? 0;
      const lise = o.studentLise ?? 0;
      return {
        outletId: o.id,
        name: o.name,
        code: o.code,
        company: o.company.name,
        brand: o.brand?.name ?? null,
        type: o.type,
        studentOrtaokul: o.studentOrtaokul,
        studentLise: o.studentLise,
        studentTotal: ortaokul + lise,
        totalRevenue: total.toFixed(2),
        dayCount,
        avgDailyRevenue: dayCount > 0 ? total.div(dayCount).toFixed(2) : '0.00',
      };
    });

    rows.sort((a, b) => Number(b.totalRevenue) - Number(a.totalRevenue));
    return rows;
  }
}
