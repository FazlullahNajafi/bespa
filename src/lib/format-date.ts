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
