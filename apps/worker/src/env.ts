/** Minimal env access for the worker (validated lightly). */
export const env = {
  DATABASE_URL: process.env.DATABASE_URL ?? '',
  REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ?? '',
  TELEGRAM_DEFAULT_CHAT_ID: process.env.TELEGRAM_DEFAULT_CHAT_ID ?? '',
  REPORTING_CUTOFF_LOCAL: process.env.REPORTING_CUTOFF_LOCAL ?? '21:00',
  DEFAULT_TIMEZONE: process.env.DEFAULT_TIMEZONE ?? 'Europe/Istanbul',
};
