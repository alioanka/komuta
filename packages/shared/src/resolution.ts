import { normalizeTr } from '@komuta/money';
import { STORE_FUZZY_MATCH_THRESHOLD } from '@komuta/config';
import { EntryStatus, ResolutionStatus } from './enums.js';

/** Mirrors @komuta/money ParseAmountStatus without importing it as a value. */
export type ParseAmountStatusLike = 'OK' | 'UNPARSEABLE' | 'AMBIGUOUS';

/**
 * Pure routing / resolution engine for inbound revenue messages.
 *
 * It is split into two deterministic, side-effect-free pieces so they can be
 * unit-tested in isolation (every row of the §6.4 decision table is covered):
 *   1. resolveStoreFromTokens — turn prefix tokens into a candidate outlet.
 *   2. decideResolution        — apply the decision table to the resolved facts.
 *
 * The API/worker is responsible for the DB lookups (which mappings, which
 * outlets exist) and for executing the resulting `action`.
 */

// ---------------------------------------------------------------------------
// Store-identifier resolution
// ---------------------------------------------------------------------------

export interface OutletCandidate {
  outletId: string;
  /** Unique outlet code, e.g. "1234". */
  code: string;
  /** Outlet name plus aliases, each already Turkish-normalized. */
  normalizedNames: string[];
}

export interface EmployeeCandidate {
  employeeId: string;
  outletId: string | null;
  /** Employee full name, Turkish-normalized. */
  normalizedName: string;
}

export type StoreMatchMethod = 'code' | 'alias' | 'fuzzy' | 'employee';

export interface StoreResolution {
  outletId: string;
  method: StoreMatchMethod;
  /** Confidence 0..1 (1 = exact). */
  score: number;
  matchedOn: string;
}

/** Classic Levenshtein edit distance. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length]!;
}

/** Similarity ratio in [0,1] derived from edit distance. */
export function similarity(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - dist / maxLen;
}

/**
 * Resolve a store from the message's prefix tokens.
 * Order: (1) exact outlet code, (2) exact alias, (3) fuzzy name, (4) employee name.
 * Returns null if nothing meets the confidence threshold (we never guess revenue
 * into the wrong store).
 */
