import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';

import { useTranslation } from '@/i18n';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { usePlacePhotos, usePlaces, type Place, type PlaceCategory } from '@/api/places';
import { categoryIcon } from '@/lib/place-categories';
import { fontFamily, radius, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * Home's places section (spec 03.1 §7): horizontal cards, the top six.
 *
 * **Ordered by what someone might need in a hurry**, which is spec 03.1's own priority
 * and not alphabetical or newest-first: hospital, then school, then the places of
 * worship, then the rest. A village's first six places are whatever happened to be
 * added first; this makes the strip answer "where is the dispensary" before "here is a
 * shop somebody photographed on Tuesday".
 *
 * **The empty state asks for the first one**, as spec 03.1 says and spec 04.7 #4's rule
 * demands in general: never fabricate supply, say there is none and offer the action
 * that would change it. It is tappable, which matters more than it sounds — the person
 * looking at an empty village is the person who could fill it.
 */

/** Spec 03.1 §7's ordering. Anything unlisted sorts after everything listed. */
const PRIORITY: PlaceCategory[] = [
  'hospital',
  'school',
  'mosque',
  'imambargah',
  'khanqah',
  'tourist',
  'water_point',
  'bank_atm',
  'government_office',
  'market',
  'sports',
  'other',
];

const LIMIT = 6;

function rank(category: PlaceCategory): number {
  const at = PRIORITY.indexOf(category);
  return at === -1 ? PRIORITY.length : at;
}

export function PlacesStrip({ villageId }: { villageId: string | null | undefined }) {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();

  const places = usePlaces(villageId);

  const shown = useMemo(() => {
    // Approved only: a pending submission is not something the village claims to have,
    // and Home is the most prominent place in the app to claim it.
    const approved = (places.data ?? []).filter((place) => place.status === 'approved');
    return [...approved]
      .sort((a, b) => rank(a.category) - rank(b.category) || a.name_en.localeCompare(b.name_en))
      .slice(0, LIMIT);
  }, [places.data]);

  const paths = useMemo(() => shown.map((place) => place.photo_paths[0] ?? ''), [shown]);
  const urls = usePlacePhotos(paths);

  // Nothing at all while the first load is in flight: a spinner on Home for a section
  // that is usually empty is worse than the section appearing a moment later.
  if (places.isPending) return null;

  if (shown.length === 0) {
    return (
      <Pressable
        onPress={() => router.push('/places/new')}
        accessibilityRole="button"
        accessibilityLabel={t('places.add')}
      >
        <Card>
          <EmptyState icon="pin" message={t('places.emptyHome')} />
        </Card>
      </Pressable>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // `flexGrow: 0`, or the scroller absorbs the vertical slack `Screen`'s content
      // container leaves over — the same thing that made the Places filter row 300px
      // tall before it was pinned.
      style={styles.scroller}
      contentContainerStyle={styles.row}
    >
      {shown.map((place: Place, index) => (
        <Pressable
          key={place.id}
          onPress={() => router.push({ pathname: '/places/[id]', params: { id: place.id } })}
          accessibilityRole="button"
          accessibilityLabel={place.name_en}
          accessibilityHint={t(`places.category.${place.category}`)}
          style={({ pressed }) => [styles.card, { opacity: pressed ? 0.85 : 1 }]}
        >
          {urls[index]?.data ? (
            <Image
              source={{ uri: urls[index].data }}
              style={[styles.photo, { backgroundColor: colors.surfaceAlt }]}
              contentFit="cover"
              transition={150}
              cachePolicy="disk"
            />
          ) : (
            <View style={[styles.photo, { backgroundColor: colors.surfaceAlt }]} />
          )}

          <Text
            style={[type.caption, styles.name, { color: colors.text }]}
            numberOfLines={2}
          >
            {place.name_en}
          </Text>

          {/* Icon and word together, never the icon alone (spec 08.6). */}
          <View style={styles.meta}>
            <Icon name={categoryIcon(place.category)} size={12} color={colors.textSecondary} />
            <Text
              style={[type.caption, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {t(`places.category.${place.category}`)}
            </Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroller: { flexGrow: 0 },
  row: { flexDirection: 'row', gap: space.sm, paddingVertical: space.xs },
  card: { width: 132, gap: space.xs },
  photo: { width: '100%', aspectRatio: 1, borderRadius: radius.card },
  name: { fontFamily: fontFamily.semibold, fontWeight: '600' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
