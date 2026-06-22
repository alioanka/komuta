/** Return YYYY-MM-DD for `date` in the given IANA timezone. */
export function businessDateInTz(date: Date, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(date); // en-CA yields YYYY-MM-DD
}

/** Parse a YYYY-MM-DD string to a UTC Date at midnight (DB @db.Date column). */
export function dateOnly(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

/** Current YYYY-MM month in tz. */
export function periodMonthInTz(date: Date, timeZone: string): string {
  return businessDateInTz(date, timeZone).slice(0, 7);
}
