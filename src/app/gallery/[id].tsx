import { useMemo, useState } from 'react';
import { Dimensions, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';

import i18n, { useTranslation } from '@/i18n';
import { BackLink } from '@/components/back-link';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { StatusPill } from '@/components/status-pill';
import {
  useGallery,
  useImageUrls,
  useSetKind,
  useWithdrawImage,
  type GalleryImage,
  type GalleryKind,
} from '@/api/gallery';
import { useMyAdminUnits, useMyProfile } from '@/api/profile';
import { useGeoUnit } from '@/api/geo';
import { useSession } from '@/store/session';
import { shareNotice } from '@/lib/notice-actions';
import { formatDay } from '@/lib/format-date';
import { fontFamily, radius, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * The full-screen pager (spec 03.3): tap a photo in the grid and swipe through the rest.
 *
 * A horizontal `FlatList` paged by screen width rather than a carousel library — the
 * whole behaviour is "one item per screen, snap to it", and a dependency for that is a
 * dependency to upgrade for ever.
 *
 * **Sharing sends words, not the picture.** Every URL here is signed and expires within
 * the hour, so a shared link would be dead by the time anyone tapped it. Sharing the
 * image file itself needs either a public thumbnail or the app link that spec 03.5
 * already records as pending; until one exists, a share that quietly degrades is more
 * honest than one that sends a broken link.
 */

const KINDS: GalleryKind[] = ['place', 'festival', 'general'];

export default function GalleryPagerScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { session } = useSession();
  const profile = useMyProfile(session?.user.id);
  const adminUnits = useMyAdminUnits(session?.user.id);
  const villageId = profile.data?.village_id ?? null;
  const village = useGeoUnit(villageId);
  const userId = session?.user.id ?? null;

  const images = useGallery(villageId);
  const setKind = useSetKind();
  const withdraw = useWithdrawImage();

  const rows = useMemo(() => images.data ?? [], [images.data]);
  const paths = useMemo(() => rows.map((image) => image.storage_path), [rows]);
  const urls = useImageUrls(paths);

  const startIndex = Math.max(
    rows.findIndex((image) => image.id === id),
    0,
  );
  const [index, setIndex] = useState(startIndex);

  const width = Dimensions.get('window').width;
  const current: GalleryImage | undefined = rows[index];

  const canModerate =
    (adminUnits.data ?? []).length > 0 || (profile.data?.roles ?? []).includes('super_admin');
  const mine = current?.uploaded_by === userId;

  function share() {
    if (!current) return;
    void shareNotice(
      [
        current.caption ?? t('gallery.photo'),
        t('gallery.shareFrom', { village: village.data?.name_en ?? '' }),
      ].join('\n\n'),
    );
  }

  return (
    <Screen scroll={false}>
      <BackLink />

      <FlatList
        data={rows}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={startIndex}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        keyExtractor={(image) => image.id}
        onMomentumScrollEnd={(event) =>
          setIndex(Math.round(event.nativeEvent.contentOffset.x / width))
        }
        renderItem={({ item, index: i }) => (
          <View style={{ width }}>
            {urls[i]?.data ? (
              <Image
                source={{ uri: urls[i].data }}
                style={[styles.photo, { backgroundColor: colors.surfaceAlt }]}
                // `contain`, not `cover`: this is the screen where someone looks at the
                // photo, so nothing may be cropped out of it.
                contentFit="contain"
                transition={150}
                cachePolicy="disk"
                accessibilityLabel={item.caption ?? t('gallery.photo')}
              />
            ) : (
              <View style={[styles.photo, { backgroundColor: colors.surfaceAlt }]} />
            )}
          </View>
        )}
      />

      {current ? (
        <View style={styles.details}>
          {/* Dots, so the pager says how much there is without a scrollbar. */}
          {rows.length > 1 ? (
            <View style={styles.dots}>
              {rows.map((image, i) => (
                <View
                  key={image.id}
                  style={[
                    styles.dot,
                    { backgroundColor: i === index ? colors.primary : colors.border },
                  ]}
                />
              ))}
            </View>
          ) : null}

          <Text style={[type.bodySmall, styles.caption, { color: colors.text }]}>
            {current.caption ?? t('gallery.noCaption')}
          </Text>

          <Text style={[type.caption, { color: colors.textSecondary }]}>
            {t('gallery.by', {
              name: current.uploader?.full_name ?? t('gallery.someone'),
              date: formatDay(new Date(current.created_at), i18n.language),
            })}
          </Text>

          {current.status !== 'approved' ? (
            <View style={styles.pills}>
              <StatusPill
                label={t(`gallery.status.${current.status}`)}
                tone={current.status === 'rejected' ? 'danger' : 'warning'}
              />
            </View>
          ) : null}

          {current.status === 'rejected' && current.reject_reason ? (
            <Text style={[type.caption, { color: colors.danger }]}>
              {t('gallery.rejectedBecause', { reason: current.reject_reason })}
            </Text>
          ) : null}

          {/* Which tab it belongs to. Its uploader knows; an admin can correct it. */}
          {mine || canModerate ? (
            <View style={styles.chips}>
              {KINDS.map((kind) => (
                <Chip
                  key={kind}
                  label={t(`gallery.kind.${kind}`)}
                  selected={current.kind === kind}
                  onPress={() => void setKind.mutateAsync({ id: current.id, kind })}
                />
              ))}
            </View>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              onPress={share}
              accessibilityRole="button"
              accessibilityLabel={t('gallery.share')}
              style={({ pressed }) => [styles.action, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Icon name="share" size={16} color={colors.primary} />
              <Text style={[type.caption, styles.actionText, { color: colors.primary }]}>
                {t('gallery.share')}
              </Text>
            </Pressable>

            {mine || canModerate ? (
              <Button
                label={t('gallery.withdraw')}
                variant="ghost"
                loading={withdraw.isPending}
                onPress={() => void withdraw.mutateAsync(current.id)}
              />
            ) : null}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', aspectRatio: 1, borderRadius: radius.card },
  details: { gap: space.sm, paddingTop: space.md },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: space.xs },
  dot: { width: 6, height: 6, borderRadius: 3 },
  caption: { fontFamily: fontFamily.semibold, fontWeight: '600' },
  pills: { flexDirection: 'row', gap: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  action: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 44 },
  actionText: { fontFamily: fontFamily.semibold },
});
