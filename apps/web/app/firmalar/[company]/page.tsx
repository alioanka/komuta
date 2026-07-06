'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { AppShell } from '@/components/AppShell';
import { KpiCard } from '@/components/KpiCard';
import { RevenueAreaChart } from '@/components/Charts';
import { DataTable, type Column } from '@/components/DataTable';
import { Badge, Card, CardBody, CardHeader, EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { formatMoney, formatNumber } from '@/lib/format';
import { outletTypeLabel } from '@/lib/labels';
import type { Company, Outlet, RevenueEntry } from '@/lib/types';

const TREND_DAYS = 14;

/** Local date as YYYY-MM-DD, offset by `deltaDays`. */
function localDate(deltaDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + deltaDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function CompanyDetailPage() {
  const { t } = useI18n();
  const params = useParams<{ company: string }>();
  const companyId = params.company;

  const companies = useQuery({
    queryKey: ['companies'],
    queryFn: () => apiFetch<Company[]>('/companies'),
  });

  const outlets = useQuery({
    queryKey: ['outlets'],
    queryFn: () => apiFetch<Outlet[]>('/outlets'),
  });

  const company = companies.data?.find((c) => c.id === companyId);
  const companyOutlets = useMemo(
    () => (outlets.data ?? []).filter((o) => o.companyId === companyId),
    [outlets.data, companyId],
  );

  const expectsCount = companyOutlets.filter((o) => o.expectsDailyRevenue).length;

  // Lightweight company trend: fetch the recent revenue window once and
  // aggregate per-day for this company's outlets on the client.
  const from = localDate(-(TREND_DAYS - 1));
  const to = localDate(0);
  const revenue = useQuery({
    queryKey: ['revenue', 'range', from, to],
    queryFn: () => apiFetch<RevenueEntry[]>(`/revenue?from=${from}&to=${to}`),
  });

  const trend = useMemo(() => {
    const outletIds = new Set(companyOutlets.map((o) => o.id));
    const byDate = new Map<string, number>();
    for (let i = 0; i < TREND_DAYS; i++) byDate.set(localDate(-(TREND_DAYS - 1) + i), 0);
    for (const entry of revenue.data ?? []) {
      if (entry.status !== 'CONFIRMED' || !outletIds.has(entry.outletId)) continue;
      const day = entry.businessDate.slice(0, 10);
      if (byDate.has(day)) byDate.set(day, (byDate.get(day) ?? 0) + Number(entry.amount));
    }
    return [...byDate.entries()].map(([date, value]) => ({ date, value }));
  }, [revenue.data, companyOutlets]);

  const trendTotal = trend.reduce((sum, p) => sum + p.value, 0);
  const hasTrendData = trend.some((p) => p.value > 0);

  const columns: Column<Outlet>[] = [
    {
      key: 'name',
      header: t.domain.outlet,
      render: (o) => (
        <Link href={`/sube/${o.id}`} className="font-medium text-slate-800 hover:text-brand">
          {o.name}
        </Link>
      ),
    },
    {
      key: 'code',
      header: 'Kod',
      render: (o) => <span className="font-mono text-xs text-slate-500">{o.code}</span>,
    },
    { key: 'type', header: 'Tür', render: (o) => outletTypeLabel(o.type, t) },
    { key: 'city', header: 'Şehir', render: (o) => o.city ?? '—' },
    {
      key: 'expects',
      header: 'Günlük Ciro',
      align: 'center',
      render: (o) =>
        o.expectsDailyRevenue ? <Badge tone="success">Evet</Badge> : <Badge tone="neutral">Hayır</Badge>,
    },
  ];

  const isError = companies.isError || outlets.isError;
  const isLoading = companies.isLoading || outlets.isLoading;

  return (
    <AppShell title={company?.name ?? t.domain.company} subtitle="Firma detayı ve şube performansı">
      <div className="mb-5">
        <Link href="/firmalar" className="text-sm text-slate-500 hover:text-brand">
          ← {t.nav.companies}
        </Link>
      </div>

      {isError ? (
        <ErrorState
          message={((companies.error || outlets.error) as Error)?.message ?? 'Hata'}
          onRetry={() => {
            companies.refetch();
            outlets.refetch();
          }}
        />
      ) : !isLoading && !company ? (
        <EmptyState title={t.errors.notFound} description="Bu firma bulunamadı veya yetkiniz yok." />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KpiCard
              label={t.nav.outlets}
              value={formatNumber(companyOutlets.length)}
              tone="brand"
              loading={isLoading}
            />
            <KpiCard
              label="Günlük Ciro Beklenen"
              value={formatNumber(expectsCount)}
              tone="accent"
              loading={isLoading}
            />
            <KpiCard
              label={t.domain.brand}
              value={formatNumber(company?.brands.length ?? 0)}
              tone="success"
              loading={isLoading}
            />
          </div>

          {/* Company revenue trend */}
          <Card>
            <CardHeader
              title={`${t.metrics.revenue} — son ${TREND_DAYS} gün`}
              subtitle="Şubelerin onaylanmış günlük toplamı"
              action={
                !revenue.isLoading && hasTrendData ? (
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Toplam</p>
                    <p className="text-sm font-semibold tabular-nums text-slate-800">
                      {formatMoney(trendTotal)}
                    </p>
                  </div>
                ) : undefined
              }
            />
            <CardBody>
              {revenue.isLoading || isLoading ? (
                <Skeleton className="h-[220px] w-full" />
              ) : !hasTrendData ? (
                <EmptyState
                  title="Ciro yok"
                  description="Bu dönemde firmaya ait onaylanmış ciro kaydı bulunmuyor."
                />
              ) : (
                <RevenueAreaChart data={trend} height={220} />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t.nav.outlets} subtitle={`${company?.name ?? ''} şubeleri`} />
            <DataTable
              columns={columns}
              rows={companyOutlets}
              getRowKey={(o) => o.id}
              empty="Bu firmaya ait şube yok."
            />
          </Card>
        </div>
      )}
    </AppShell>
  );
}
