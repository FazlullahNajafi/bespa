import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { useTranslation } from '@/i18n';
import { BackLink } from '@/components/back-link';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { useGallery, useImageUrls, useSetBanner } from '@/api/gallery';
import { useMyAdminUnits, useMyProfile } from '@/api/profile';
import { useSession } from '@/store/session';
import { fontFamily, radius, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * Choosing the village's Home carousel (spec 03.1 §2, 03.3).
 *
 * An admin action, against the brief's own suggestion that a user picks their own top
 * five — spec 03.3 overrides it because the banner is the village's shared front page and
 * not anybody's favourites list.
 *
 * **Tap to add, tap again to remove, and the order you tapped is the order it shows.**
 * Numbering the chosen photos is the whole interface: a drag-to-reorder grid is a lot of
 * gesture handling to express "this one first", and on a 2 GB phone it is a lot of
 * dropped frames as well.
 *
 * The whole set goes in one call. The banner is a sequence, and five separate toggles
 * racing each other on a bad connection is how two photos end up in the same slot.
 */
const MAX = 5;

export default function BannerPickerScreen() {
  const { t } = useTranslation();
  const colors = useColors();

  const { session } = useSession();
  const profile = useMyProfile(session?.user.id);
  const adminUnits = useMyAdminUnits(session?.user.id);
  const villageId = profile.data?.village_id ?? null;

  const canManage =
    Boolean(villageId) &&
    ((adminUnits.data ?? []).length > 0 ||
      (profile.data?.roles ?? []).includes('super_admin'));

  const images = useGallery(villageId);
  const save = useSetBanner();

  const [chosen, setChosen] = useState<string[] | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // Only approved photos can be on a front page — the server refuses anything else, and
  // offering the choice would be offering something that then fails.
  const approved = useMemo(
    () => (images.data ?? []).filter((image) => image.status === 'approved'),
    [images.data],
  );
  const paths = useMemo(() => approved.map((image) => image.storage_path), [approved]);
  const urls = useImageUrls(paths);

  /**
   * What is already on the banner, derived rather than copied into state by an effect.
   * `chosen` stays null until the admin touches something, and until then the screen
   * simply shows the current banner — so there is no render where the selection is
   * briefly empty and no cascading set-state on mount.
   */
  const current = useMemo(
    () =>
      approved
        .filter((image) => image.banner_position !== null)
        .sort((a, b) => (a.banner_position ?? 0) - (b.banner_position ?? 0))
        .map((image) => image.id),
    [approved],
  );

  const selection = chosen ?? current;

  function toggle(id: string) {
    setNote(null);
    setChosen((existing) => {
      const list = existing ?? current;
      if (list.includes(id)) return list.filter((item) => item !== id);
      if (list.length >= MAX) {
        setNote('gallery.bannerFull');
        return list;
      }
      return [...list, id];
    });
  }

  async function onSave() {
    if (!villageId) return;
    setNote(null);
    const result = await save.mutateAsync({ villageId, ids: selection });
    if (result.ok) setNote('gallery.bannerSaved');
    else if ('queued' in result) setNote('errors.queued');
    else setNote(`errors.${result.code}`);
  }

  return (
    <Screen
      footer={
        canManage ? (
          <Button
            label={t('gallery.bannerSave', { count: selection.length })}
            onPress={() => void onSave()}
            loading={save.isPending}
          />
        ) : undefined
      }
    >
      <BackLink />

      <Text style={[type.display, { color: colors.text }]}>{t('gallery.bannerTitle')}</Text>
      <Text style={[type.bodySmall, { color: colors.textSecondary }]}>
        {t('gallery.bannerIntro')}
      </Text>

      {note ? (
        <Banner message={t(note)} tone={note.startsWith('errors.') ? 'danger' : 'info'} />
      ) : null}

      {!canManage ? (
        <Banner message={t('errors.not_permitted')} tone="danger" />
      ) : images.isPending ? (
        <ActivityIndicator accessibilityLabel={t('common.loading')} color={colors.primary} />
      ) : approved.length === 0 ? (
        <Card>
          <EmptyState icon="image" message={t('gallery.bannerNothing')} />
        </Card>
      ) : (
        <View style={styles.grid}>
          {approved.map((image, index) => {
            const position = selection.indexOf(image.id);
            const picked = position >= 0;
            return (
              <Pressable
                key={image.id}
                onPress={() => toggle(image.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: picked }}
                accessibilityLabel={image.caption ?? t('gallery.photo')}
                style={({ pressed }) => [styles.tile, { opacity: pressed ? 0.8 : 1 }]}
              >
                {urls[index]?.data ? (
                  <Image
                    source={{ uri: urls[index].data }}
                    style={[styles.thumb, { backgroundColor: colors.surfaceAlt }]}
                    contentFit="cover"
                    transition={150}
                    cachePolicy="disk"
                  />
                ) : (
                  <View style={[styles.thumb, { backgroundColor: colors.surfaceAlt }]} />
                )}

                {/* The number IS the ordering control, and it is a number rather than a
                    tick so that "which comes first" is answerable at a glance. */}
                {picked ? (
                  <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                    <Text style={[type.caption, styles.badgeText, { color: colors.onPrimary }]}>
                      {position + 1}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  tile: { flexGrow: 1, flexBasis: '30%', aspectRatio: 1 },
  thumb: { width: '100%', height: '100%', borderRadius: radius.card },
  badge: {
    position: 'absolute',
    top: space.xs,
    right: space.xs,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: fontFamily.semibold, fontWeight: '600' },
});
