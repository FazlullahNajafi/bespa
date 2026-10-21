/**
 * "2 days ago" for a notice list (spec 03.1 section 6).
 *
 * Hand-rolled rather than `Intl.RelativeTimeFormat`, for the same reason this project
 * already carries `intl-pluralrules`: Hermes ships a reduced ICU, and what is present
 * varies by platform and build. A date that renders on a developer's machine and shows
 * `[object Object]` on a 2 GB Android in Kargil is exactly the class of defect spec 01.8
 * is written against — and this is sixteen lines.
 *
 * Returns an i18n key and its interpolation values rather than a string, so the caller
 * translates. Urdu and Purgi pluralise differently from English, and a function that
 * returned "3 days ago" would have baked English grammar into a date.
 */

export type RelativeDate = { key: string; values?: { count: number } };

const DAY_MS = 86_400_000;

/** Calendar days between two instants, counted by local date rather than by elapsed ms. */
function calendarDaysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((b - a) / DAY_MS);
}

export function relativeDate(iso: string, now: Date = new Date()): RelativeDate {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return { key: 'date.unknown' };

  // Calendar days, not 24-hour blocks: something posted at 11pm last night is
  // "yesterday" at 8am, not "9 hours ago", which is how a reader thinks about a notice.
  const days = calendarDaysBetween(then, now);

  if (days < 0) return { key: 'date.upcoming' };
  if (days === 0) return { key: 'date.today' };
  if (days === 1) return { key: 'date.yesterday' };
  if (days < 7) return { key: 'date.daysAgo', values: { count: days } };
  if (days < 31) return { key: 'date.weeksAgo', values: { count: Math.floor(days / 7) } };
  if (days < 365) return { key: 'date.monthsAgo', values: { count: Math.floor(days / 30) } };
  return { key: 'date.yearsAgo', values: { count: Math.floor(days / 365) } };
}
