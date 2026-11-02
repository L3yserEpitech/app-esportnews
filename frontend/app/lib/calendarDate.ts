// Liquipedia dates carry no zone ("2018-10-08 00:00:00", "2026-01-01") or are a
// bare day stamped midnight UTC: they name a calendar day. Going through the
// browser's zone would move the day, and make the server and the client disagree.
export function formatCalendarDate(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions,
): string {
  const parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  if (!parts) return '';
  const [, year, month, day] = parts.map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('fr-FR', { ...options, timeZone: 'UTC' });
}

// Tournaments are reckoned in UTC days by the backend (dates, by-date, status): the
// visitor's local day could list one the backend already calls finished.
export function todayCalendarDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
