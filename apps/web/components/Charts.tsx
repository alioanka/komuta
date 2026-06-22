'use client';

import {
  Area,
  AreaChart,
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

export function RevenueAreaChart({ data, height = 280 }: { data: TrendDatum[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={brand.colors.accent} stopOpacity={0.32} />
            <stop offset="100%" stopColor={brand.colors.accent} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(d) => formatDate(String(d))}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          minTickGap={16}
        />
        <YAxis
          tickFormatter={(v) => formatCompact(Number(v))}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip
          formatter={(v) => [formatMoney(Number(v), true), brand.colors.primary]}
          labelFormatter={(d) => formatDate(String(d), { day: '2-digit', month: 'long' })}
          contentStyle={{
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            boxShadow: '0 8px 24px -8px rgb(15 23 42 / 0.18)',
            fontSize: 12,
          }}
          labelStyle={{ color: '#64748b', fontWeight: 600 }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={brand.colors.accent}
          strokeWidth={2.5}
          fill="url(#revGradient)"
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
