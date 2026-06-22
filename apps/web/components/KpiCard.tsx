'use client';

import { Card, Skeleton, cn } from '@/components/ui';

export function KpiCard({
  label,
  value,
  sub,
  tone = 'brand',
  icon,
  loading,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: 'brand' | 'accent' | 'success' | 'warning' | 'danger';
  icon?: React.ReactNode;
  loading?: boolean;
}) {
  const accentMap: Record<string, string> = {
    brand: 'from-brand/10 text-brand',
    accent: 'from-brand-accent/10 text-brand-accent',
    success: 'from-brand-success/10 text-brand-success',
    warning: 'from-brand-warning/10 text-brand-warning',
    danger: 'from-brand-danger/10 text-brand-danger',
  };

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
        <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
      )}
      {sub && !loading && <p className="mt-1.5 text-xs text-slate-500">{sub}</p>}
    </Card>
  );
}
