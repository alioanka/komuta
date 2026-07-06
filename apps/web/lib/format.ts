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

/** Time of day, e.g. "14:32". */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

/** Relative time in Turkish: "az önce", "5 dk önce", "3 sa önce", "dün", or "12 Haz". */
export function formatRelative(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'az önce'; // just now
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} sa önce`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'dün'; // yesterday
  if (days < 7) return `${days} gün önce`;
  return formatDate(iso);
}

/** Pretty phone display: +90 532 123 45 67. */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  const m = digits.match(/^\+?90(\d{3})(\d{3})(\d{2})(\d{2})$/);
  if (m) return `+90 ${m[1]} ${m[2]} ${m[3]} ${m[4]}`;
  return digits.startsWith('+') ? digits : `+${digits}`;
}

/** Signed percent, e.g. "+%12,4" / "-%3,1". */
export function formatPercentDelta(pct: number): string {
  if (!Number.isFinite(pct)) return '—';
  const sign = pct > 0 ? '+' : pct < 0 ? '-' : '';
  return `${sign}%${Math.abs(pct).toFixed(1).replace('.', ',')}`;
}
