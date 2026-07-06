'use client';

import { Card, Skeleton, cn } from '@/components/ui';
import { Sparkline } from '@/components/Charts';
import { IconTrendDown, IconTrendUp } from '@/components/icons';
import { formatPercentDelta } from '@/lib/format';

export function KpiCard({
  label,
  value,
  sub,
  tone = 'brand',
  icon,
  loading,
  spark,
  delta,
  deltaLabel,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: 'brand' | 'accent' | 'success' | 'warning' | 'danger';
  icon?: React.ReactNode;
  loading?: boolean;
  /** Optional mini trend rendered along the card's bottom edge. */
  spark?: number[];
  /** Percent change vs the previous period; positive renders green ↑, negative red ↓. */
  delta?: number | null;
  /** Short Turkish context for the delta, e.g. "düne göre". */
  deltaLabel?: string;
}) {
  const accentMap: Record<string, string> = {
    brand: 'from-brand/10 text-brand',
    accent: 'from-brand-accent/10 text-brand-accent',
    success: 'from-brand-success/10 text-brand-success',
    warning: 'from-brand-warning/10 text-brand-warning',
    danger: 'from-brand-danger/10 text-brand-danger',
  };

  const hasDelta = delta != null && Number.isFinite(delta);
  const deltaUp = hasDelta && delta! > 0;
  const deltaDown = hasDelta && delta! < 0;

  return (
    <Card className="relative overflow-hidden p-5 transition-shadow hover:shadow-card-hover">
      <div
        className={cn(
          'pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br to-transparent',
          accentMap[tone],
        )}
      />
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {icon && <div className={cn('text-lg', accentMap[tone].split(' ')[1])}>{icon}</div>}
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-28" />
      ) : (
        <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-slate-900">
          {value}
        </p>
      )}
      {!loading && (hasDelta || sub) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          {hasDelta && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums',
                deltaUp && 'bg-green-50 text-green-700',
                deltaDown && 'bg-red-50 text-red-600',
                !deltaUp && !deltaDown && 'bg-slate-50 text-slate-500',
              )}
            >
              {deltaUp && <IconTrendUp width={13} height={13} />}
              {deltaDown && <IconTrendDown width={13} height={13} />}
              {formatPercentDelta(delta!)}
              {deltaLabel && <span className="font-normal opacity-80">{deltaLabel}</span>}
            </span>
          )}
          {sub && <p className="text-xs text-slate-500">{sub}</p>}
        </div>
      )}
      {!loading && spark && spark.length > 1 && (
        <div className="pointer-events-none mt-3 -mb-2 -mx-1">
          <Sparkline data={spark} />
        </div>
      )}
    </Card>
  );
}
