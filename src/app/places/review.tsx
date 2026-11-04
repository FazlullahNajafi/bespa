import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { useTranslation } from '@/i18n';
import { BackLink } from '@/components/back-link';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { usePendingPlaces, usePlacePhotos, useReviewPlace } from '@/api/places';
import { useMyAdminUnits, useMyProfile } from '@/api/profile';
import { useSession } from '@/store/session';
import { categoryIcon } from '@/lib/place-categories';
import { openDirections } from '@/lib/place-actions';
import { relativeDate } from '@/lib/relative-date';
import { fontFamily, radius, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * The places queue (spec 03.2), the same shape as the gallery's and with the same two
 * rules: a rejection **must carry a reason**, because the person who sent it reads it and
 * an unexplained refusal in a village of two hundred people is a grievance with a name on
 * it; and the decision goes through the outbox, so moderating on a bad connection queues
 * rather than fails.
 *
 * One thing is different. A place makes a claim a photo does not — that this building is
 * here, at this coordinate — so the row carries a **Directions** button. An admin who
 * does not recognise the name can go and look, or at least see whether the pin landed in
 * the village at all. A photo is judged from the photo; a location cannot be.
 *
 * Oldest first, deliberately: a queue that shows the newest first is a queue where the
 * first thing anyone sent waits longest.
 */
export default function PlacesReviewScreen() {
  const { t } = useTranslation();
  const colors = useColors();

  const { session } = useSession();
  const profile = useMyProfile(session?.user.id);
  const adminUnits = useMyAdminUnits(session?.user.id);
  const villageId = profile.data?.village_id ?? null;

  const canReview =
    Boolean(villageId) &&
    ((adminUnits.data ?? []).length > 0 ||
      (profile.data?.roles ?? []).includes('super_admin'));

  const pending = usePendingPlaces(villageId, canReview);
  const review = useReviewPlace();

  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  // Memoised together: `?? []` makes a new array every render, which would make the paths
  // a new array too and re-sign every URL on every keystroke.
  const rows = useMemo(() => pending.data ?? [], [pending.data]);
  // The first photo of each. The rest are on the detail screen; an admin deciding yes or
  // no does not need five signed URLs per row.
  const paths = useMemo(() => rows.map((place) => place.photo_paths[0] ?? ''), [rows]);
  const urls = usePlacePhotos(paths);

  async function decide(id: string, approve: boolean) {
    setError(null);
    const reason = (reasons[id] ?? '').trim();

    if (!approve && !reason) {
      setError('places.reasonRequired');
      return;
    }

    const result = await review.mutateAsync({
      id,
      approve,
      reason: approve ? undefined : reason,
    });
    if (result.ok || 'queued' in result) {
      setReasons((current) => ({ ...current, [id]: '' }));
      return;
    }
    setError(`errors.${result.code}`);
  }

  return (
    <Screen>
      <BackLink />

      <Text style={[type.display, { color: colors.text }]}>{t('places.review')}</Text>
      <Text style={[type.bodySmall, { color: colors.textSecondary }]}>
        {t('places.reviewIntro')}
      </Text>

      {error ? <Banner message={t(error)} tone="danger" /> : null}

      {!canReview ? (
        <Banner message={t('errors.not_permitted')} tone="danger" />
      ) : pending.isPending ? (
        <ActivityIndicator accessibilityLabel={t('common.loading')} color={colors.primary} />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState icon="check" message={t('places.nothingWaiting')} />
        </Card>
      ) : (
        rows.map((place, index) => {
          const when = relativeDate(place.created_at);
          return (
            <Card key={place.id}>
              {urls[index]?.data ? (
                <Image
                  source={{ uri: urls[index].data }}
                  style={[styles.preview, { backgroundColor: colors.surfaceAlt }]}
                  contentFit="cover"
                  transition={150}
                  cachePolicy="disk"
                  accessibilityLabel={t('places.photo')}
                />
              ) : (
                <View style={[styles.preview, { backgroundColor: colors.surfaceAlt }]} />
              )}

              <Text style={[type.body, styles.name, { color: colors.text }]}>
                {place.name_en}
              </Text>
              {place.name_bft ? (
                <Text style={[type.bodySmall, { color: colors.textSecondary }]}>
                  {place.name_bft}
                </Text>
              ) : null}

              <View style={styles.meta}>
                <Icon name={categoryIcon(place.category)} size={14} color={colors.textSecondary} />
                <Text style={[type.caption, { color: colors.textSecondary }]}>
                  {t(`places.category.${place.category}`)}
                </Text>
                <Text style={[type.caption, { color: colors.textSecondary }]}>
                  {'· '}
                  {t('places.photos', { count: place.photo_paths.length })}
                </Text>
              </View>

              {place.description ? (
                <Text style={[type.bodySmall, { color: colors.text }]}>{place.description}</Text>
              ) : null}

              <Text style={[type.caption, { color: colors.textSecondary }]}>
                {t('places.addedBy', {
                  name: place.submitter?.full_name ?? t('places.someone'),
                })}
                {' · '}
                {t(when.key, when.values)}
              </Text>

              <Button
                label={t('places.directions')}
                variant="ghost"
                leading={<Icon name="locate" size={20} color={colors.primary} />}
                onPress={() => void openDirections(place.lat, place.lon, place.name_en)}
                accessibilityHint={t('places.directionsHint')}
              />

              {/* Filled in only when rejecting. The server refuses a rejection without
                  one, so this is not a nicety the client could skip. */}
              <TextField
                label={t('places.reason')}
                hint={t('places.reasonHint')}
                value={reasons[place.id] ?? ''}
                onChangeText={(value) =>
                  setReasons((current) => ({ ...current, [place.id]: value }))
                }
                maxLength={200}
                autoCapitalize="sentences"
              />

              <View style={styles.actions}>
                <View style={styles.action}>
                  <Button
                    label={t('places.approve')}
                    onPress={() => void decide(place.id, true)}
                    disabled={review.isPending}
                  />
                </View>
                <View style={styles.action}>
                  <Button
                    label={t('places.reject')}
                    variant="danger"
                    onPress={() => void decide(place.id, false)}
                    disabled={review.isPending}
                  />
                </View>
              </View>
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.card },
  name: { fontFamily: fontFamily.semibold, fontWeight: '600' },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.xs },
  actions: { flexDirection: 'row', gap: space.sm },
  action: { flex: 1 },
});
