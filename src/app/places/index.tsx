import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';

import { useTranslation } from '@/i18n';
import { BackLink } from '@/components/back-link';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { PlacesMap, mapAvailable } from '@/components/place-map';
import { Screen } from '@/components/screen';
import { StatusPill } from '@/components/status-pill';
import { TextField } from '@/components/text-field';
import {
  usePlacePhotos,
  usePlaces,
  PLACE_CATEGORIES,
  type Place,
  type PlaceCategory,
} from '@/api/places';
import { useMyAdminUnits, useMyProfile } from '@/api/profile';
import { useMyWeatherPoint } from '@/api/weather';
import { useSession } from '@/store/session';
import { categoryIcon } from '@/lib/place-categories';
import { formatDistance, metresBetween } from '@/lib/distance';
import { getFixIfAllowed, type Fix } from '@/lib/location';
import { fontFamily, layout, radius, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * Browsing the village's places (spec 03.2).
 *
 * **Filter chips, not a dropdown.** Twelve categories and a picker is two taps to find
 * out there are no banks; a chip row shows the whole vocabulary at once, and spec 08.6
 * puts an icon on each so it reads without English.
 *
 * **The map is optional and the list is not.** `react-native-maps` needs an API key the
 * build may not have (see `place-map.tsx`), and a village of thirty places is a list
 * long before it is a map. So the toggle appears only when a map can actually be drawn,
 * and everything works without it.
 *
 * **Distances appear only for someone who already allowed location.** Opening a list of
 * shops must not open a permission dialog; anyone who used the picker's "use my location"
 * in onboarding has already said yes, and gets them for nothing.
 */

function Row({
  place,
  url,
  fix,
  mine,
  onPress,
}: {
  place: Place;
  url: string | null | undefined;
  fix: Fix | null;
  mine: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const colors = useColors();

  const away = fix
    ? formatDistance(metresBetween(fix, { lat: place.lat, lon: place.lon }))
    : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={place.name_en}
      accessibilityHint={t(`places.category.${place.category}`)}
      style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
    >
      <Card>
        <View style={styles.row}>
          {url ? (
            <Image
              source={{ uri: url }}
              style={[styles.thumb, { backgroundColor: colors.surfaceAlt }]}
              contentFit="cover"
              transition={150}
              cachePolicy="disk"
            />
          ) : (
            <View style={[styles.thumb, { backgroundColor: colors.surfaceAlt }]} />
          )}

          <View style={styles.rowText}>
            <Text style={[type.body, styles.name, { color: colors.text }]} numberOfLines={2}>
              {place.name_en}
            </Text>
            {place.name_bft ? (
              <Text style={[type.caption, { color: colors.textSecondary }]} numberOfLines={1}>
                {place.name_bft}
              </Text>
            ) : null}

            {/* Icon and word together, never the icon alone (spec 08.6). */}
            <View style={styles.meta}>
              <Icon name={categoryIcon(place.category)} size={14} color={colors.textSecondary} />
              <Text style={[type.caption, { color: colors.textSecondary }]}>
                {t(`places.category.${place.category}`)}
              </Text>
              {away ? (
                <Text style={[type.caption, { color: colors.textSecondary }]}>
                  {'· '}
                  {t('places.distance', { value: away.value, unit: t(`places.unit.${away.unit}`) })}
                </Text>
              ) : null}
            </View>

            {/* Only ever on your own: nobody else's pending or rejected rows reach this
                screen at all. */}
            {mine && place.status !== 'approved' ? (
              <View style={styles.pill}>
                <StatusPill
                  label={t(`places.status.${place.status}`)}
                  tone={place.status === 'rejected' ? 'danger' : 'warning'}
                />
              </View>
            ) : null}
          </View>

          <Icon name="chevron" size={16} color={colors.textSecondary} />
        </View>
      </Card>
    </Pressable>
  );
}

export default function PlacesScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();

  const { session } = useSession();
  const profile = useMyProfile(session?.user.id);
  const adminUnits = useMyAdminUnits(session?.user.id);
  const villageId = profile.data?.village_id ?? null;
  const userId = session?.user.id ?? null;

  const places = usePlaces(villageId);
  // Named for the weather, but it is the village's own coordinate — falling back to the
  // block when a village has none, which 50 of 129 do not. It is cached for a day, so
  // centring the map here costs nothing.
  const point = useMyWeatherPoint(Boolean(villageId));

  const [category, setCategory] = useState<PlaceCategory | null>(null);
  const [query, setQuery] = useState('');
  const [showMap, setShowMap] = useState(false);
  const [fix, setFix] = useState<Fix | null>(null);

  // Silent: no prompt, no banner, no retry. A missing fix costs the distances and
  // nothing else, and the user never asked for them.
  useEffect(() => {
    let live = true;
    void getFixIfAllowed().then((result) => {
      if (live && result.status === 'ok') setFix(result.fix);
    });
    return () => {
      live = false;
    };
  }, []);

  const rows = useMemo(() => places.data ?? [], [places.data]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((place) => {
      if (category && place.category !== category) return false;
      if (!needle) return true;
      return (
        place.name_en.toLowerCase().includes(needle) ||
        (place.name_bft ?? '').toLowerCase().includes(needle)
      );
    });
  }, [rows, category, query]);

  // The first photo of each is the one the list shows; the rest wait for the detail
  // screen rather than signing thirty URLs nobody looks at.
  const paths = useMemo(() => shown.map((place) => place.photo_paths[0] ?? ''), [shown]);
  const urls = usePlacePhotos(paths);

  const canReview =
    Boolean(villageId) &&
    ((adminUnits.data ?? []).length > 0 ||
      (profile.data?.roles ?? []).includes('super_admin'));

  const pending = rows.filter((place) => place.status === 'pending').length;

  // Only approved places go on the map: a pin is a claim about the village, and an
  // unreviewed one has not earned that. Your own pending place still shows in the list.
  const mappable = useMemo(() => shown.filter((place) => place.status === 'approved'), [shown]);

  const centre = point.data
    ? { lat: point.data.lat, lon: point.data.lon }
    : { lat: 34.5539, lon: 76.1349 }; // Kargil town, if the village has no coordinate

  function open(place: Place) {
    router.push({ pathname: '/places/[id]', params: { id: place.id } });
  }

  return (
    <Screen
      footer={
        <Button
          label={t('places.add')}
          onPress={() => router.push('/places/new')}
          disabled={!villageId}
          accessibilityHint={t('places.addHint')}
        />
      }
    >
      <BackLink />

      <Text style={[type.display, { color: colors.text }]}>{t('places.title')}</Text>
      <Text style={[type.bodySmall, { color: colors.textSecondary }]}>{t('places.intro')}</Text>

      {canReview && pending > 0 ? (
        <Pressable
          onPress={() => router.push('/places/review')}
          accessibilityRole="button"
          accessibilityHint={t('places.reviewHint')}
        >
          <Card>
            <View style={styles.reviewRow}>
              <Icon name="bell" size={18} color={colors.primary} />
              <Text style={[type.bodySmall, styles.name, { color: colors.text }]}>
                {t('places.waiting', { count: pending })}
              </Text>
              <Icon name="chevron" size={16} color={colors.textSecondary} />
            </View>
          </Card>
        </Pressable>
      ) : null}

      <TextField
        label={t('places.search')}
        hint={t('places.searchHint')}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {/* Horizontal, because thirteen chips wrapped is four lines of chrome above the
          thing the user came to read. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        <Chip label={t('places.all')} selected={category === null} onPress={() => setCategory(null)} />
        {PLACE_CATEGORIES.map((key) => (
          <Chip
            key={key}
            label={t(`places.category.${key}`)}
            icon={categoryIcon(key)}
            selected={category === key}
            onPress={() => setCategory(key)}
          />
        ))}
      </ScrollView>

      {mapAvailable() ? (
        <Button
          label={showMap ? t('places.showList') : t('places.showMap')}
          variant="secondary"
          leading={showMap ? 'file' : 'pin'}
          onPress={() => setShowMap((on) => !on)}
        />
      ) : null}

      {places.isPending ? (
        <ActivityIndicator accessibilityLabel={t('common.loading')} color={colors.primary} />
      ) : places.isError ? (
        <Banner
          message={t('errors.unknown')}
          action={
            <Button
              label={t('common.retry')}
              variant="secondary"
              onPress={() => void places.refetch()}
            />
          }
        />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState icon="pin" message={t('places.empty')} />
        </Card>
      ) : showMap ? (
        <PlacesMap places={mappable} centre={centre} onSelect={open} />
      ) : shown.length === 0 ? (
        <Card>
          <EmptyState icon="search" message={t('places.noMatch')} />
        </Card>
      ) : (
        <View style={styles.list}>
          {shown.map((place, index) => (
            <Row
              key={place.id}
              place={place}
              url={urls[index]?.data}
              fix={fix}
              mine={place.submitted_by === userId}
              onPress={() => open(place)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: space.xs, paddingVertical: space.xs },
  list: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.tap },
  thumb: { width: 64, height: 64, borderRadius: radius.card },
  rowText: { flex: 1, gap: 2 },
  name: { fontFamily: fontFamily.semibold, fontWeight: '600' },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.xs },
  pill: { flexDirection: 'row', paddingTop: space.xs },
  reviewRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.tap },
});
