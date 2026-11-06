import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useTranslation } from '@/i18n';
import { formatMetric, genderSplit, humanise, labelKeyFor } from '@/lib/metrics';
import type { VillageStat } from '@/api/village';
import { fontFamily, radius, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * Village statistics (spec 03.1 §5).
 *
 * **Every figure carries its year.** Not as a footnote — next to the number, in the same
 * block, because the whole reason this screen exists in 2026 is that Ladakh's census is
 * being retaken and nothing here is current. A population shown bare is a claim about
 * today; "2,140 · as of 2011" is a fact. The source sits under it on the full screen,
 * where there is room for the whole string.
 *
 * **The donut is only ever the male/female split.** Spec 08's dataviz rules permit one
 * for a two or three category split and nothing else, and in a village's statistics
 * nothing else qualifies — literacy against what, households against what. Everything
 * else is a plain figure, which is also what a reader wants from "how many schools".
 *
 * A donut drawn with two `Circle`s and `strokeDasharray` rather than a charting library:
 * the whole shape is one arc over another, and a dependency for that is a dependency to
 * keep upgrading. Colour is never the only signal (spec 08.1), so each half is labelled
 * with its word and its number beside the ring.
 */

const RING = 108;
const STROKE = 18;
const RADIUS = (RING - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function Donut({ male, female }: { male: VillageStat; female: VillageStat }) {
  const { t } = useTranslation();
  const colors = useColors();

  const total = male.value + female.value;
  const maleShare = male.value / total;

  return (
    <View style={styles.donutRow}>
      <Svg width={RING} height={RING} aria-hidden>
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={RADIUS}
          stroke={colors.accent}
          strokeWidth={STROKE}
          fill="none"
        />
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={RADIUS}
          stroke={colors.primary}
          strokeWidth={STROKE}
          fill="none"
          strokeDasharray={`${CIRCUMFERENCE * maleShare} ${CIRCUMFERENCE}`}
          // Start at twelve o'clock rather than three, which is where a reader expects a
          // share to begin.
          transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
        />
      </Svg>

      <View style={styles.legend}>
        {[
          { stat: male, colour: colors.primary },
          { stat: female, colour: colors.accent },
        ].map(({ stat, colour }) => (
          <View key={stat.metric_key} style={styles.legendRow}>
            <View style={[styles.swatch, { backgroundColor: colour }]} />
            <Text style={[type.bodySmall, { color: colors.text }]}>
              {labelKeyFor(stat.metric_key)
                ? t(labelKeyFor(stat.metric_key) as string)
                : humanise(stat.metric_key)}
            </Text>
            <Text style={[type.bodySmall, styles.value, { color: colors.text }]}>
              {formatMetric(stat)}
            </Text>
          </View>
        ))}
        <Text style={[type.caption, { color: colors.textSecondary }]}>
          {t('village.asOf', { year: male.year })}
        </Text>
      </View>
    </View>
  );
}

function Figure({ stat, showSource }: { stat: VillageStat; showSource: boolean }) {
  const { t } = useTranslation();
  const colors = useColors();
  const key = labelKeyFor(stat.metric_key);

  return (
    <View style={[styles.figure, { backgroundColor: colors.surfaceAlt }]}>
      <Text style={[type.display, styles.number, { color: colors.text }]}>
        {formatMetric(stat)}
      </Text>
      <Text style={[type.bodySmall, { color: colors.text }]}>
        {key ? t(key) : humanise(stat.metric_key)}
      </Text>
      {/* The year is never optional. See the header. */}
      <Text style={[type.caption, { color: colors.textSecondary }]}>
        {showSource
          ? t('village.sourceYear', { source: stat.source, year: stat.year })
          : t('village.asOf', { year: stat.year })}
      </Text>
    </View>
  );
}

export function StatGrid({
  latest,
  showSource = false,
}: {
  /** One row per metric — the newest year published for each. */
  latest: VillageStat[];
  /** The full statistics screen shows the whole source string; Home has no room. */
  showSource?: boolean;
}) {
  const split = genderSplit(latest);

  // The two halves of the donut are not repeated as tiles beneath it.
  const tiles = split
    ? latest.filter(
        (s) => s.metric_key !== 'population_male' && s.metric_key !== 'population_female',
      )
    : latest;

  return (
    <View style={styles.wrap}>
      {split ? <Donut male={split.male} female={split.female} /> : null}
      {tiles.length > 0 ? (
        <View style={styles.grid}>
          {tiles.map((stat) => (
            <Figure key={`${stat.metric_key}-${stat.year}`} stat={stat} showSource={showSource} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  legend: { flex: 1, gap: space.xs },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  value: { flex: 1, textAlign: 'right', fontFamily: fontFamily.semibold, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  figure: {
    flexGrow: 1,
    flexBasis: '45%',
    borderRadius: radius.card,
    padding: space.sm,
    gap: 2,
  },
  number: { fontFamily: fontFamily.semibold, fontWeight: '600' },
});