export function resolveStoreFromTokens(
  prefixTokens: string[],
  outlets: OutletCandidate[],
  employees: EmployeeCandidate[] = [],
  threshold: number = STORE_FUZZY_MATCH_THRESHOLD,
): StoreResolution | null {
  const normalizedTokens = prefixTokens.map((t) => normalizeTr(t)).filter((t) => t.length > 0);
  const joined = normalizedTokens.join(' ').trim();

  // 1. Exact numeric code match on any token.
  for (const token of prefixTokens) {
    const raw = token.trim();
    if (/^\d+$/.test(raw)) {
      const outlet = outlets.find((o) => o.code === raw);
      if (outlet) return { outletId: outlet.outletId, method: 'code', score: 1, matchedOn: raw };
    }
  }

  if (joined.length === 0) return null;

  // 2. Exact normalized alias match.
  for (const outlet of outlets) {
    if (outlet.normalizedNames.includes(joined)) {
      return { outletId: outlet.outletId, method: 'alias', score: 1, matchedOn: joined };
    }
  }

  // 3. Fuzzy name match (best similarity across all names).
  let best: StoreResolution | null = null;
  for (const outlet of outlets) {
    for (const name of outlet.normalizedNames) {
      const score = similarity(joined, name);
      if (score >= threshold && (best === null || score > best.score)) {
        best = { outletId: outlet.outletId, method: 'fuzzy', score, matchedOn: name };
      }
    }
  }
  if (best) return best;

  // 4. Employee name match -> that employee's outlet.
  for (const emp of employees) {
    if (emp.outletId && (emp.normalizedName === joined || similarity(joined, emp.normalizedName) >= threshold)) {
      return { outletId: emp.outletId, method: 'employee', score: 1, matchedOn: emp.normalizedName };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Decision table (§6.4)
// ---------------------------------------------------------------------------

export type ResolutionAction =
  | 'IGNORE_DUPLICATE'
  | 'LOG_UNPARSEABLE'
  | 'STORE_CONFIRMED'
  | 'ASK_WHICH_OUTLET'
  | 'NOTIFY_MANAGER_MISMATCH'
  | 'CREATE_PENDING_MAPPING'
  | 'ASK_STORE_ID';

export interface ResolutionInput {
  /** waMessageId already seen → idempotency. */
  isDuplicate: boolean;
  /** Parse status of the extracted amount. */
  amountStatus: ParseAmountStatusLike;
  /** ACTIVE outlet ids the sender phone maps to. */
  mappedOutletIds: string[];
  /** Outlet id resolved from the text prefix (store code/name/employee), or null. */
  storeOutletId: string | null;
}

export interface ResolutionDecision {
  status: ResolutionStatus;
  /** Outlet the revenue should be attributed to (null when undecidable). */
  outletId: string | null;
  /** Entry status to write, or null when nothing should be stored yet. */
  entryStatus: EntryStatus | null;
  action: ResolutionAction;
  reason: string;
}

export function decideResolution(input: ResolutionInput): ResolutionDecision {
  const { isDuplicate, amountStatus, mappedOutletIds, storeOutletId } = input;

  if (isDuplicate) {
    return {
      status: ResolutionStatus.DUPLICATE,
      outletId: null,
      entryStatus: null,
      action: 'IGNORE_DUPLICATE',
      reason: 'duplicate waMessageId',
    };
  }

  if (amountStatus !== 'OK') {
    return {
      status: ResolutionStatus.UNPARSEABLE,
      outletId: null,
      entryStatus: null,
      action: 'LOG_UNPARSEABLE',
      reason: `amount not parseable (${amountStatus})`,
    };
  }

  const mappedCount = mappedOutletIds.length;
  const hasStoreId = storeOutletId != null;

  if (mappedCount >= 1) {
    if (hasStoreId) {
      if (mappedOutletIds.includes(storeOutletId)) {
        return {
          status: ResolutionStatus.MAPPED,
          outletId: storeOutletId,
          entryStatus: EntryStatus.CONFIRMED,
          action: 'STORE_CONFIRMED',
          reason: 'mapped sender, store id consistent',
        };
      }
      return {
        status: ResolutionStatus.NEEDS_CONFIRMATION,
        outletId: storeOutletId,
        entryStatus: EntryStatus.PENDING_REVIEW,
        action: 'NOTIFY_MANAGER_MISMATCH',
        reason: 'mapped sender reported for a different store',
      };
    }
    if (mappedCount === 1) {
      return {
        status: ResolutionStatus.MAPPED,
        outletId: mappedOutletIds[0]!,
        entryStatus: EntryStatus.CONFIRMED,
        action: 'STORE_CONFIRMED',
        reason: 'mapped sender, single outlet',
      };
    }
    return {
      status: ResolutionStatus.AMBIGUOUS,
      outletId: null,
      entryStatus: EntryStatus.PENDING_REVIEW,
      action: 'ASK_WHICH_OUTLET',
      reason: 'mapped sender with multiple outlets, no store id',
    };
  }

  // Unmapped / unknown sender.
  if (hasStoreId) {
    return {
      status: ResolutionStatus.NEEDS_CONFIRMATION,
      outletId: storeOutletId,
      entryStatus: EntryStatus.PENDING_REVIEW,
      action: 'CREATE_PENDING_MAPPING',
      reason: 'unknown sender, store resolvable — needs manager approval',
    };
  }

  return {
    status: ResolutionStatus.NEEDS_STORE_ID,
    outletId: null,
    entryStatus: null,
    action: 'ASK_STORE_ID',
    reason: 'unknown sender, no resolvable store',
  };
}
