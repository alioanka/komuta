'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { brand } from '@komuta/config';
import { apiFetch } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { AppShell } from '@/components/AppShell';
import { Card, CardHeader, EmptyState, ErrorState, Skeleton, cn } from '@/components/ui';
import { formatDate } from '@/lib/format';
import type { CellStatus, MonitorMatrix } from '@/lib/types';

const cellColor: Record<CellStatus, string> = {
  received: 'bg-[#16A34A]',
  pending: 'bg-[#D97706]',
  missing: 'bg-[#DC2626]',
};

export default function MonitorPage() {
  const { t } = useI18n();
  const [days, setDays] = useState(7);

  const matrix = useQuery({
    queryKey: ['monitor', 'matrix', days],
    queryFn: () => apiFetch<MonitorMatrix>(`/monitor?days=${days}`),
  });

  const data = matrix.data;

  return (
    <AppShell title={t.nav.monitor}>
      <div className="space-y-5">
        {/* Controls + legend */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5 text-sm font-medium">
            {[7, 14, 31].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={cn(
                  'rounded-md px-3 py-1.5 transition-colors',
                  days === d ? 'bg-brand text-white' : 'text-slate-500 hover:text-slate-800',
                )}
              >
                {d} gün
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
            {(['received', 'pending', 'missing'] as CellStatus[]).map((s) => (
              <div key={s} className="flex items-center gap-1.5">
                <span className={cn('h-3 w-3 rounded-sm', cellColor[s])} />
                {t.status[s === 'received' ? 'received' : s === 'pending' ? 'pending' : 'missing']}
              </div>
            ))}
          </div>
        </div>

        <Card>
          <CardHeader title={t.nav.monitor} subtitle={`Şube × tarih raporlama matrisi (${days} gün)`} />
          {matrix.isError ? (
            <div className="p-5">
              <ErrorState message={(matrix.error as Error).message} onRetry={() => matrix.refetch()} />
            </div>
          ) : matrix.isLoading ? (
            <div className="p-5">
              <Skeleton className="h-72 w-full" />
            </div>
          ) : !data || data.rows.length === 0 ? (
            <div className="p-5">
              <EmptyState title="Şube yok" description="İzlenecek şube bulunamadı." />
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="sticky left-0 z-10 bg-white px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {t.domain.outlet}
                    </th>
                    {data.dates.map((d) => (
                      <th
                        key={d}
                        className="px-2 py-3 text-center text-xs font-semibold text-slate-400"
                      >
                        {formatDate(d, { day: '2-digit', month: '2-digit' })}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.outletId} className="border-b border-slate-50 last:border-0">
                      <td className="sticky left-0 z-10 bg-white px-4 py-2.5">
                        <Link
                          href={`/sube/${row.outletId}`}
                          className="block max-w-[200px] truncate font-medium text-slate-800 hover:text-brand"
                        >
                          {row.name}
                        </Link>
                        <span className="block truncate text-xs text-slate-400">{row.company}</span>
                      </td>
                      {row.cells.map((cell) => (
                        <td key={cell.date} className="px-2 py-2.5 text-center">
                          <span
                            title={`${formatDate(cell.date)} · ${t.status[cell.status]}`}
                            className={cn(
                              'inline-block h-6 w-6 rounded-md transition-transform hover:scale-110',
                              cellColor[cell.status],
                            )}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <p className="text-xs text-slate-400">
          Renkler {brand.name} marka paletinden gelir: yeşil = {t.status.received.toLowerCase()},
          sarı = {t.status.pending.toLowerCase()}, kırmızı = {t.status.missing.toLowerCase()}.
        </p>
      </div>
    </AppShell>
  );
}
