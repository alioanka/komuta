import { describe, it, expect } from 'vitest';
import { extractMessage } from './extractMessage.js';

describe('extractMessage — examples from the brief (§6.2)', () => {
  it('"1234 73256,76" -> prefix ["1234"], amount 73256.76', () => {
    const r = extractMessage('1234 73256,76');
    expect(r.prefixTokens).toEqual(['1234']);
    expect(r.amount!.toNumber()).toBe(73256.76);
    expect(r.rawNumericToken).toBe('73256,76');
  });

  it('"Camlica BK 73.256,76 TL" -> prefix ["Camlica","BK"], amount 73256.76', () => {
    const r = extractMessage('Camlica BK 73.256,76 TL');
    expect(r.prefixTokens).toEqual(['Camlica', 'BK']);
    expect(r.amount!.toNumber()).toBe(73256.76);
    expect(r.amountConfidence).toBe('high');
  });

  it('"Çamlıca 73256,76" -> prefix ["Çamlıca"]', () => {
    const r = extractMessage('Çamlıca 73256,76');
    expect(r.prefixTokens).toEqual(['Çamlıca']);
    expect(r.amount!.toNumber()).toBe(73256.76);
  });

  it('"Hatice 73256,76" -> prefix ["Hatice"]', () => {
    const r = extractMessage('Hatice 73256,76');
    expect(r.prefixTokens).toEqual(['Hatice']);
    expect(r.amount!.toNumber()).toBe(73256.76);
  });

  it('"73256,76" -> prefix []', () => {
    const r = extractMessage('73256,76');
    expect(r.prefixTokens).toEqual([]);
    expect(r.amount!.toNumber()).toBe(73256.76);
    expect(r.amountConfidence).toBe('high');
  });
});

describe('extractMessage — selection rules', () => {
  it('prefers the currency-adjacent token over a longer bare number', () => {
    const r = extractMessage('99999999 1234 TL');
    expect(r.rawNumericToken).toBe('1234');
    expect(r.amountConfidence).toBe('high');
    expect(r.prefixTokens).toEqual(['99999999']);
  });

  it('prefers the largest-magnitude token when no currency present', () => {
    const r = extractMessage('1234 73256,76');
    expect(r.rawNumericToken).toBe('73256,76');
    expect(r.amountConfidence).toBe('medium');
  });

  it('breaks ties by rightmost token', () => {
    const r = extractMessage('100 200');
    expect(r.rawNumericToken).toBe('200');
    expect(r.amountConfidence).toBe('low');
  });

  it('picks the larger of two currency-adjacent tokens (medium confidence)', () => {
    const r = extractMessage('100 TL 5000 TL');
    expect(r.rawNumericToken).toBe('5000');
    expect(r.amountConfidence).toBe('medium');
  });

  it('ties between two currency-adjacent tokens resolve rightmost (low confidence)', () => {
    const r = extractMessage('1000 TL 2000 TL');
    expect(r.rawNumericToken).toBe('2000');
    expect(r.amountConfidence).toBe('low');
  });

  it('excludes pure currency tokens from the prefix', () => {
    const r = extractMessage('Pizza Sando 5000 TL');
    expect(r.prefixTokens).toEqual(['Pizza', 'Sando']);
  });

  it('handles attached currency (73256,76TL)', () => {
    const r = extractMessage('Camlica 73256,76TL');
    expect(r.amount!.toNumber()).toBe(73256.76);
    expect(r.prefixTokens).toEqual(['Camlica']);
    expect(r.amountConfidence).toBe('high');
  });
});

describe('extractMessage — no amount', () => {
  it('returns none when there is no numeric token', () => {
    const r = extractMessage('Camlica BK');
    expect(r.amount).toBeNull();
    expect(r.amountStatus).toBe('UNPARSEABLE');
    expect(r.amountConfidence).toBe('none');
    expect(r.prefixTokens).toEqual(['Camlica', 'BK']);
  });

  it('handles empty body', () => {
    const r = extractMessage('');
    expect(r.amount).toBeNull();
    expect(r.prefixTokens).toEqual([]);
  });

  it('handles null body', () => {
    const r = extractMessage(null);
    expect(r.amount).toBeNull();
    expect(r.prefixTokens).toEqual([]);
  });
});
