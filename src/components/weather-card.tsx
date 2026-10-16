import { StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { Icon } from '@/components/icon';
import { conditionOf, useWeather, type WeatherDay } from '@/api/weather';
import { fontFamily, radius, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

type Props = {
  coords: { lat: number; lon: number } | null | undefined;
  /** Shown as the location line, so people can see which place the reading is for. */
  placeName: string | undefined;
};

/**
 * Current conditions and a three-day strip for the user's village (spec 03.1).
 *
 * Renders nothing at all when there is no reading — no spinner, no error, no empty state.
 * That is spec 03.1's rule rather than an oversight: weather is optional and hidden by
 * default, and a village screen should not carry a failure message because a forecast
 * server is unreachable. A card that is sometimes absent is the designed behaviour.
 */
export function WeatherCard({ coords, placeName }: Props) {
  const { t } = useTranslation();
  const colors = useColors();
  const weather = useWeather(coords);

  if (!weather.data) return null;

  const { nowC, feelsLikeC, code, days } = weather.data;
  const now = conditionOf(code);

  return (
    <View style={[styles.card, { backgroundColor: colors.primary }]}>
      <View style={styles.row}>
        <View style={[styles.glyph, { backgroundColor: colors.accent }]}>
          <Icon name={now.icon} size={22} color={colors.onPrimary} strokeWidth={2} />
        </View>

        <View style={styles.reading}>
          {/* One accessible label for the whole reading: a screen reader announcing
              "12", "degrees", "Clear", "Minjee" as four nodes is harder to follow. */}
          <Text
            style={[styles.temp, { color: colors.onPrimary }]}
            accessibilityLabel={t('weather.label', {
              condition: t(now.labelKey),
              temp: nowC,
              village: placeName ?? '',
            })}
          >
            {nowC}°
          </Text>
          <Text style={[type.caption, { color: colors.onPrimary, opacity: 0.85 }]} numberOfLines={1}>
            {t(now.labelKey)}
            {placeName ? ` · ${placeName}` : ''}
          </Text>
        </View>

        <View style={styles.feels}>
          <Text style={[type.caption, { color: colors.onPrimary, opacity: 0.8 }]}>
            {t('weather.feelsLike')}
          </Text>
          <Text style={[type.bodySmall, styles.feelsValue, { color: colors.onPrimary }]}>
            {feelsLikeC}°
          </Text>
        </View>
      </View>

      {days.length > 1 ? (
        <View style={[styles.strip, { borderTopColor: colors.onPrimary }]}>
          {days.slice(0, 3).map((day, i) => (
            <Day key={day.date} day={day} index={i} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Day({ day, index }: { day: WeatherDay; index: number }) {
  const { t } = useTranslation();
  const colors = useColors();
  const { icon, labelKey } = conditionOf(day.code);

  // Index rather than date maths: the API returns today first, and deriving "tomorrow"
  // from a date string means picking a timezone, which this card has no need to do.
  const label =
    index === 0
      ? t('weather.today')
      : index === 1
        ? t('weather.tomorrow')
        : weekdayOf(day.date);

  return (
    <View
      style={styles.day}
      accessibilityLabel={`${label}, ${t(labelKey)}, ${Math.round(day.maxC)} to ${Math.round(day.minC)} degrees`}
    >
      <Text style={[type.caption, { color: colors.onPrimary, opacity: 0.8 }]} numberOfLines={1}>
        {label}
      </Text>
      <Icon name={icon} size={18} color={colors.onPrimary} />
      <Text style={[type.caption, styles.dayTemp, { color: colors.onPrimary }]} numberOfLines={1}>
        {Math.round(day.maxC)}° / {Math.round(day.minC)}°
      </Text>
    </View>
  );
}

function weekdayOf(iso: string) {
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString(undefined, { weekday: 'short' });
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.sheet, padding: space.lg, gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  glyph: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  reading: { flex: 1, gap: 2 },
  temp: { fontFamily: fontFamily.semibold, fontSize: 30, lineHeight: 34 },
  feels: { alignItems: 'flex-end', gap: 2 },
  feelsValue: { fontFamily: fontFamily.semibold, fontWeight: '600' },
  strip: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    paddingTop: space.md,
    // The divider is the label colour at low opacity; a border token would be the wrong
    // surface here, since this card is filled with `primary` rather than `surface`.
    opacity: 0.95,
  },
  day: { flex: 1, alignItems: 'center', gap: 4 },
  dayTemp: { fontFamily: fontFamily.semibold },
});
