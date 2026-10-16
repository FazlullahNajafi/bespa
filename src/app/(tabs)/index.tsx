import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { Avatar } from '@/components/avatar';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Icon, type IconName } from '@/components/icon';
import { Screen } from '@/components/screen';
import { WeatherCard } from '@/components/weather-card';
import { useGeoUnit } from '@/api/geo';
import { useMyWeatherPoint } from '@/api/weather';
import { useMyProfile } from '@/api/profile';
import { useSession } from '@/store/session';
import { fontFamily, layout, radius, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * Home (spec 09.1), following the design's dashboard.
 *
 * The weather card is real (spec 03.1, Open-Meteo). The design's unread badges and its
 * "Today in the valley" feed are not: the schema is still Phase 0 — geo_units, profiles,
 * profile_private, privacy_settings and two logs — so there is no notices table and no
 * events table behind either of them.
 *
 * Inventing that content is the one thing spec 01.8 #4 rules out, so the feed is an empty
 * state that says what is missing, and the weather card waits for a provider. The
 * greeting and the tiles are real: they read the signed-in profile and navigate to screens
 * that exist.
 */

type Tile = {
  key: string;
  icon: IconName;
  labelKey: string;
  href: string;
  tint: 'primary' | 'accent' | 'info';
};

/**
 * Only destinations that exist. The design shows six tiles — Notices, Members, Cabs,
 * Bespa AI, Community, Gallery — but four of those have neither a screen nor a table, and
 * a tile that goes nowhere is a promise the app does not keep. They return as their
 * features land.
 */
const TILES: Tile[] = [
  { key: 'transport', icon: 'car', labelKey: 'tabs.transport', href: '/(tabs)/transport', tint: 'primary' },
  { key: 'calendar', icon: 'flag', labelKey: 'tabs.calendar', href: '/(tabs)/calendar', tint: 'accent' },
  { key: 'services', icon: 'file', labelKey: 'tabs.services', href: '/(tabs)/services', tint: 'info' },
];

export default function HomeScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();

  const { session } = useSession();
  const profile = useMyProfile(session?.user.id);
  const village = useGeoUnit(profile.data?.village_id);
  const point = useMyWeatherPoint(Boolean(profile.data?.village_id));

  const name = profile.data?.full_name?.trim() || '';
  const tint = {
    primary: { soft: colors.infoSurface, solid: colors.primary },
    accent: { soft: colors.accentSoft, solid: colors.accent },
    info: { soft: colors.surfaceAlt, solid: colors.info },
  };

  return (
    <Screen>
      {/* Greeting. Village first and in caps: it is the thing that decides what the rest
          of the app shows, so it reads as context rather than decoration. */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[type.caption, styles.eyebrow, { color: colors.textSecondary }]}>
            {village.data ? village.data.name_en : t('home.yourVillage')}
          </Text>
          <Text style={[type.display, { color: colors.text }]} numberOfLines={2}>
            {name ? t('home.greetingNamed', { name }) : t('home.greeting')}
          </Text>
        </View>
        {name ? (
          <Pressable
            onPress={() => router.push('/(tabs)/profile')}
            accessibilityRole="button"
            accessibilityLabel={t('home.openProfile')}
            style={styles.avatarTap}
          >
            <Avatar name={name} size={44} />
          </Pressable>
        ) : null}
      </View>

      {/* Absent, not empty, when there is no reading — spec 03.1 hides the section on
          failure rather than showing an error. */}
      <WeatherCard
        coords={point.data ? { lat: point.data.lat, lon: point.data.lon } : null}
        placeName={point.data?.place}
      />

      <Text style={[type.caption, styles.sectionLabel, { color: colors.textSecondary }]}>
        {t('home.quickAccess')}
      </Text>

      <View style={styles.grid}>
        {TILES.map((tile) => (
          <Pressable
            key={tile.key}
            onPress={() => router.push(tile.href as never)}
            accessibilityRole="button"
            accessibilityLabel={t(tile.labelKey)}
            style={({ pressed }) => [
              styles.tile,
              {
                backgroundColor: colors.surface,
                borderColor: colors.borderSoft,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <View style={[styles.tileIcon, { backgroundColor: tint[tile.tint].soft }]}>
              <Icon name={tile.icon} size={20} color={tint[tile.tint].solid} />
            </View>
            <Text style={[type.caption, styles.tileLabel, { color: colors.text }]} numberOfLines={2}>
              {t(tile.labelKey)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={[type.caption, styles.sectionLabel, { color: colors.textSecondary }]}>
        {t('home.todayInValley')}
      </Text>

      <Card>
        <EmptyState icon="bell" message={t('home.noActivity')} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  headerText: { flex: 1, gap: 2 },
  eyebrow: { textTransform: 'uppercase', letterSpacing: 0.6, fontFamily: fontFamily.semibold },
  avatarTap: { minWidth: layout.tap, minHeight: layout.tap, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { textTransform: 'uppercase', letterSpacing: 0.6, fontFamily: fontFamily.semibold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: {
    flexBasis: '31%',
    flexGrow: 1,
    minHeight: 96,
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.card,
    borderWidth: 1,
  },
  tileIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: { fontFamily: fontFamily.semibold },
});
