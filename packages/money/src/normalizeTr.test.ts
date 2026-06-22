import { describe, it, expect } from 'vitest';
import { normalizeTr, toLowerTr } from './normalizeTr.js';

describe('normalizeTr', () => {
  it('folds Turkish diacritics and lowercases (Çamlıca BK === ÇAMLICA bk)', () => {
    expect(normalizeTr('Çamlıca BK')).toBe('camlica bk');
    expect(normalizeTr('ÇAMLICA bk')).toBe('camlica bk');
    expect(normalizeTr('Çamlıca BK')).toBe(normalizeTr('ÇAMLICA bk'));
  });

  it('handles all Turkish special letters', () => {
    expect(normalizeTr('çğıİöşü')).toBe('cgiiosu');
    expect(normalizeTr('ÇĞIİÖŞÜ')).toBe('cgiiosu');
  });

  it('strips punctuation and collapses whitespace', () => {
    expect(normalizeTr('  Çamlıca,  B.K.!  ')).toBe('camlica b k');
  });

  it('keeps digits', () => {
    expect(normalizeTr('Şube 1234')).toBe('sube 1234');
  });

  it('returns empty string for null/undefined', () => {
    expect(normalizeTr(null)).toBe('');
    expect(normalizeTr(undefined)).toBe('');
  });

  it('handles the dotted/dotless i pair correctly', () => {
    // Turkish: I -> ı -> i (folded);  İ -> i
    expect(normalizeTr('IĞDIR')).toBe('igdir');
    expect(normalizeTr('İstanbul')).toBe('istanbul');
  });
});

describe('toLowerTr', () => {
  it('lowercases dotted capital I to i', () => {
    expect(toLowerTr('İ')).toBe('i');
  });

  it('lowercases dotless capital I to ı', () => {
    expect(toLowerTr('I')).toBe('ı');
  });
});
