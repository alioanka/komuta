import { describe, it, expect } from 'vitest';
import {
  decideResolution,
  resolveStoreFromTokens,
  similarity,
  levenshtein,
  type OutletCandidate,
} from './resolution.js';
import { normalizeTr } from '@komuta/money';

const OK = 'OK' as const;

describe('decideResolution — §6.4 decision table', () => {
  it('duplicate -> DUPLICATE / ignore', () => {
    const d = decideResolution({ isDuplicate: true, amountStatus: OK, mappedOutletIds: ['o1'], storeOutletId: null });
    expect(d.status).toBe('DUPLICATE');
    expect(d.action).toBe('IGNORE_DUPLICATE');
    expect(d.entryStatus).toBeNull();
  });

  it('unparseable amount -> UNPARSEABLE / log', () => {
    const d = decideResolution({ isDuplicate: false, amountStatus: 'UNPARSEABLE', mappedOutletIds: ['o1'], storeOutletId: null });
    expect(d.status).toBe('UNPARSEABLE');
    expect(d.action).toBe('LOG_UNPARSEABLE');
  });

  it('ambiguous amount (out of range) -> UNPARSEABLE / log', () => {
    const d = decideResolution({ isDuplicate: false, amountStatus: 'AMBIGUOUS', mappedOutletIds: ['o1'], storeOutletId: null });
    expect(d.status).toBe('UNPARSEABLE');
  });

  it('mapped single outlet, no store id -> MAPPED / CONFIRMED', () => {
    const d = decideResolution({ isDuplicate: false, amountStatus: OK, mappedOutletIds: ['o1'], storeOutletId: null });
    expect(d.status).toBe('MAPPED');
    expect(d.outletId).toBe('o1');
    expect(d.entryStatus).toBe('CONFIRMED');
    expect(d.action).toBe('STORE_CONFIRMED');
  });

  it('mapped multiple outlets, no store id -> AMBIGUOUS / ask which', () => {
    const d = decideResolution({ isDuplicate: false, amountStatus: OK, mappedOutletIds: ['o1', 'o2'], storeOutletId: null });
    expect(d.status).toBe('AMBIGUOUS');
    expect(d.action).toBe('ASK_WHICH_OUTLET');
    expect(d.entryStatus).toBe('PENDING_REVIEW');
    expect(d.outletId).toBeNull();
  });

  it('mapped, store id matches mapped outlet -> MAPPED / CONFIRMED', () => {
    const d = decideResolution({ isDuplicate: false, amountStatus: OK, mappedOutletIds: ['o1'], storeOutletId: 'o1' });
    expect(d.status).toBe('MAPPED');
    expect(d.outletId).toBe('o1');
    expect(d.entryStatus).toBe('CONFIRMED');
  });

  it('mapped, store id differs -> NEEDS_CONFIRMATION / notify manager (no auto-store)', () => {
    const d = decideResolution({ isDuplicate: false, amountStatus: OK, mappedOutletIds: ['o1'], storeOutletId: 'o2' });
    expect(d.status).toBe('NEEDS_CONFIRMATION');
    expect(d.action).toBe('NOTIFY_MANAGER_MISMATCH');
    expect(d.entryStatus).toBe('PENDING_REVIEW');
    expect(d.outletId).toBe('o2');
  });

  it('unmapped sender, store resolvable -> NEEDS_CONFIRMATION / create pending mapping', () => {
    const d = decideResolution({ isDuplicate: false, amountStatus: OK, mappedOutletIds: [], storeOutletId: 'o5' });
    expect(d.status).toBe('NEEDS_CONFIRMATION');
    expect(d.action).toBe('CREATE_PENDING_MAPPING');
    expect(d.entryStatus).toBe('PENDING_REVIEW');
    expect(d.outletId).toBe('o5');
  });

  it('unmapped sender, no resolvable store -> NEEDS_STORE_ID / ask', () => {
    const d = decideResolution({ isDuplicate: false, amountStatus: OK, mappedOutletIds: [], storeOutletId: null });
    expect(d.status).toBe('NEEDS_STORE_ID');
    expect(d.action).toBe('ASK_STORE_ID');
    expect(d.entryStatus).toBeNull();
  });
});

describe('resolveStoreFromTokens', () => {
  const outlets: OutletCandidate[] = [
    { outletId: 'o-camlica', code: '1234', normalizedNames: [normalizeTr('Çamlıca BK'), normalizeTr('camlica')] },
    { outletId: 'o-pizza', code: '5000', normalizedNames: [normalizeTr('Pizza Sando')] },
  ];

  it('resolves by exact numeric code', () => {
    const r = resolveStoreFromTokens(['1234'], outlets);
    expect(r?.outletId).toBe('o-camlica');
    expect(r?.method).toBe('code');
  });

  it('resolves by exact normalized alias', () => {
    const r = resolveStoreFromTokens(['Çamlıca', 'BK'], outlets);
    expect(r?.outletId).toBe('o-camlica');
    expect(r?.method).toBe('alias');
  });

  it('resolves by fuzzy match for a typo', () => {
    const r = resolveStoreFromTokens(['Pizza', 'Sand'], outlets);
    expect(r?.outletId).toBe('o-pizza');
    expect(r?.method).toBe('fuzzy');
  });

  it('returns null when nothing is close enough', () => {
    const r = resolveStoreFromTokens(['Tamamen', 'Alakasiz'], outlets);
    expect(r).toBeNull();
  });

  it('returns null for empty prefix', () => {
    expect(resolveStoreFromTokens([], outlets)).toBeNull();
  });

  it('resolves by employee name to that employee outlet', () => {
    const r = resolveStoreFromTokens(['Hatice'], outlets, [
      { employeeId: 'e1', outletId: 'o-camlica', normalizedName: normalizeTr('Hatice') },
    ]);
    expect(r?.outletId).toBe('o-camlica');
    expect(r?.method).toBe('employee');
  });
});

describe('string distance helpers', () => {
  it('levenshtein basic', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('abc', 'abc')).toBe(0);
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
  });

  it('similarity is 1 for identical and lower for different', () => {
    expect(similarity('abc', 'abc')).toBe(1);
    expect(similarity('', '')).toBe(1);
    expect(similarity('abc', 'xyz')).toBe(0);
  });
});
