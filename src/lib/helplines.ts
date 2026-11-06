/**
 * Emergency numbers for Kargil (spec 05.2).
 *
 * **Bundled in the binary, not fetched.** This is the one screen in the app that has to
 * work when nothing else does: a fresh install with no account, aeroplane mode, a
 * shutdown, a paused Supabase project, a phone with no data left. A helpline directory
 * behind a network call is a helpline directory that fails on the day it is needed, so
 * these numbers ship inside the APK and the screen never waits for anything.
 *
 * Spec 05.2 also describes a server copy that overrides when it is newer, and that is
 * still the right design for the district landlines, which change. It is deliberately
 * not here yet: the bundled list is the half that must never fail, and adding a live
 * layer before it exists would be putting the fragile half first.
 *
 * ## Where these came from, and what does not match
 *
 * Supplied by the user on 2026-11-06 from kargil.nic.in. Cross-checked the same day
 * against the two official pages, which **disagree in three places** — recorded here
 * rather than quietly resolved, because an emergency number is not something to guess at:
 *
 * - **Ambulance.** The district page lists **102**; the supplied list says **108**. Both
 *   are real and national: 102 is the free government ambulance, 108 the Emergency
 *   Response Service, and 108 is what is actually called in J&K and Ladakh. Both are
 *   listed below. Dropping either would be the worse mistake.
 * - **Child Helpline 1098, Crime Stopper 1090, Women Helpline 1091** do not appear on
 *   either Kargil page. They are correct all-India numbers and they are kept.
 * - **1950** is published as "District Contact Center (For Election Related Queries)",
 *   not as a helpline. Named accordingly.
 *
 * **Both official pages carry "Last Updated: 31.03.2020."** Six years is a long time for
 * a landline, so the screen says so in its footer and links to the source rather than
 * presenting these as checked-this-morning. `112` is first because it is the all-India
 * single emergency number and it reaches the others.
 */

export type HelplineGroup = 'emergency' | 'national' | 'kargil';

export type Helpline = {
  /** Suffix of the `helplines.name.*` i18n key. */
  key: string;
  /** Exactly as dialled. Hyphens are fine in a `tel:` URI. */
  number: string;
  group: HelplineGroup;
};

/**
 * Order is deliberate within each group: the number someone reaches for in a panic goes
 * first, and nothing is sorted alphabetically.
 */
export const HELPLINES: Helpline[] = [
  // The single all-India emergency number. One call reaches police, fire and ambulance,
  // which is why it is first and why it is the one to remember.
  { key: 'all', number: '112', group: 'emergency' },
  { key: 'ambulance', number: '108', group: 'emergency' },
  { key: 'police', number: '100', group: 'emergency' },
  { key: 'fire', number: '101', group: 'emergency' },

  { key: 'ambulanceGov', number: '102', group: 'national' },
  { key: 'child', number: '1098', group: 'national' },
  { key: 'women', number: '1091', group: 'national' },
  { key: 'crime', number: '1090', group: 'national' },

  { key: 'policeControl', number: '01985-232275', group: 'kargil' },
  { key: 'jointControl', number: '01985-232263', group: 'kargil' },
  { key: 'election', number: '1950', group: 'kargil' },
];

export const HELPLINE_GROUPS: HelplineGroup[] = ['emergency', 'national', 'kargil'];

/** Shown in the footer, with the caveat about how old the official page is. */
export const HELPLINE_SOURCE = {
  url: 'https://kargil.nic.in/helpline-for-any-assistance-from-district-administration-kargil/',
  /** When this list was last checked against the source. */
  checked: '2026-11-06',
  /** What the official page itself claims — and it is not recent. */
  pageUpdated: '31.03.2020',
};

export function helplinesIn(group: HelplineGroup): Helpline[] {
  return HELPLINES.filter((line) => line.group === group);
}
