import { Decimal } from 'decimal.js';

/**
 * Maximum plausible single-day revenue amount. Anything at/above this is treated
 * as suspicious and flagged for review rather than silently stored.
 */
export const MAX_AMOUNT = new Decimal(100_000_000);

export type ParseAmountStatus = 'OK' | 'UNPARSEABLE' | 'AMBIGUOUS';

export interface ParseAmountResult {
  /** OK = parsed & in range; UNPARSEABLE = no usable number; AMBIGUOUS = parsed but out of accepted range (e.g. 0 or too large). */
  status: ParseAmountStatus;
  /** The parsed value when status === 'OK', otherwise null. */
  value: Decimal | null;
  /** Canonical fixed-2dp string when status === 'OK', otherwise null. */
  normalized: string | null;
  /** Machine-readable reason for non-OK results. */
  reason?: string;
}

export interface ParseAmountOptions {
  /** Override the maximum accepted amount. */
  max?: Decimal;
}

function fail(status: ParseAmountStatus, reason: string): ParseAmountResult {
  return { status, value: null, normalized: null, reason };
}

/**
 * Parse a raw numeric token into a precise Decimal, handling both Turkish
 * (comma decimal, dot thousands) and Western (dot decimal, comma thousands)
 * conventions, with or without a currency suffix.
 *
 * The algorithm is deterministic and fully specified — see /docs/10_ARCHITECTURE.md
 * and the test matrix in parseAmount.test.ts.
 */
export function parseAmount(raw: string | null | undefined, opts: ParseAmountOptions = {}): ParseAmountResult {
  const max = opts.max ?? MAX_AMOUNT;

  if (raw == null) return fail('UNPARSEABLE', 'empty');
  let s = String(raw).trim();
  if (s.length === 0) return fail('UNPARSEABLE', 'empty');

  // 0. Strip WhatsApp formatting characters (bold *…*, italic _…_, strike ~…~)
  //    and wrapping parentheses: "*73256,76*" is the same amount as 73256,76.
  s = s.replace(/[*_~()[\]]/g, '');

  // 0b. Reject explicitly negative amounts (a minus sign before the first
  //     digit) instead of silently dropping the sign.
  if (/^[^0-9]*-/.test(s)) return fail('UNPARSEABLE', 'negative');

  // 1. Strip currency tokens case-insensitively (TL, TRY, ₺, tl., try.).
  s = s.replace(/₺/g, ' ');
  s = s.replace(/\b(?:tl|try)\b\.?/gi, ' ');
  s = s.trim();
  // Strip a trailing punctuation dot (e.g. "73257.").
  s = s.replace(/\.\s*$/, '');

  // 2. Remove internal spaces between digits (and any remaining whitespace).
  s = s.replace(/\s+/g, '');

  // 3. Keep only digits and separators.
  s = s.replace(/[^0-9.,]/g, '');
  if (!/[0-9]/.test(s)) return fail('UNPARSEABLE', 'no-digits');

  // 4. Locate separators.
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  const hasDot = lastDot !== -1;
  const hasComma = lastComma !== -1;

  let canonical: string;

  if (hasDot && hasComma) {
    // 5. Both present: the rightmost separator is the decimal separator.
    const decimalSep = lastComma > lastDot ? ',' : '.';
    const thousandsSep = decimalSep === ',' ? '.' : ',';
    canonical = s.split(thousandsSep).join('').replace(decimalSep, '.');
  } else if (hasComma) {
    // 6. Only comma present.
    const commaCount = s.split(',').length - 1;
    if (commaCount > 1) {
      canonical = s.split(',').join(''); // multiple commas → all thousands.
    } else {
      const digitsAfter = s.length - lastComma - 1;
      canonical = digitsAfter === 3 ? s.split(',').join('') : s.replace(',', '.');
    }
  } else if (hasDot) {
    // 7. Only dot present (mirror of step 6).
    const dotCount = s.split('.').length - 1;
    if (dotCount > 1) {
      canonical = s.split('.').join(''); // multiple dots → all thousands.
    } else {
      const digitsAfter = s.length - lastDot - 1;
      canonical = digitsAfter === 3 ? s.split('.').join('') : s;
    }
  } else {
    // 8. No separators → integer.
    canonical = s;
  }

  // 9. Validate & parse.
  if (!/^\d+(\.\d+)?$/.test(canonical)) {
    return fail('UNPARSEABLE', 'malformed');
  }

  // `canonical` matched the strict numeric regex above, so Decimal cannot throw.
  const value = new Decimal(canonical).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  if (value.lte(0)) return fail('AMBIGUOUS', 'non-positive');
  if (value.gte(max)) return fail('AMBIGUOUS', 'out-of-range');

  return { status: 'OK', value, normalized: value.toFixed(2) };
}
