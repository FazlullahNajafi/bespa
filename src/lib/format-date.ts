/**
 * A date a reader can act on, spelled out and in the app's language.
 *
 * `7/12/2026` is 7 December on a phone set to en-IN and 12 July on one set to en-US, and
 * several notices are land-acquisition notices whose objection window closes on that
 * date. A numeric date is the one thing on those screens someone could act on and be
 * wrong about, so the month is always named.
 *
 * The locale is passed in rather than read here: it is the *app's* language, not the
 * handset's, because someone reading Bespa in Urdu did not ask for English months.
 */
export function formatDay(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * `06-11-2026` — day, month, year, in that order.
 *
 * Used where someone is *choosing* a date rather than reading one: the picker's button
 * and the trip form. The spelled-out form above stays on cards and notices, because a
 * reader scanning a list is the case that rule was written for.
 *
 * This is not a retreat from that rule. `7/12/2026` is ambiguous because nothing on the
 * screen says which number is the month; a picker shows the month by name directly above
 * the grid you tapped, so the order is never in doubt. It replaced an ISO `YYYY-MM-DD`
 * field and a row of `11-06` chips, which were ambiguous in exactly the way the rule
 * is about.
 */
export function formatDMY(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
}

/** `2026-11-06`, the wire format. Local parts, so it never slips a day across midnight. */
export function toISODate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parses the wire format back without the UTC shift `new Date('2026-11-06')` applies. */
export function fromISODate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}
