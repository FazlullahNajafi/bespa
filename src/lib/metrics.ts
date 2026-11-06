import type { VillageStat } from '@/api/village';

/**
 * How a village statistic is named and written out (spec 03.1 §5).
 *
 * `metric_key` is `text` in the database and not an enum, on purpose: spec 03.1 calls its
 * list a *suggested* seed set, and a village must be able to publish a figure nobody
 * anticipated without a migration. So this file is a list of the keys we have a
 * translation and a unit for — not the set of keys that may exist.
 *
 * Anything unknown still renders. `labelKeyFor` falls back to the raw key with its
 * underscores opened out, which is ugly and readable, and that is the right order of
 * priorities for a figure an admin has gone to the trouble of sourcing.
 */

/** Spec 03.1's seed set, in the order the stats screen shows them. */
export const KNOWN_METRICS = [
  'population_total',
  'population_male',
  'population_female',
  'households',
  'literacy_rate',
  'area_hectares',
  'schools',
  'health_centres',
] as const;

export type KnownMetric = (typeof KNOWN_METRICS)[number];

const KNOWN = new Set<string>(KNOWN_METRICS);

export function isKnownMetric(key: string): key is KnownMetric {
  return KNOWN.has(key);
}

/** The i18n key for a metric's name, or null when there is no translation for it. */
export function labelKeyFor(key: string): string | null {
  return isKnownMetric(key) ? `village.metric.${key}` : null;
}

/** What to show when there is no translation: `health_centres` → `health centres`. */
export function humanise(key: string): string {
  return key.replace(/_/g, ' ');
}

/**
 * The number as it is read.
 *
 * Indian digit grouping, which is not the Western one: 2,40,000 rather than 240,000. A
 * population written the wrong way is a population that has to be counted on screen, and
 * `en-IN` is the locale Hermes already knows how to do this with.
 *
 * Percentages keep one decimal and carry their sign; everything else is a whole number,
 * because half a household is not a thing anyone publishes.
 */
export function formatMetric(stat: VillageStat): string {
  if (stat.metric_key.endsWith('_rate') || stat.metric_key.endsWith('_percent')) {
    return `${stat.value.toFixed(1)}%`;
  }
  try {
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(stat.value);
  } catch {
    // Hermes ships a reduced ICU and has surprised this project before. A plain number is
    // worse than a grouped one and far better than a crash on the Home screen.
    return String(Math.round(stat.value));
  }
}

/**
 * The male/female split, when both halves exist for the same year.
 *
 * Spec 03.1 wants a donut here and spec 08's dataviz rules allow one **only** for a two
 * or three category split — which this is, and which almost nothing else in a village's
 * statistics is. Returns null unless both figures are published for the same year:
 * a donut built from a 2011 male count and a 2026 female count would be a drawing of
 * something that never existed.
 */
export function genderSplit(
  latest: VillageStat[],
): { male: VillageStat; female: VillageStat } | null {
  const male = latest.find((s) => s.metric_key === 'population_male');
  const female = latest.find((s) => s.metric_key === 'population_female');
  if (!male || !female) return null;
  if (male.year !== female.year) return null;
  if (male.value + female.value <= 0) return null;
  return { male, female };
}
