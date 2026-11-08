import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { Avatar } from '@/components/avatar';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Icon, type IconName } from '@/components/icon';
import { Screen } from '@/components/screen';
import { NoticeCard } from '@/components/notice-card';
import { PlacesStrip } from '@/components/places-strip';
import { StatGrid } from '@/components/stat-grid';
import { VillageBanner } from '@/components/village-banner';
import { WeatherCard } from '@/components/weather-card';
import { useGeoUnit } from '@/api/geo';
import { useNotices } from '@/api/notices';
import { useMyWeatherPoint } from '@/api/weather';
import { useMyProfile } from '@/api/profile';
import { latestByMetric, useVillageProfile, useVillageStats } from '@/api/village';
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
  { key: 'directory', icon: 'people', labelKey: 'directory.tile', href: '/directory', tint: 'primary' },
  { key: 'gallery', icon: 'image', labelKey: 'gallery.tile', href: '/gallery', tint: 'accent' },
  { key: 'places', icon: 'pin', labelKey: 'places.tile', href: '/places', tint: 'primary' },
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
  // Spec 03.1 section 6: the latest three, pinned first. The query already orders
  // that way, so the limit is the whole of the rule.
  const notices = useNotices(Boolean(profile.data?.village_id), 3);
  // Sections 3 and 5 of spec 03.1. Both are cached for an hour and both render nothing
  // rather than a placeholder when an admin has written nothing — the app ships no fake
  // data (spec 01.8 #4), and an empty card at the top of Home is the most prominent
  // place possible to put one.
  const page = useVillageProfile(profile.data?.village_id);
  const stats = useVillageStats(profile.data?.village_id);
  const latest = useMemo(() => latestByMetric(stats.data ?? []), [stats.data]);

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
            <Avatar name={name} size={44} preset={profile.data?.avatar_preset} />
          </Pressable>
        ) : null}
      </View>

      {/* Absent, not empty, when there is no reading — spec 03.1 hides the section on
          failure rather than showing an error. */}
      <WeatherCard
        coords={point.data ? { lat: point.data.lat, lon: point.data.lon } : null}
        placeName={point.data?.place}
      />

      {/* Section 2 of spec 03.1, between the header and the weather. Renders nothing at
          all until an admin has chosen photos, and nothing in Lite mode. */}
      <VillageBanner villageId={profile.data?.village_id} />

      {/* Section 3 — the my-village card. Always tappable, even with no description:
          the About page carries the places count, the member count and the figures, and
          an admin with nothing written yet is exactly the person who needs to reach the
          edit screen behind it. That lesson is the notices empty state's, below. */}
      <Pressable
        onPress={() => router.push('/village')}
        accessibilityRole="button"
        accessibilityLabel={t('village.card')}
      >
        <Card>
          <View style={styles.villageRow}>
            <View style={styles.villageText}>
              <Text style={[type.bodySmall, styles.villageTitle, { color: colors.text }]}>
                {t('village.card')}
              </Text>
              <Text
                style={[type.caption, { color: colors.textSecondary }]}
                numberOfLines={3}
              >
                {page.data?.description ?? t('village.noDescription')}
              </Text>
            </View>
            <Icon name="chevron" size={16} color={colors.textSecondary} />
          </View>
        </Card>
      </Pressable>

      {/* Section 5 — statistics. Absent entirely until a figure has been published,
          because "Village statistics not published yet" under a heading is still a
          section about nothing. */}
      {latest.length > 0 ? (
        <>
          <Text style={[type.caption, styles.sectionLabel, { color: colors.textSecondary }]}>
            {t('village.stats')}
          </Text>
          <Pressable
            onPress={() => router.push('/village/stats')}
            accessibilityRole="button"
            accessibilityLabel={t('village.statsAll')}
          >
            <StatGrid latest={latest} />
          </Pressable>
        </>
      ) : null}

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
        {t('home.notices')}
      </Text>

      {/* Spec 03.1 makes every section independently empty-able, and this one carries
          the district mirror as well as the village's own notices — so it has content
          on day one even in a village whose sarpanch has never posted (spec 09.3
          risk 1b). */}
      {notices.data && notices.data.length > 0 ? (
        <View style={styles.notices}>
          {notices.data.map((notice) => (
            <NoticeCard
              key={notice.id}
              notice={notice}
              onOpenDetail={() => router.push(`/notices/${notice.id}`)}
            />
          ))}
          <Pressable
            onPress={() => router.push('/notices')}
            accessibilityRole="button"
            style={styles.seeAll}
          >
            <Text style={[type.bodySmall, styles.seeAllText, { color: colors.primary }]}>
              {t('notices.seeAll')}
            </Text>
          </Pressable>
        </View>
      ) : (
        /* Tappable even with nothing in it, and that is not a detail: the route to the
           notices screen used to live inside the branch above, so a village with no
           notices had no way to reach it — and the admin who could write the first one
           was the person most firmly locked out. The cold-start case is the one that
           has to work. */
        <Pressable
          onPress={() => router.push('/notices')}
          accessibilityRole="button"
          accessibilityLabel={t('notices.title')}
          accessibilityHint={t('notices.opensList')}
        >
          <Card>
            <EmptyState icon="bell" message={t('notices.empty')} />
          </Card>
        </Pressable>
      )}

      {/* Section 7 of spec 03.1. Keeps its heading even when empty, because the empty
          state is an invitation to add the first place rather than an apology. */}
      <Pressable
        onPress={() => router.push('/places')}
        accessibilityRole="button"
        accessibilityLabel={t('places.title')}
      >
        <Text style={[type.caption, styles.sectionLabel, { color: colors.textSecondary }]}>
          {t('places.title')}
        </Text>
      </Pressable>

      <PlacesStrip villageId={profile.data?.village_id} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  headerText: { flex: 1, gap: 2 },
  eyebrow: { textTransform: 'uppercase', letterSpacing: 0.6, fontFamily: fontFamily.semibold },
  avatarTap: { minWidth: layout.tap, minHeight: layout.tap, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { textTransform: 'uppercase', letterSpacing: 0.6, fontFamily: fontFamily.semibold },
  villageRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.tap },
  villageText: { flex: 1, gap: 2 },
  villageTitle: { fontFamily: fontFamily.semibold, fontWeight: '600' },
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
  notices: { gap: space.sm },
  seeAll: { minHeight: layout.tap, justifyContent: 'center' },
  seeAllText: { fontFamily: fontFamily.semibold, fontWeight: '600' },
});
