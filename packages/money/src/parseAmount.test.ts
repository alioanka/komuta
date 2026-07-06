import { describe, it, expect } from 'vitest';
import { Decimal } from 'decimal.js';
import { parseAmount, MAX_AMOUNT } from './parseAmount.js';

/**
 * The mandatory test matrix from the brief (§6.1). Every row here is a real
 * example from the product owner and must parse to the expected value.
 */
const MATRIX: Array<[string, number]> = [
  ['73,256.76 TL', 73256.76],
  ['73256,76 TL', 73256.76],
  ['73257 TL', 73257],
  ['73.256,76 TL', 73256.76],
  ['73,256.76 TRY', 73256.76],
  ['73256,76 TRY', 73256.76],
  ['73257 TRY', 73257],
  ['73.256,76 TRY', 73256.76],
  ['73,256.76', 73256.76],
  ['73256,76', 73256.76],
  ['73257', 73257],
  ['73.256,76', 73256.76],
  ['  73 256,76 TL', 73256.76],
  ['73256.76', 73256.76],
  ['1.234.567,89', 1234567.89],
  ['1,234,567.89', 1234567.89],
];

describe('parseAmount — mandatory matrix (§6.1)', () => {
  for (const [input, expected] of MATRIX) {
    it(`parses ${JSON.stringify(input)} -> ${expected}`, () => {
      const result = parseAmount(input);
      expect(result.status).toBe('OK');
      expect(result.value).not.toBeNull();
      expect(result.value!.toNumber()).toBe(expected);
    });
  }
});

describe('parseAmount — rejections', () => {
  it('rejects "0" as non-positive (review)', () => {
    const r = parseAmount('0');
    expect(r.status).toBe('AMBIGUOUS');
    expect(r.value).toBeNull();
  });

  it('rejects "0,00" as non-positive', () => {
    const r = parseAmount('0,00');
    expect(r.status).toBe('AMBIGUOUS');
  });

  it('treats empty string as UNPARSEABLE', () => {
    expect(parseAmount('').status).toBe('UNPARSEABLE');
  });

  it('treats null/undefined as UNPARSEABLE', () => {
    expect(parseAmount(null).status).toBe('UNPARSEABLE');
    expect(parseAmount(undefined).status).toBe('UNPARSEABLE');
  });

  it('treats "abc" as UNPARSEABLE', () => {
    expect(parseAmount('abc').status).toBe('UNPARSEABLE');
  });

  it('treats currency-only "TL" as UNPARSEABLE', () => {
    expect(parseAmount('TL').status).toBe('UNPARSEABLE');
  });

  it('treats malformed multi-decimal input as UNPARSEABLE', () => {
    // Two distinct decimal separators after grouping removal => malformed.
    expect(parseAmount('1,2,3.4,5').status).toBe('UNPARSEABLE');
  });

  it('flags out-of-range amounts as AMBIGUOUS', () => {
    const r = parseAmount('100000000');
    expect(r.status).toBe('AMBIGUOUS');
    expect(r.reason).toBe('out-of-range');
  });

  it('respects a custom max option', () => {
    const r = parseAmount('5000', { max: new Decimal(1000) });
    expect(r.status).toBe('AMBIGUOUS');
  });
});

describe('parseAmount — separator disambiguation', () => {
  it('single comma with 3 trailing digits = thousands (73,256 -> 73256)', () => {
    expect(parseAmount('73,256').value!.toNumber()).toBe(73256);
  });

  it('single comma with 2 trailing digits = decimal (73,5 -> 73.5)', () => {
    expect(parseAmount('73,5').value!.toNumber()).toBe(73.5);
  });

  it('single dot with 3 trailing digits = thousands (73.256 -> 73256)', () => {
    expect(parseAmount('73.256').value!.toNumber()).toBe(73256);
  });

  it('multiple commas = thousands grouping (1,234,567 -> 1234567)', () => {
    expect(parseAmount('1,234,567').value!.toNumber()).toBe(1234567);
  });

  it('multiple dots = thousands grouping (1.234.567 -> 1234567)', () => {
    expect(parseAmount('1.234.567').value!.toNumber()).toBe(1234567);
  });

  it('handles the ₺ symbol', () => {
    expect(parseAmount('₺73.256,76').value!.toNumber()).toBe(73256.76);
  });

  it('handles attached currency without space (73256,76TL)', () => {
    expect(parseAmount('73256,76TL').value!.toNumber()).toBe(73256.76);
  });

  it('handles a trailing punctuation dot (73257.)', () => {
    expect(parseAmount('73257.').value!.toNumber()).toBe(73257);
  });

  it('rounds to 2 decimal places half-up', () => {
    // 4 trailing digits after a single comma => decimal => 10.5678 => 10.57
    expect(parseAmount('10,5678').value!.toFixed(2)).toBe('10.57');
  });

  it('rounds .005 half-up to .01 (decimal with >3 trailing digits)', () => {
    // 4 digits after the dot => decimal => 1.0050 => 1.01
    expect(parseAmount('1.0050').value!.toFixed(2)).toBe('1.01');
  });

  it('produces a normalized 2dp string', () => {
    expect(parseAmount('73257').normalized).toBe('73257.00');
  });
});

describe('parseAmount — exported constant', () => {
  it('exposes MAX_AMOUNT', () => {
    expect(MAX_AMOUNT.toNumber()).toBe(100_000_000);
  });
});

describe('parseAmount — WhatsApp formatting and negatives', () => {
  it('parses bold-wrapped amounts (*73256,76*)', () => {
    const r = parseAmount('*73256,76*');
    expect(r.status).toBe('OK');
    expect(r.normalized).toBe('73256.76');
  });

  it('parses italic/strike/parenthesis-wrapped amounts', () => {
    expect(parseAmount('_5000_').normalized).toBe('5000.00');
    expect(parseAmount('~1.250,50~').normalized).toBe('1250.50');
    expect(parseAmount('(73256.76)').normalized).toBe('73256.76');
    expect(parseAmount('*₺1.234,56*').normalized).toBe('1234.56');
  });

  it('rejects explicitly negative amounts instead of dropping the sign', () => {
    expect(parseAmount('-5000').status).toBe('UNPARSEABLE');
    expect(parseAmount('-5000').reason).toBe('negative');
    expect(parseAmount('- 5000').status).toBe('UNPARSEABLE');
    expect(parseAmount('-1.234,56 TL').status).toBe('UNPARSEABLE');
    expect(parseAmount('*-5000*').status).toBe('UNPARSEABLE');
  });

  it('a trailing dash is not treated as a negative sign', () => {
    // minus only counts when it appears before the first digit
    expect(parseAmount('5000-').status).toBe('OK');
  });
});
