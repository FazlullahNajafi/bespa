import { useEffect, useMemo, useState } from 'react';
import { Dimensions, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';

import i18n, { useTranslation } from '@/i18n';
import { BackLink } from '@/components/back-link';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { StatusPill } from '@/components/status-pill';
import { usePlacePhotos, usePlaces, useWithdrawPlace } from '@/api/places';
import { useMyAdminUnits, useMyProfile } from '@/api/profile';
import { useSession } from '@/store/session';
import { categoryIcon } from '@/lib/place-categories';
import { callPlace, openDirections } from '@/lib/place-actions';
import { formatDistance, metresBetween } from '@/lib/distance';
import { formatDay } from '@/lib/format-date';
import { getFixIfAllowed, type Fix } from '@/lib/location';
import { fromE164 } from '@/lib/phone';
import { fontFamily, layout, radius, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * One place (spec 03.2): its photos, what it is, where it is, and how to reach it.
 *
 * Read out of the list's cached query rather than fetched on its own. The list is already
 * in memory by the time anyone taps a row, the rows carry everything this screen shows,
 * and a second request would be a spinner on a screen that could have been instant — on a
 * connection where it may be a long spinner.
 *
 * **Directions hand off to the handset's maps app.** Bespa is not a navigation app and
 * must not look like one: Google Maps knows the roads, works with the screen off, and is
 * already installed. The same for the phone number — `tel:` and the system dialer.
 */
export default function PlaceScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { session } = useSession();
  const profile = useMyProfile(session?.user.id);
  const adminUnits = useMyAdminUnits(session?.user.id);
  const villageId = profile.data?.village_id ?? null;
  const userId = session?.user.id ?? null;

  const places = usePlaces(villageId);
  const withdraw = useWithdrawPlace();

  const place = useMemo(
    () => (places.data ?? []).find((row) => row.id === id) ?? null,
    [places.data, id],
  );

  const paths = useMemo(() => place?.photo_paths ?? [], [place]);
  const urls = usePlacePhotos(paths);

  const [index, setIndex] = useState(0);
  const [fix, setFix] = useState<Fix | null>(null);
  const width = Dimensions.get('window').width - layout.gutter * 2;

  useEffect(() => {
    let live = true;
    void getFixIfAllowed().then((result) => {
      if (live && result.status === 'ok') setFix(result.fix);
    });
    return () => {
      live = false;
    };
  }, []);

  if (!place) {
    // Either still loading the list or the place was withdrawn from under this screen.
    // Both are "nothing to show here", and the back link is the way out of both.
    return (
      <Screen>
        <BackLink />
      </Screen>
    );
  }

  const canModerate =
    (adminUnits.data ?? []).length > 0 || (profile.data?.roles ?? []).includes('super_admin');
  const mine = place.submitted_by === userId;

  const away = fix
    ? formatDistance(metresBetween(fix, { lat: place.lat, lon: place.lon }))
    : null;

  return (
    <Screen>
      <BackLink />

      {/* The photos, paged by screen width. Same shape as the gallery pager and for the
          same reason: "one item per screen, snap to it" is not worth a dependency. */}
      <FlatList
        data={paths}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        keyExtractor={(path) => path}
        onMomentumScrollEnd={(event) =>
          setIndex(Math.round(event.nativeEvent.contentOffset.x / width))
        }
        renderItem={({ index: i }) => (
          <View style={{ width }}>
            {urls[i]?.data ? (
              <Image
                source={{ uri: urls[i].data }}
                style={[styles.photo, { backgroundColor: colors.surfaceAlt }]}
                contentFit="cover"
                transition={150}
                cachePolicy="disk"
                accessibilityLabel={t('places.photo')}
              />
            ) : (
              <View style={[styles.photo, { backgroundColor: colors.surfaceAlt }]} />
            )}
          </View>
        )}
      />

      {paths.length > 1 ? (
        <View style={styles.dots}>
          {paths.map((path, i) => (
            <View
              key={path}
              style={[styles.dot, { backgroundColor: i === index ? colors.primary : colors.border }]}
            />
          ))}
        </View>
      ) : null}

      <Text style={[type.display, { color: colors.text }]}>{place.name_en}</Text>
      {place.name_bft ? (
        <Text style={[type.body, { color: colors.textSecondary }]}>{place.name_bft}</Text>
      ) : null}

      <View style={styles.meta}>
        <Icon name={categoryIcon(place.category)} size={16} color={colors.textSecondary} />
        <Text style={[type.bodySmall, { color: colors.textSecondary }]}>
          {t(`places.category.${place.category}`)}
        </Text>
        {away ? (
          <Text style={[type.bodySmall, { color: colors.textSecondary }]}>
            {'· '}
            {t('places.distance', { value: away.value, unit: t(`places.unit.${away.unit}`) })}
          </Text>
        ) : null}
      </View>

      {place.status !== 'approved' ? (
        <View style={styles.meta}>
          <StatusPill
            label={t(`places.status.${place.status}`)}
            tone={place.status === 'rejected' ? 'danger' : 'warning'}
          />
        </View>
      ) : null}

      {place.status === 'rejected' && place.reject_reason ? (
        <Text style={[type.bodySmall, { color: colors.danger }]}>
          {t('places.rejectedBecause', { reason: place.reject_reason })}
        </Text>
      ) : null}

      {place.description ? (
        <Card>
          <Text style={[type.body, { color: colors.text }]}>{place.description}</Text>
        </Card>
      ) : null}

      {place.timings ? (
        <View style={styles.meta}>
          <Icon name="clock" size={16} color={colors.textSecondary} />
          <Text style={[type.bodySmall, { color: colors.text }]}>
            {t('places.timings')}: {place.timings}
          </Text>
        </View>
      ) : null}

      <Button
        label={t('places.directions')}
        leading={<Icon name="locate" size={20} color={colors.onPrimary} />}
        onPress={() => void openDirections(place.lat, place.lon, place.name_en)}
        accessibilityHint={t('places.directionsHint')}
      />

      {place.phone ? (
        <Button
          label={`${t('places.call')} ${fromE164(place.phone)}`}
          variant="secondary"
          leading={<Icon name="phone" size={20} color={colors.primary} />}
          onPress={() => void callPlace(place.phone as string)}
        />
      ) : null}

      {/* Spec 03.2 credits whoever added it. A name is always visible (spec 03.4), so
          there is nothing to hide behind a privacy setting here. */}
      <Pressable disabled accessibilityRole="text">
        <Text style={[type.caption, { color: colors.textSecondary }]}>
          {t('places.addedBy', { name: place.submitter?.full_name ?? t('places.someone') })}
          {' · '}
          {formatDay(new Date(place.created_at), i18n.language)}
        </Text>
      </Pressable>

      {mine || canModerate ? (
        <Button
          label={t('places.withdraw')}
          variant="ghost"
          loading={withdraw.isPending}
          onPress={async () => {
            const result = await withdraw.mutateAsync(place.id);
            if (result.ok) router.back();
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.card },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: space.xs },
  dot: { width: 6, height: 6, borderRadius: 3 },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.xs },
  name: { fontFamily: fontFamily.semibold, fontWeight: '600' },
});
