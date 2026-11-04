import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';

import { useTranslation } from '@/i18n';
import { BackLink } from '@/components/back-link';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { StatusPill } from '@/components/status-pill';
import { TextField } from '@/components/text-field';
import { useGallery, useImageUrls, useSubmitGallery, type GalleryImage } from '@/api/gallery';
import { useMyAdminUnits, useMyProfile } from '@/api/profile';
import { useSession } from '@/store/session';
import { canPickImages, pickAndResize } from '@/lib/images';
import { fontFamily, layout, radius, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * The village gallery (spec 03.3): photos of places and festivals, contributed by
 * villagers and shown once an admin has approved them.
 *
 * **Contributing is queue-and-forget**, which is the Phase 1 spike's measurement made
 * into a design: a resized photo is 184 KB, about a second on wifi and the better part of
 * a minute on 2G. So picking a photo returns immediately and says the photo will go — the
 * outbox carries it. Nothing here waits on an upload.
 *
 * **The uploader sees their own photo straight away**, marked as waiting. Spec 03.3
 * moderates before showing, and in a village whose admin opens the app twice a week that
 * means days of invisibility; without this the person who sent it concludes the feature is
 * broken. A rejection reaches them too, with its reason.
 */

const COLUMNS = 3;

function Tile({
  image,
  url,
  mine,
  onPress,
}: {
  image: GalleryImage;
  url: string | null | undefined;
  mine: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const colors = useColors();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={image.caption ?? t('gallery.photo')}
      style={({ pressed }) => [styles.tile, { opacity: pressed ? 0.8 : 1 }]}
    >
      {url ? (
        <Image
          source={{ uri: url }}
          style={[styles.thumb, { backgroundColor: colors.surfaceAlt }]}
          contentFit="cover"
          // The cache is why a second look at the grid costs nothing, and the transition
          // is why it does not flash white while scrolling.
          transition={150}
          cachePolicy="disk"
        />
      ) : (
        <View style={[styles.thumb, { backgroundColor: colors.surfaceAlt }]} />
      )}

      {/* Only ever on your own photos: nobody else's pending or rejected rows reach
          this screen at all. */}
      {mine && image.status !== 'approved' ? (
        <View style={styles.badge}>
          <StatusPill
            label={t(`gallery.status.${image.status}`)}
            tone={image.status === 'rejected' ? 'danger' : 'warning'}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

export default function GalleryScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();

  const { session } = useSession();
  const profile = useMyProfile(session?.user.id);
  const adminUnits = useMyAdminUnits(session?.user.id);
  const villageId = profile.data?.village_id ?? null;
  const userId = session?.user.id ?? null;

  const images = useGallery(villageId);
  const submitImages = useSubmitGallery();

  const [caption, setCaption] = useState('');
  const [note, setNote] = useState<string | null>(null);

  // Memoised together: `?? []` makes a new array every render, which would make the
  // paths a new array too and re-sign every URL on every keystroke.
  const rows = useMemo(() => images.data ?? [], [images.data]);
  const paths = useMemo(() => rows.map((image) => image.storage_path), [rows]);
  const urls = useImageUrls(paths);

  const canReview =
    Boolean(villageId) &&
    ((adminUnits.data ?? []).length > 0 ||
      (profile.data?.roles ?? []).includes('super_admin'));

  const pending = rows.filter((image) => image.status === 'pending').length;

  async function contribute() {
    if (!villageId) return;
    setNote(null);

    const picked = await pickAndResize(10);
    if (picked.status !== 'ok') {
      if (picked.status !== 'cancelled') setNote(`gallery.pick.${picked.status}`);
      return;
    }

    const result = await submitImages.mutateAsync({
      draft: { villageId, caption: caption.trim() || null },
      uris: picked.uris,
    });

    setCaption('');
    if (result.ok) setNote('gallery.sent');
    else if ('queued' in result) setNote('gallery.queued');
    else setNote(`errors.${result.code}`);
  }

  return (
    <Screen
      footer={
        canPickImages() ? (
          <Button
            label={t('gallery.add')}
            onPress={() => void contribute()}
            loading={submitImages.isPending}
            disabled={!villageId}
            accessibilityHint={t('gallery.addHint')}
          />
        ) : undefined
      }
    >
      <BackLink />

      <Text style={[type.display, { color: colors.text }]}>{t('gallery.title')}</Text>

      {canReview && pending > 0 ? (
        <Pressable
          onPress={() => router.push('/gallery/review')}
          accessibilityRole="button"
          accessibilityHint={t('gallery.reviewHint')}
        >
          <Card>
            <View style={styles.reviewRow}>
              <Icon name="bell" size={18} color={colors.primary} />
              <Text style={[type.bodySmall, styles.reviewText, { color: colors.text }]}>
                {t('gallery.waiting', { count: pending })}
              </Text>
              <Icon name="chevron" size={16} color={colors.textSecondary} />
            </View>
          </Card>
        </Pressable>
      ) : null}

      {canReview ? (
        <Button
          label={t('gallery.bannerTitle')}
          variant="secondary"
          onPress={() => router.push('/gallery/banner')}
          accessibilityHint={t('gallery.bannerHint')}
        />
      ) : null}

      <TextField
        label={t('gallery.caption')}
        hint={t('gallery.captionHint')}
        value={caption}
        onChangeText={setCaption}
        maxLength={280}
        autoCapitalize="sentences"
      />

      {note ? (
        <Banner
          message={t(note)}
          tone={note.startsWith('errors.') ? 'danger' : 'info'}
        />
      ) : null}

      {images.isPending ? (
        <ActivityIndicator accessibilityLabel={t('common.loading')} color={colors.primary} />
      ) : images.isError ? (
        <Banner
          message={t('errors.unknown')}
          action={
            <Button
              label={t('common.retry')}
              variant="secondary"
              onPress={() => void images.refetch()}
            />
          }
        />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState icon="image" message={t('gallery.empty')} />
        </Card>
      ) : (
        <View style={styles.grid}>
          {rows.map((image, index) => (
            <Tile
              key={image.id}
              image={image}
              url={urls[index]?.data}
              mine={image.uploaded_by === userId}
              onPress={() => router.push({ pathname: '/gallery/[id]', params: { id: image.id } })}
            />
          ))}
        </View>
      )}

    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  tile: {
    // Three up, with the gaps taken out of the width.
    width: `${100 / COLUMNS}%`,
    flexGrow: 1,
    flexBasis: `${100 / COLUMNS - 3}%`,
    aspectRatio: 1,
  },
  thumb: { width: '100%', height: '100%', borderRadius: radius.card },
  badge: { position: 'absolute', left: space.xs, bottom: space.xs },
  reviewRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.tap },
  reviewText: { flex: 1, fontFamily: fontFamily.semibold, fontWeight: '600' },
  selectedCaption: { fontFamily: fontFamily.semibold, fontWeight: '600' },
});
