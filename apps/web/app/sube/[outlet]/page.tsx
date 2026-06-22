'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { AppShell } from '@/components/AppShell';
import { RevenueAreaChart } from '@/components/Charts';
import { DataTable, type Column } from '@/components/DataTable';
import { Badge, Card, CardBody, CardHeader, EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { formatDate, formatMoney, formatMonth, formatNumber } from '@/lib/format';
import { entryStatusLabel, outletTypeLabel } from '@/lib/labels';
import type {
  HeadcountCorrection,
  InventorySnapshot,
  OutletDetail,
  PayrollEntry,
  PurchaseEntry,
  RevenueEntry,
  StudentCount,
} from '@/lib/types';

export default function OutletDetailPage() {
  const { t } = useI18n();
  const params = useParams<{ outlet: string }>();
  const outletId = params.outlet;

  const detail = useQuery({
    queryKey: ['outlet', outletId],
    queryFn: () => apiFetch<OutletDetail>(`/dashboard/outlet/${outletId}`),
  });

  const data = detail.data;

  // Revenue trend: API returns newest-first; reverse for the chart.
  const trend = useMemo(() => {
    if (!data) return [];
    return [...data.revenue]
      .reverse()
      .map((r) => ({ date: r.businessDate.slice(0, 10), value: Number(r.amount) }));
  }, [data]);

  const revenueCols: Column<RevenueEntry>[] = [
    { key: 'date', header: 'Tarih', render: (r) => formatDate(r.businessDate, { day: '2-digit', month: 'short', year: 'numeric' }) },
    { key: 'amount', header: t.metrics.revenue, align: 'right', render: (r) => <span className="font-semibold">{formatMoney(r.amount, true)}</span> },
    { key: 'status', header: 'Durum', render: (r) => <Badge tone={r.status === 'CONFIRMED' ? 'success' : 'warning'}>{entryStatusLabel(r.status, t)}</Badge> },
  ];

  const inventoryCols: Column<InventorySnapshot>[] = [
    { key: 'date', header: 'Tarih', render: (r) => formatDate(r.asOfDate, { day: '2-digit', month: 'short', year: 'numeric' }) },
    { key: 'value', header: t.metrics.inventory, align: 'right', render: (r) => formatMoney(r.stockValue, true) },
    { key: 'note', header: 'Not', render: (r) => r.note ?? '—' },
  ];

  const payrollCols: Column<PayrollEntry>[] = [
    { key: 'period', header: 'Dönem', render: (r) => formatMonth(r.periodMonth) },
    { key: 'salary', header: t.metrics.payroll, align: 'right', render: (r) => formatMoney(r.totalSalary, true) },
    { key: 'count', header: t.metrics.employeeCount, align: 'right', render: (r) => (r.employeeCount != null ? formatNumber(r.employeeCount) : '—') },
  ];

  const purchaseCols: Column<PurchaseEntry>[] = [
    { key: 'period', header: 'Dönem', render: (r) => formatMonth(r.periodMonth) },
    { key: 'amount', header: t.metrics.purchases, align: 'right', render: (r) => formatMoney(r.amount, true) },
    { key: 'note', header: 'Not', render: (r) => r.note ?? '—' },
  ];

  const studentCols: Column<StudentCount>[] = [
    { key: 'period', header: 'Dönem', render: (r) => formatMonth(r.periodMonth) },
    { key: 'ortaokul', header: t.metrics.ortaokul, align: 'right', render: (r) => formatNumber(r.ortaokul) },
    { key: 'lise', header: t.metrics.lise, align: 'right', render: (r) => formatNumber(r.lise) },
    { key: 'total', header: 'Toplam', align: 'right', render: (r) => <span className="font-semibold">{formatNumber(r.ortaokul + r.lise)}</span> },
  ];

  const headcountCols: Column<HeadcountCorrection>[] = [
    { key: 'period', header: 'Dönem', render: (r) => formatMonth(r.periodMonth) },
    { key: 'count', header: t.metrics.employeeCount, align: 'right', render: (r) => formatNumber(r.employeeCount) },
    { key: 'reason', header: 'Açıklama', render: (r) => r.reason ?? '—' },
  ];

  const latestRevenue = data?.revenue[0];

  return (
    <AppShell title={data?.outlet.name ?? t.domain.outlet}>
      <div className="mb-5">
        <Link href="/monitor" className="text-sm text-slate-500 hover:text-brand">
          ← {t.nav.monitor}
        </Link>
      </div>

      {detail.isError ? (
        <ErrorState message={(detail.error as Error).message} onRetry={() => detail.refetch()} />
      ) : detail.isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-80 w-full rounded-2xl" />
        </div>
      ) : !data ? (
        <EmptyState title={t.errors.notFound} description="Bu şube bulunamadı veya yetkiniz yok." />
      ) : (
        <div className="space-y-6">
          {/* Header card */}
          <Card>
            <CardBody className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-lg font-semibold text-brand">
                  {data.outlet.name.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{data.outlet.name}</h2>
                  <p className="text-sm text-slate-500">
                    <Link href={`/firmalar/${data.outlet.company.id}`} className="hover:text-brand">
                      {data.outlet.company.name}
                    </Link>
                    {' · '}
                    {outletTypeLabel(data.outlet.type, t)}
                    {data.outlet.city ? ` · ${data.outlet.city}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-slate-50 px-2.5 py-1 font-mono text-xs text-slate-500">
                  {data.outlet.code}
                </span>
                {data.outlet.expectsDailyRevenue && <Badge tone="accent">Günlük ciro</Badge>}
              </div>
            </CardBody>
          </Card>

          {/* Revenue trend */}
          <Card>
            <CardHeader
              title={`${t.metrics.revenue} trendi`}
              subtitle="Son onaylı ciro kayıtları"
              action={
                latestRevenue ? (
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Son</p>
                    <p className="text-sm font-semibold text-slate-800">
                      {formatMoney(latestRevenue.amount)}
                    </p>
                  </div>
                ) : undefined
              }
            />
            <CardBody>
              {trend.length === 0 ? (
                <EmptyState title="Ciro yok" description="Henüz ciro kaydı bulunmuyor." />
              ) : (
                <RevenueAreaChart data={trend} />
              )}
            </CardBody>
          </Card>

          {/* Metric tables */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader title={t.metrics.inventory} />
              <DataTable columns={inventoryCols} rows={data.inventory} getRowKey={(r) => r.id} empty="Kayıt yok." />
            </Card>
            <Card>
              <CardHeader title={t.metrics.payroll} />
              <DataTable columns={payrollCols} rows={data.payroll} getRowKey={(r) => r.id} empty="Kayıt yok." />
            </Card>
            <Card>
              <CardHeader title={t.metrics.purchases} />
              <DataTable columns={purchaseCols} rows={data.purchases} getRowKey={(r) => r.id} empty="Kayıt yok." />
            </Card>
            <Card>
              <CardHeader title={t.metrics.studentCount} subtitle={`${t.metrics.ortaokul} / ${t.metrics.lise}`} />
              <DataTable columns={studentCols} rows={data.studentCounts} getRowKey={(r) => r.id} empty="Kayıt yok." />
            </Card>
            <Card className="xl:col-span-2">
              <CardHeader title={t.metrics.employeeCount} subtitle="Çalışan sayısı düzeltmeleri" />
              <DataTable columns={headcountCols} rows={data.headcounts} getRowKey={(r) => r.id} empty="Kayıt yok." />
            </Card>
          </div>

          {/* Latest revenue table */}
          <Card>
            <CardHeader title={`Son ${t.metrics.revenue} kayıtları`} />
            <DataTable columns={revenueCols} rows={data.revenue.slice(0, 20)} getRowKey={(r) => r.id} empty="Kayıt yok." />
          </Card>
        </div>
      )}
    </AppShell>
  );
}
