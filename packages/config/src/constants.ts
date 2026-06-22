/** Shared, non-secret constants used across apps. */

export const DEFAULT_TIMEZONE = 'Europe/Istanbul';
export const DEFAULT_CURRENCY = 'TRY';

/** Default daily reporting cutoff (local time, HH:mm). Overridable via Setting/env. */
export const DEFAULT_REPORTING_CUTOFF_LOCAL = '21:00';

/** Default anomaly threshold (percent deviation from trailing average). */
export const DEFAULT_ANOMALY_THRESHOLD_PCT = 40;

/** Maximum plausible single-day revenue (mirrors packages/money MAX_AMOUNT). */
export const MAX_REVENUE_AMOUNT = 100_000_000;

/** WhatsApp customer-service window length in milliseconds (24h). */
export const WHATSAPP_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Default Graph API version (pinned; override with META_GRAPH_VERSION). */
export const DEFAULT_META_GRAPH_VERSION = 'v23.0';

/** Fuzzy-match confidence threshold (0..1) below which a store is NOT auto-resolved. */
export const STORE_FUZZY_MATCH_THRESHOLD = 0.82;

/** Account lockout policy. */
export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

/** Pagination defaults. */
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;
