'use client';

export const dynamic = 'force-dynamic';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { AppShell } from '@/components/AppShell';
import { Card, EmptyState, ErrorState, Select, Skeleton, cn } from '@/components/ui';
import { formatDate, formatNumber } from '@/lib/format';
import type { CellStatus, MonitorMatrix } from '@/lib/types';

const cellColor: Record<CellStatus, string> = {
  received: 'bg-brand-success',
  pending: 'bg-brand-warning',
  missing: 'bg-brand-danger',
};

const chipStyle: Record<CellStatus, string> = {
  received: 'bg-green-50 text-green-700 ring-green-600/20',
  pending: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  missing: 'bg-red-50 text-red-700 ring-red-600/20',
};

export default function MonitorPage() {
  const { t } = useI18n();
  const [days, setDays] = useState(7);
  const [companyFilter, setCompanyFilter] = useState('');

  const matrix = useQuery({
    queryKey: ['monitor', 'matrix', days],
    queryFn: () => apiFetch<MonitorMatrix>(`/monitor?days=${days}`),
  });

  const data = matrix.data;

  const companies = useMemo(
    () => [...new Set((data?.rows ?? []).map((r) => r.company))].sort((a, b) => a.localeCompare(b, 'tr')),
    [data],
  );

  const rows = useMemo(
    () => (data?.rows ?? []).filter((r) => !companyFilter || r.company === companyFilter),
    [data, companyFilter],
  );

  // Today's summary (last date column) across the filtered rows.
  const today = data?.dates[data.dates.length - 1];
  const todaySummary = useMemo(() => {
    const counts: Record<CellStatus, number> = { received: 0, pending: 0, missing: 0 };
    if (!today) return counts;
    for (const row of rows) {
      const cell = row.cells.find((c) => c.date === today);
      if (cell) counts[cell.status] += 1;
    }
    return counts;
  }, [rows, today]);

  const statusLabel = (s: CellStatus) => t.status[s];

  return (
    <AppShell title={t.nav.monitor} subtitle="Şube × tarih ciro raporlama matrisi">
      <div className="space-y-4">
        {/* Today summary chips */}
        {data && rows.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Bugün
            </span>
            {(['received', 'missing', 'pending'] as CellStatus[]).map((s) => (
              <span
                key={s}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tabular-nums ring-1',
                  chipStyle[s],
                )}
              >
                <span className={cn('h-2 w-2 rounded-full', cellColor[s])} />
                {formatNumber(todaySummary[s])} {statusLabel(s).toLocaleLowerCase('tr')}
              </span>
            ))}
          </div>
        )}

        {/* Controls + legend */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5 text-sm font-medium">
              {[7, 14, 31].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={cn(
                    'rounded-md px-3 py-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30',
                    days === d ? 'bg-brand text-white' : 'text-slate-500 hover:text-slate-800',
                  )}
                >
                  {d} gün
                </button>
              ))}
            </div>

            {companies.length > 1 && (
              <Select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="h-10 w-auto min-w-[11rem]"
                aria-label={t.domain.company}
              >
                <option value="">Tüm firmalar</option>
                {companies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
            {(['received', 'pending', 'missing'] as CellStatus[]).map((s) => (
              <div key={s} className="flex items-center gap-1.5">
                <span className={cn('h-2.5 w-2.5 rounded-sm', cellColor[s])} />
                {statusLabel(s)}
              </div>
            ))}
          </div>
        </div>

        <Card>
          {matrix.isError ? (
            <div className="p-5">
              <ErrorState message={(matrix.error as Error).message} onRetry={() => matrix.refetch()} />
            </div>
          ) : matrix.isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-9 w-48 shrink-0" />
                  <Skeleton className="h-6 flex-1" />
                </div>
              ))}
            </div>
          ) : !data || rows.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="Şube yok"
                description={
                  companyFilter
                    ? 'Bu firmada izlenecek şube bulunamadı. Filtreyi temizleyip tekrar deneyin.'
                    : 'İzlenecek şube bulunamadı.'
                }
              />
            </div>
          ) : (
            <div className="max-h-[70vh] overflow-auto scrollbar-thin">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="sticky left-0 top-0 z-30 border-b border-slate-100 bg-white px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {t.domain.outlet}
                    </th>
                    {data.dates.map((d) => {
                      const isToday = d === today;
                      return (
                        <th
                          key={d}
                          className={cn(
                            'sticky top-0 z-20 border-b border-slate-100 bg-white px-1.5 py-3 text-center text-[11px] font-semibold',
                            isToday ? 'text-brand' : 'text-slate-400',
                          )}
                        >
                          <span
                            className={cn(
                              isToday &&
                                'rounded-md bg-brand/10 px-1.5 py-0.5 ring-1 ring-brand/15',
                            )}
                          >
                            {formatDate(d, { day: '2-digit', month: '2-digit' })}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.outletId}
                      className="group border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                    >
                      <td className="sticky left-0 z-10 bg-white px-4 py-2 group-hover:bg-slate-50">
                        <Link
                          href={`/sube/${row.outletId}`}
                          className="block max-w-[200px] truncate text-[13px] font-medium text-slate-800 hover:text-brand"
                        >
                          {row.name}
                        </Link>
                        <span className="block truncate text-[11px] text-slate-400">
                          {row.company}
                        </span>
                      </td>
                      {row.cells.map((cell) => (
                        <td key={cell.date} className="px-1.5 py-2 text-center">
                          <span
                            title={`${row.name} · ${formatDate(cell.date, { day: '2-digit', month: 'long' })} · ${statusLabel(cell.status)}`}
                            className={cn(
                              'inline-block h-5 w-5 rounded-[5px] transition-transform hover:scale-125 hover:shadow-md',
                              cellColor[cell.status],
                              cell.status === 'missing' && 'opacity-90',
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
          Hücrenin üzerine gelerek şube, tarih ve durumu görebilirsiniz. Yeşil ={' '}
          {t.status.received.toLocaleLowerCase('tr')}, sarı ={' '}
          {t.status.pending.toLocaleLowerCase('tr')}, kırmızı ={' '}
          {t.status.missing.toLocaleLowerCase('tr')}.
        </p>
      </div>
    </AppShell>
  );
}
