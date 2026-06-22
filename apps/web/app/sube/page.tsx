'use client';

export const dynamic = 'force-dynamic';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { AppShell } from '@/components/AppShell';
import { DataTable, type Column } from '@/components/DataTable';
import { Badge, Card, CardHeader, EmptyState, ErrorState, Input, Select, Skeleton } from '@/components/ui';
import { outletTypeLabel } from '@/lib/labels';
import type { Outlet } from '@/lib/types';

export default function OutletsPage() {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [company, setCompany] = useState('');

  const outlets = useQuery({
    queryKey: ['outlets'],
    queryFn: () => apiFetch<Outlet[]>('/outlets'),
  });

  const companies = useMemo(() => {
    const map = new Map<string, string>();
    (outlets.data ?? []).forEach((o) => map.set(o.companyId, o.company.name));
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [outlets.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr');
    return (outlets.data ?? []).filter((o) => {
      if (company && o.companyId !== company) return false;
      if (!q) return true;
      return (
        o.name.toLocaleLowerCase('tr').includes(q) ||
        o.code.toLocaleLowerCase('tr').includes(q) ||
        (o.city ?? '').toLocaleLowerCase('tr').includes(q)
      );
    });
  }, [outlets.data, search, company]);

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
    { key: 'company', header: t.domain.company, render: (o) => o.company.name },
    { key: 'code', header: 'Kod', render: (o) => <span className="font-mono text-xs text-slate-500">{o.code}</span> },
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

  return (
    <AppShell title={t.nav.outlets}>
      {outlets.isError ? (
        <ErrorState message={(outlets.error as Error).message} onRetry={() => outlets.refetch()} />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input
              placeholder="Şube, kod veya şehir ara…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="sm:col-span-2"
            />
            <Select value={company} onChange={(e) => setCompany(e.target.value)}>
              <option value="">Tüm firmalar</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>

          <Card>
            <CardHeader title={t.nav.outlets} subtitle={`${filtered.length} şube`} />
            {outlets.isLoading ? (
              <div className="p-5">
                <Skeleton className="h-64 w-full" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-5">
                <EmptyState title="Şube bulunamadı" description="Arama kriterlerinize uygun şube yok." />
              </div>
            ) : (
              <DataTable columns={columns} rows={filtered} getRowKey={(o) => o.id} />
            )}
          </Card>
        </div>
      )}
    </AppShell>
  );
}
