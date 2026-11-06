import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';

import { useTranslation } from '@/i18n';
import { BackLink } from '@/components/back-link';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { StatGrid } from '@/components/stat-grid';
import { latestByMetric, useVillageProfile, useVillageStats } from '@/api/village';
import { usePlacePhotos, usePlaces } from '@/api/places';
import { useDirectory } from '@/api/directory';
import { useGeoUnit } from '@/api/geo';
import { useMyAdminUnits, useMyProfile } from '@/api/profile';
import { useSession } from '@/store/session';
import { fontFamily, radius, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * The village's own page (spec 03.1, "Village detail / About").
 *
 * Everything on it is either written by an admin or counted from tables that already
 * exist — the description and the historical note from `village_profiles`, the figures
 * from `village_stats`, the places count from `places` and the member count from the
 * directory. Nothing is invented, so a village whose admin has written nothing shows a
 * page that says so rather than a page of placeholders (spec 01.8 #4).
 *
 * The embedded map spec 03.1 asks for is **not here**: there is no map in this app, by
 * the 2026-11-05 decision. The cover photo is what fills that space, and when there is
 * no cover the section is simply absent.
 */
export default function VillageScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();

  const { session } = useSession();
  const profile = useMyProfile(session?.user.id);
  const adminUnits = useMyAdminUnits(session?.user.id);
  const villageId = profile.data?.village_id ?? null;

  const village = useGeoUnit(villageId);
  const page = useVillageProfile(villageId);
  const stats = useVillageStats(villageId);
  const places = usePlaces(villageId);
  const members = useDirectory(villageId);

  const canEdit =
    Boolean(villageId) &&
    ((adminUnits.data ?? []).length > 0 ||
      (profile.data?.roles ?? []).includes('super_admin'));

  // Memoised on the row rather than on `page.data?.cover_path`: React Compiler cannot
  // preserve a memo whose dependency is an optional chain, and bails out of the whole
  // component when it tries.
  const cover = useMemo(() => {
    const path = page.data?.cover_path;
    return path ? [path] : [];
  }, [page.data]);
  const coverUrl = usePlacePhotos(cover);

  const latest = useMemo(() => latestByMetric(stats.data ?? []), [stats.data]);

  // Approved places only: a pending submission is not yet something the village claims
  // to have.
  const placeCount = (places.data ?? []).filter((p) => p.status === 'approved').length;
  const memberCount = (members.data ?? []).length;

  return (
    <Screen
      footer={
        canEdit ? (
          <Button label={t('village.edit')} onPress={() => router.push('/village/edit')} />
        ) : undefined
      }
    >
      <BackLink />

      {coverUrl[0]?.data ? (
        <Image
          source={{ uri: coverUrl[0].data }}
          style={[styles.cover, { backgroundColor: colors.surfaceAlt }]}
          contentFit="cover"
          transition={200}
          cachePolicy="disk"
          accessibilityLabel={t('village.coverAlt')}
        />
      ) : null}

      <Text style={[type.display, { color: colors.text }]}>
        {village.data?.name_en ?? t('village.title')}
      </Text>
      {village.data?.name_bft ? (
        <Text style={[type.body, { color: colors.textSecondary }]}>{village.data.name_bft}</Text>
      ) : null}

      {page.isPending ? (
        <ActivityIndicator accessibilityLabel={t('common.loading')} color={colors.primary} />
      ) : page.data?.description ? (
        <Card>
          <Text style={[type.body, { color: colors.text }]}>{page.data.description}</Text>
        </Card>
      ) : (
        <Card>
          <EmptyState icon="home" message={t('village.noDescription')} />
        </Card>
      )}

      {/* Counted, never estimated. */}
      <View style={styles.counts}>
        <View style={styles.count}>
          <Icon name="pin" size={16} color={colors.textSecondary} />
          <Text style={[type.bodySmall, { color: colors.textSecondary }]}>
            {t('village.placesCount', { count: placeCount })}
          </Text>
        </View>
        <View style={styles.count}>
          <Icon name="people" size={16} color={colors.textSecondary} />
          <Text style={[type.bodySmall, { color: colors.textSecondary }]}>
            {t('village.membersCount', { count: memberCount })}
          </Text>
        </View>
      </View>

      <Text style={[type.bodySmall, styles.heading, { color: colors.text }]}>
        {t('village.stats')}
      </Text>

      {stats.isPending ? (
        <ActivityIndicator accessibilityLabel={t('common.loading')} color={colors.primary} />
      ) : latest.length === 0 ? (
        <Card>
          <EmptyState icon="file" message={t('village.statsEmpty')} />
        </Card>
      ) : (
        <>
          <StatGrid latest={latest} showSource />
          {/* Only offered when there is history to see — more than one year published
              for at least one metric. */}
          {(stats.data ?? []).length > latest.length ? (
            <Button
              label={t('village.statsAll')}
              variant="secondary"
              onPress={() => router.push('/village/stats')}
            />
          ) : null}
        </>
      )}

      {page.data?.history_note ? (
        <>
          <Text style={[type.bodySmall, styles.heading, { color: colors.text }]}>
            {t('village.history')}
          </Text>
          <Card>
            <Text style={[type.body, { color: colors.text }]}>{page.data.history_note}</Text>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cover: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.card },
  heading: { fontFamily: fontFamily.semibold, fontWeight: '600', paddingTop: space.sm },
  counts: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  count: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
