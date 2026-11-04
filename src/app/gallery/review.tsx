import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { useTranslation } from '@/i18n';
import { BackLink } from '@/components/back-link';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { useImageUrls, usePendingGallery, useReviewImage } from '@/api/gallery';
import { useMyAdminUnits, useMyProfile } from '@/api/profile';
import { useSession } from '@/store/session';
import { relativeDate } from '@/lib/relative-date';
import { fontFamily, radius, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * The moderation queue (spec 03.3), and the first screen in the app where one person
 * decides what others see.
 *
 * Two things follow from that and are not negotiable in the UI. A rejection **must carry
 * a reason** — the server refuses one without, and the reason is shown to the person who
 * sent the photo, because an unexplained rejection in a village of two hundred people is
 * a grievance with a name on it. And the decision goes through the outbox like every
 * other write, so moderating on a bad connection queues rather than fails.
 *
 * Oldest first, deliberately: a queue that shows the newest first is a queue where the
 * first photo anyone sent waits longest.
 */
export default function GalleryReviewScreen() {
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

  const pending = usePendingGallery(villageId, canReview);
  const review = useReviewImage();

  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  // Memoised together: `?? []` makes a new array every render, which would make the
  // paths a new array too and re-sign every URL on every keystroke.
  const rows = useMemo(() => pending.data ?? [], [pending.data]);
  const paths = useMemo(() => rows.map((image) => image.storage_path), [rows]);
  const urls = useImageUrls(paths);

  async function decide(id: string, approve: boolean) {
    setError(null);
    const reason = (reasons[id] ?? '').trim();

    if (!approve && !reason) {
      setError('gallery.reasonRequired');
      return;
    }

    const result = await review.mutateAsync({ id, approve, reason: approve ? undefined : reason });
    if (result.ok || 'queued' in result) {
      setReasons((current) => ({ ...current, [id]: '' }));
      return;
    }
    setError(`errors.${result.code}`);
  }

  return (
    <Screen>
      <BackLink />

      <Text style={[type.display, { color: colors.text }]}>{t('gallery.review')}</Text>
      <Text style={[type.bodySmall, { color: colors.textSecondary }]}>
        {t('gallery.reviewIntro')}
      </Text>

      {error ? <Banner message={t(error)} tone="danger" /> : null}

      {!canReview ? (
        <Banner message={t('errors.not_permitted')} tone="danger" />
      ) : pending.isPending ? (
        <ActivityIndicator accessibilityLabel={t('common.loading')} color={colors.primary} />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState icon="check" message={t('gallery.nothingWaiting')} />
        </Card>
      ) : (
        rows.map((image, index) => {
          const when = relativeDate(image.created_at);
          return (
            <Card key={image.id}>
              {urls[index]?.data ? (
                <Image
                  source={{ uri: urls[index].data }}
                  style={[styles.preview, { backgroundColor: colors.surfaceAlt }]}
                  contentFit="cover"
                  transition={150}
                  cachePolicy="disk"
                  accessibilityLabel={image.caption ?? t('gallery.photo')}
                />
              ) : (
                <View style={[styles.preview, { backgroundColor: colors.surfaceAlt }]} />
              )}

              <Text style={[type.bodySmall, styles.caption, { color: colors.text }]}>
                {image.caption ?? t('gallery.noCaption')}
              </Text>
              <Text style={[type.caption, { color: colors.textSecondary }]}>
                {t(when.key, when.values)}
              </Text>

              {/* Filled in only when rejecting. The server refuses a rejection without
                  one, so this is not a nicety the client could skip. */}
              <TextField
                label={t('gallery.reason')}
                hint={t('gallery.reasonHint')}
                value={reasons[image.id] ?? ''}
                onChangeText={(value) =>
                  setReasons((current) => ({ ...current, [image.id]: value }))
                }
                maxLength={200}
                autoCapitalize="sentences"
              />

              <View style={styles.actions}>
                <View style={styles.action}>
                  <Button
                    label={t('gallery.approve')}
                    onPress={() => void decide(image.id, true)}
                    disabled={review.isPending}
                  />
                </View>
                <View style={styles.action}>
                  <Button
                    label={t('gallery.reject')}
                    variant="danger"
                    onPress={() => void decide(image.id, false)}
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
  caption: { fontFamily: fontFamily.semibold, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: space.sm },
  action: { flex: 1 },
});
