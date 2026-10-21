import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { BackLink } from '@/components/back-link';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { NoticeCard } from '@/components/notice-card';
import { Screen } from '@/components/screen';
import { useNotices } from '@/api/notices';
import { useMyProfile } from '@/api/profile';
import { useSession } from '@/store/session';
import { fontFamily, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * Every current notice, grouped by month (spec 03.5).
 *
 * No Archive section, against spec 03.5's wording and deliberately: the authoritative
 * archive is the district's own, 138 pages of it, and every mirrored notice links to the
 * original PDF. A second, possibly stale copy of a land-acquisition notice is a
 * liability rather than a feature. Expired rows are kept in the database, so this stays
 * a filter rather than a deletion and an Archive remains cheap to add.
 */

function monthKey(iso: string) {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export default function NoticesScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();

  const { session } = useSession();
  const profile = useMyProfile(session?.user.id);
  const notices = useNotices(Boolean(profile.data?.village_id));

  // Grouping is done here rather than in SQL: the order is already correct from the
  // query, and a month heading is a presentation decision that should not cost a
  // round trip to change.
  const groups: { key: string; label: string; items: NonNullable<typeof notices.data> }[] = [];
  for (const notice of notices.data ?? []) {
    const key = monthKey(notice.published_at);
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = {
        key,
        label: new Date(notice.published_at).toLocaleDateString(undefined, {
          month: 'long',
          year: 'numeric',
        }),
        items: [],
      };
      groups.push(group);
    }
    group.items.push(notice);
  }

  return (
    <Screen>
      <BackLink />

      <Text style={[type.display, { color: colors.text }]}>{t('notices.title')}</Text>

      {notices.isPending ? (
        <ActivityIndicator accessibilityLabel={t('common.loading')} color={colors.primary} />
      ) : notices.isError ? (
        <Banner
          message={t('errors.unknown')}
          action={
            <Button
              label={t('common.retry')}
              variant="secondary"
              onPress={() => void notices.refetch()}
            />
          }
        />
      ) : groups.length === 0 ? (
        <EmptyState icon="bell" message={t('notices.empty')} />
      ) : (
        groups.map((group) => (
          <View key={group.key} style={styles.group}>
            <Text style={[type.caption, styles.month, { color: colors.textSecondary }]}>
              {group.label}
            </Text>
            {group.items.map((notice) => (
              <NoticeCard
                key={notice.id}
                notice={notice}
                onPress={() => router.push(`/notices/${notice.id}`)}
              />
            ))}
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.sm },
  month: { textTransform: 'uppercase', letterSpacing: 0.6, fontFamily: fontFamily.semibold },
});
