'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { AppShell } from '@/components/AppShell';
import { Badge, Card, CardBody, EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { formatNumber } from '@/lib/format';
import { IconChevron } from '@/components/icons';
import type { Company } from '@/lib/types';

export default function CompaniesPage() {
  const { t } = useI18n();

  const companies = useQuery({
    queryKey: ['companies'],
    queryFn: () => apiFetch<Company[]>('/companies'),
  });

  return (
    <AppShell title={t.nav.companies} subtitle="Firma portföyü ve markalar">
      {companies.isError ? (
        <ErrorState message={(companies.error as Error).message} onRetry={() => companies.refetch()} />
      ) : companies.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      ) : !companies.data || companies.data.length === 0 ? (
        <EmptyState title="Firma yok" description="Henüz firma tanımlanmamış." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {companies.data.map((c) => (
            <Link key={c.id} href={`/firmalar/${c.id}`} className="group">
              <Card className="h-full p-5 transition-shadow hover:shadow-card-hover">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-base font-semibold text-brand">
                      {c.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <p className="font-semibold text-slate-800">{c.name}</p>
                      <p className="text-xs text-slate-400">{c.slug}</p>
                    </div>
                  </div>
                  <IconChevron
                    width={18}
                    height={18}
                    className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand"
                  />
                </div>
                <CardBody className="flex items-center gap-2 px-0 pb-0 pt-4">
                  <Badge tone="accent">
                    {formatNumber(c._count.outlets)} {t.nav.outlets.toLowerCase()}
                  </Badge>
                  {c.brands.length > 0 && (
                    <Badge tone="neutral">
                      {formatNumber(c.brands.length)} {t.domain.brand.toLowerCase()}
                    </Badge>
                  )}
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
