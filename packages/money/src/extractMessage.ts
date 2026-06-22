import type { Decimal } from 'decimal.js';
import { parseAmount, type ParseAmountStatus } from './parseAmount.js';

export type AmountConfidence = 'high' | 'medium' | 'low' | 'none';

export interface ExtractMessageResult {
  /** Parsed amount value (null when no usable number or amount is out of range). */
  amount: Decimal | null;
  /** Parse status for the chosen numeric token. */
  amountStatus: ParseAmountStatus;
  /** How confident we are that we picked the right token as "the amount". */
  amountConfidence: AmountConfidence;
  /** The raw numeric substring we treated as the amount (currency stripped). */
  rawNumericToken: string | null;
  /** Remaining non-amount, non-currency tokens — candidate store code / name / employee. */
  prefixTokens: string[];
}

/** A token that is purely a currency marker. */
const CURRENCY_RE = /^(?:tl|try|₺)\.?$/i;
/** A token (currency stripped) that looks like a number with optional separators. */
const NUMERIC_RE = /^[0-9][0-9.,]*$/;
/** Trailing attached currency, e.g. "73256,76TL". */
const ATTACHED_CURRENCY_RE = /(?:tl|try)\.?$/i;

function stripAttachedCurrency(token: string): string {
  return token.replace(/₺/g, '').replace(ATTACHED_CURRENCY_RE, '');
}

interface Candidate {
  index: number;
  core: string;
  digits: number;
  currencyAdjacent: boolean;
}

/**
 * Extract the revenue amount and the surrounding prefix tokens from a free-form
 * WhatsApp message body. Pure & deterministic.
 *
 * Selection rule when several numeric tokens are present:
 *   1. prefer the token adjacent to a currency marker,
 *   2. else the token with the most digits (largest magnitude),
 *   3. else the rightmost.
 */
export function extractMessage(body: string | null | undefined): ExtractMessageResult {
  const text = (body ?? '').trim();
  const tokens = text.length > 0 ? text.split(/\s+/) : [];
  const isCurrency = tokens.map((t) => CURRENCY_RE.test(t));

  const candidates: Candidate[] = [];
  tokens.forEach((token, i) => {
    if (isCurrency[i]) return;
    const core = stripAttachedCurrency(token);
    if (!NUMERIC_RE.test(core)) return;
    const hadAttachedCurrency = core !== token;
    const nextIsCurrency = i + 1 < tokens.length && isCurrency[i + 1] === true;
    candidates.push({
      index: i,
      core,
      digits: core.replace(/\D/g, '').length,
      currencyAdjacent: hadAttachedCurrency || nextIsCurrency,
    });
  });

  let chosen: Candidate | null = null;
  let confidence: AmountConfidence = 'none';

  if (candidates.length === 1) {
    chosen = candidates[0]!;
    confidence = 'high';
  } else if (candidates.length > 1) {
    const currencyCands = candidates.filter((c) => c.currencyAdjacent);
    const pool = currencyCands.length > 0 ? currencyCands : candidates;
    const maxDigits = Math.max(...pool.map((c) => c.digits));
    const top = pool.filter((c) => c.digits === maxDigits);
    chosen = top.reduce((a, b) => (b.index > a.index ? b : a));
    if (currencyCands.length === 1) {
      confidence = 'high';
    } else {
      confidence = top.length === 1 ? 'medium' : 'low';
    }
  }

  const prefixTokens = tokens.filter((_, i) => !isCurrency[i] && i !== chosen?.index);

  if (!chosen) {
    return {
      amount: null,
      amountStatus: 'UNPARSEABLE',
      amountConfidence: 'none',
      rawNumericToken: null,
      prefixTokens,
    };
  }

  const parsed = parseAmount(chosen.core);
  return {
    amount: parsed.value,
    amountStatus: parsed.status,
    amountConfidence: confidence,
    rawNumericToken: chosen.core,
    prefixTokens,
  };
}
