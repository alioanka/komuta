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
import { DataTable, type Column } from '@/components/DataTable';
import { Badge, Card, CardHeader, EmptyState, ErrorState } from '@/components/ui';
import { formatNumber } from '@/lib/format';
import { outletTypeLabel } from '@/lib/labels';
import type { Company, Outlet } from '@/lib/types';

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
    <AppShell title={company?.name ?? t.domain.company}>
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
