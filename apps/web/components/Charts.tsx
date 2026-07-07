'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { brand } from '@komuta/config';
import { formatCompact, formatDate, formatMoney } from '@/lib/format';

interface TrendDatum {
  date: string;
  value: number;
}

/** Shared tooltip card: Turkish long date + formatted ₺ value. */
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number | string }>;
  label?: string | number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const value = Number(payload[0]?.value ?? 0);
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/95 px-3.5 py-2.5 shadow-card-hover backdrop-blur-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {formatDate(String(label), { day: '2-digit', month: 'long', year: 'numeric' })}
      </p>
      <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold tabular-nums text-slate-900">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: brand.colors.accent }}
        />
        {formatMoney(value, true)}
      </p>
    </div>
  );
}

export function RevenueAreaChart({ data, height = 280 }: { data: TrendDatum[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={brand.colors.accent} stopOpacity={0.28} />
            <stop offset="100%" stopColor={brand.colors.accent} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(d) => formatDate(String(d))}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          minTickGap={24}
          tickMargin={8}
        />
        <YAxis
          tickFormatter={(v) => formatCompact(Number(v))}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          width={44}
        />
        <Tooltip
          content={<ChartTooltip />}
          cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={brand.colors.accent}
          strokeWidth={2}
          fill="url(#revGradient)"
          activeDot={{ r: 4, strokeWidth: 2, stroke: '#ffffff' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

interface BarDatum {
  label: string;
  value: number;
}

/** Tooltip for the report bar chart: category label + ₺ value. */
function BarTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number | string }>;
  label?: string | number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const value = Number(payload[0]?.value ?? 0);
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/95 px-3.5 py-2.5 shadow-card-hover backdrop-blur-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{String(label)}</p>
      <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold tabular-nums text-slate-900">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: brand.colors.accent }}
        />
        {formatMoney(value, true)}
      </p>
    </div>
  );
}

/** Categorical bar chart for report rows (grup → toplam ciro). */
export function ReportBarChart({ data, height = 300 }: { data: BarDatum[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={brand.colors.accent} stopOpacity={0.95} />
            <stop offset="100%" stopColor={brand.colors.accent} stopOpacity={0.55} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={12}
          tickMargin={8}
        />
        <YAxis
          tickFormatter={(v) => formatCompact(Number(v))}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          width={44}
        />
        <Tooltip content={<BarTooltip />} cursor={{ fill: '#f8fafc' }} />
        <Bar dataKey="value" fill="url(#barGradient)" radius={[6, 6, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Tiny axis-free sparkline for KPI cards. */
export function Sparkline({
  data,
  height = 36,
  color = brand.colors.accent,
}: {
  data: number[];
  height?: number;
  color?: string;
}) {
  const points = data.map((value, i) => ({ i, value }));
  // A stable-but-unique gradient id per color keeps multiple sparklines from clashing.
  const gid = `spark-${color.replace('#', '')}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={points} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#${gid})`}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
