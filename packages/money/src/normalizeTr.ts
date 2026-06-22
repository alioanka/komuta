/**
 * Turkish-aware text normalization used for all alias / name matching.
 *
 * Steps:
 *  1. Lowercase using Turkish locale rules (handles the dotted/dotless İ/I pair).
 *  2. Fold diacritics specific to Turkish (ç→c, ğ→g, ı→i, İ→i, ö→o, ş→s, ü→u)
 *     plus common Western accents, so that "Çamlıca" and "Camlica" collapse.
 *  3. Strip punctuation (anything that is not a latin letter, digit, or space).
 *  4. Collapse runs of whitespace and trim.
 *
 * The function is pure and deterministic — same input always yields same output.
 */

const TURKISH_FOLD_MAP: Record<string, string> = {
  ç: 'c',
  ğ: 'g',
  ı: 'i',
  i̇: 'i', // i with combining dot above (result of lowercasing İ in some locales)
  ö: 'o',
  ş: 's',
  ü: 'u',
  â: 'a',
  î: 'i',
  û: 'u',
  é: 'e',
  è: 'e',
  ê: 'e',
  á: 'a',
  à: 'a',
  ñ: 'n',
};

/**
 * Lowercase a string using Turkish rules. We special-case the two Turkish
 * letters that the default toLowerCase mishandles:
 *  - 'İ' (U+0130, dotted capital I) → 'i'
 *  - 'I' (U+0049, dotless capital I) → 'ı'
 */
export function toLowerTr(input: string): string {
  return input
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .toLocaleLowerCase('tr-TR');
}

export function normalizeTr(input: string | null | undefined): string {
  if (input == null) return '';

  // 1. Turkish lowercase.
  let s = toLowerTr(String(input));

  // 2. Fold diacritics character by character.
  let folded = '';
  for (const ch of s) {
    folded += TURKISH_FOLD_MAP[ch] ?? ch;
  }
  s = folded;

  // 2b. Strip any remaining combining marks (NFD decomposition catch-all).
  s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');

  // 3. Replace punctuation / symbols with spaces (keep latin letters, digits, space).
  s = s.replace(/[^a-z0-9\s]/g, ' ');

  // 4. Collapse whitespace and trim.
  s = s.replace(/\s+/g, ' ').trim();

  return s;
}
