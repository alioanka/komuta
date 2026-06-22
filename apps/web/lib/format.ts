/** Locale-aware formatting helpers (Turkish defaults). */

const tryFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 0,
});

const tryFormatterPrecise = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('tr-TR');

export function formatMoney(value: string | number, precise = false): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '—';
  return (precise ? tryFormatterPrecise : tryFormatter).format(n);
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return numberFormatter.format(value);
}

/** Compact axis labels, e.g. 12.500 ₺ → "12,5B". */
export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return '';
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}B`;
  return String(value);
}

export function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('tr-TR', opts ?? { day: '2-digit', month: 'short' });
}

export function formatMonth(period: string): string {
  // period like "2026-06"
  const [y, m] = period.split('-');
  if (!y || !m) return period;
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });
}
