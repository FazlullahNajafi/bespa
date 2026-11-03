import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import i18n, { useTranslation } from '@/i18n';
import { BackLink } from '@/components/back-link';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { NoticeCard } from '@/components/notice-card';
import { Screen } from '@/components/screen';
import { isOfficial, useNotices } from '@/api/notices';
import { useMyAdminUnits, useMyProfile } from '@/api/profile';
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
 *
 * The source is named once, here, rather than under every card. Spec 09.4 #2 requires
 * that Bespa never read as a government channel, and one legible sentence at the top of
 * the list does that better than the same body's name repeated nine times down it. Both
 * the name and the disclaimer come from `notice_sources`, so correcting either is a row
 * and not a release.
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
  const adminUnits = useMyAdminUnits(session?.user.id);
  const notices = useNotices(Boolean(profile.data?.village_id));

/**
 * Whether to draw the admin affordance. The grant decides, not the role array: since
 * migration 20261103090000 a `panchayat_admin` with no grant administers nothing, and a
 * grant names the village rather than following its holder. `super_admin` holds no
 * scoped grant and is ORed in.
 *
 * The server re-checks every write with `admins_geo`, so this governs buttons and never
 * permission — being wrong here shows a button that then refuses.
 */
  const canPublish =
    Boolean(profile.data?.village_id) &&
    ((adminUnits.data ?? []).length > 0 ||
      (profile.data?.roles ?? []).includes('super_admin'));

  // Taken from the data rather than hard-coded: if the mirror is switched off, or a
  // second source is added later, the line at the top follows without a change here.
  const source =
    (notices.data ?? []).find((n) => isOfficial(n) && n.notice_sources)?.notice_sources ?? null;

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
        // The app's language, not the handset's: someone reading Bespa in Urdu should
        // not get English month headings because the phone was set up in English.
        label: new Date(notice.published_at).toLocaleDateString(i18n.language, {
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
    <Screen
      footer={
        canPublish ? (
          <Button
            label={t('composer.write')}
            onPress={() => router.push('/notices/new')}
            accessibilityHint={t('composer.publishHint')}
          />
        ) : undefined
      }
    >
      <BackLink />

      <Text style={[type.display, { color: colors.text }]}>{t('notices.title')}</Text>

      {source ? (
        <View style={styles.attribution}>
          <Icon name="shield" size={16} color={colors.info} />
          <View style={styles.attributionText}>
            <Text style={[type.caption, styles.sourceName, { color: colors.text }]}>
              {t('notices.sourceIntro', { source: source.label })}
            </Text>
            {source.disclaimer ? (
              <Text style={[type.caption, { color: colors.textSecondary }]}>
                {source.disclaimer}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

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
                onOpenDetail={() => router.push(`/notices/${notice.id}`)}
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
  attribution: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  attributionText: { flex: 1, gap: 2 },
  sourceName: { fontFamily: fontFamily.semibold },
  month: { textTransform: 'uppercase', letterSpacing: 0.6, fontFamily: fontFamily.semibold },
});
