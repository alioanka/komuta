'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { AppShell } from '@/components/AppShell';
import { KpiCard } from '@/components/KpiCard';
import { RevenueAreaChart } from '@/components/Charts';
import { DataTable, type Column } from '@/components/DataTable';
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  Skeleton,
} from '@/components/ui';
import { formatDate, formatMoney, formatNumber } from '@/lib/format';
import type { DashboardOverview, MissingOutlet, PerCompany } from '@/lib/types';

export default function OverviewPage() {
  const { t } = useI18n();

  const overview = useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: () => apiFetch<DashboardOverview>('/dashboard/overview'),
  });

  const missing = useQuery({
    queryKey: ['monitor', 'missing'],
    queryFn: () => apiFetch<MissingOutlet[]>('/monitor/missing'),
  });

  const data = overview.data;
  const trendData = (data?.trend ?? []).map((p) => ({ date: p.date, value: Number(p.total) }));
  const reportRate =
    data && data.outletsExpected > 0
      ? Math.round((data.outletsReported / data.outletsExpected) * 100)
      : 0;

  const companyColumns: Column<PerCompany>[] = [
    {
      key: 'name',
      header: t.domain.company,
      render: (c) => (
        <Link href={`/firmalar/${c.companyId}`} className="font-medium text-slate-800 hover:text-brand">
          {c.name}
        </Link>
      ),
    },
    {
      key: 'outlets',
      header: t.nav.outlets,
      align: 'right',
      render: (c) => formatNumber(c.outletCount),
    },
    {
      key: 'reported',
      header: t.status.received,
      align: 'right',
      render: (c) => (
        <Badge tone={c.reported > 0 ? 'success' : 'neutral'}>{formatNumber(c.reported)}</Badge>
      ),
    },
    {
      key: 'total',
      header: t.metrics.revenue,
      align: 'right',
      render: (c) => <span className="font-semibold text-slate-900">{formatMoney(c.totalToday)}</span>,
    },
  ];

  return (
    <AppShell title={t.nav.overview}>
      {overview.isError ? (
        <ErrorState message={(overview.error as Error).message} onRetry={() => overview.refetch()} />
      ) : (
        <div className="space-y-6">
          {/* KPI row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label={`${t.metrics.revenue} (bugün)`}
              value={data ? formatMoney(data.totalRevenueToday) : '—'}
              sub={data ? formatDate(data.date, { day: '2-digit', month: 'long', year: 'numeric' }) : undefined}
              tone="brand"
              loading={overview.isLoading}
            />
            <KpiCard
              label="Raporlayan Şube"
              value={data ? `${data.outletsReported}/${data.outletsExpected}` : '—'}
              sub={data ? `%${reportRate} tamamlandı` : undefined}
              tone="success"
              loading={overview.isLoading}
            />
            <KpiCard
              label="Onay Bekleyen"
              value={data ? formatNumber(data.pendingConfirmations) : '—'}
              sub={t.status.pending}
              tone="warning"
              loading={overview.isLoading}
            />
            <KpiCard
              label="Bugün Eksik"
              value={missing.data ? formatNumber(missing.data.length) : '—'}
              sub={t.status.missing}
              tone="danger"
              loading={missing.isLoading}
            />
          </div>

          {/* Chart + missing panel */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                title={`${t.metrics.revenue} — son 14 gün`}
                subtitle="Onaylanmış toplam ciro trendi"
              />
              <CardBody>
                {overview.isLoading ? (
                  <Skeleton className="h-[280px] w-full" />
                ) : trendData.length === 0 ? (
                  <EmptyState title="Veri yok" description="Henüz ciro kaydı bulunmuyor." />
                ) : (
                  <RevenueAreaChart data={trendData} />
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Bugün Eksik"
                subtitle="Ciro bildirimi bekleyen şubeler"
                action={
                  missing.data && missing.data.length > 0 ? (
                    <Badge tone="danger">{missing.data.length}</Badge>
                  ) : undefined
                }
              />
              <CardBody className="pt-0">
                {missing.isLoading ? (
                  <div className="space-y-2 pt-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : !missing.data || missing.data.length === 0 ? (
                  <EmptyState title="Eksik yok" description="Tüm şubeler bugün raporladı." />
                ) : (
                  <ul className="max-h-[280px] space-y-2 overflow-y-auto pt-2 scrollbar-thin">
                    {missing.data.map((m) => (
                      <li
                        key={m.outletId}
                        className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <Link
                            href={`/sube/${m.outletId}`}
                            className="block truncate text-sm font-medium text-slate-800 hover:text-brand"
                          >
                            {m.name}
                          </Link>
                          <p className="truncate text-xs text-slate-400">{m.company}</p>
                        </div>
                        <span className="ml-2 shrink-0 rounded-md bg-slate-50 px-2 py-0.5 text-xs font-mono text-slate-500">
                          {m.code}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>

          {/* Per-company table */}
          <Card>
            <CardHeader title={t.nav.companies} subtitle="Firma bazında bugünkü performans" />
            {overview.isLoading ? (
              <CardBody>
                <Skeleton className="h-40 w-full" />
              </CardBody>
            ) : (
              <DataTable
                columns={companyColumns}
                rows={data?.perCompany ?? []}
                getRowKey={(c) => c.companyId}
                empty="Firma bulunamadı."
              />
            )}
          </Card>
        </div>
      )}
    </AppShell>
  );
}
