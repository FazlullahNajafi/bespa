import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { BackLink } from '@/components/back-link';
import { Banner } from '@/components/banner';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { StatGrid } from '@/components/stat-grid';
import { latestByMetric, useVillageStats, type VillageStat } from '@/api/village';
import { useMyProfile } from '@/api/profile';
import { useSession } from '@/store/session';
import { formatMetric, humanise, labelKeyFor } from '@/lib/metrics';
import { fontFamily, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * Every figure, every year (spec 03.1 §5: "tapping opens full stats with `source` and
 * `year` visible on every figure").
 *
 * The headline grid is the newest year of each metric; under it, the years that came
 * before. **Superseded figures are kept and shown**, which is unusual and deliberate: a
 * village's population is about to change by whatever the 2026 census says, and a reader
 * who remembers the old number needs to see that it was not deleted but dated. A
 * statistics page that silently replaces its numbers is a page nobody can check.
 */
export default function VillageStatsScreen() {
  const { t } = useTranslation();
  const colors = useColors();

  const { session } = useSession();
  const profile = useMyProfile(session?.user.id);
  const villageId = profile.data?.village_id ?? null;

  const stats = useVillageStats(villageId);
  const rows = useMemo(() => stats.data ?? [], [stats.data]);
  const latest = useMemo(() => latestByMetric(rows), [rows]);

  // Everything that is not the newest year of its metric, still grouped by metric and
  // newest first — the rows arrive in that order already.
  const older = useMemo(() => {
    const newest = new Set(latest.map((s) => `${s.metric_key}:${s.year}`));
    return rows.filter((s) => !newest.has(`${s.metric_key}:${s.year}`));
  }, [rows, latest]);

  return (
    <Screen>
      <BackLink />

      <Text style={[type.display, { color: colors.text }]}>{t('village.stats')}</Text>
      <Text style={[type.bodySmall, { color: colors.textSecondary }]}>
        {t('village.statsIntro')}
      </Text>

      {stats.isPending ? (
        <ActivityIndicator accessibilityLabel={t('common.loading')} color={colors.primary} />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState icon="file" message={t('village.statsEmpty')} />
        </Card>
      ) : (
        <>
          <StatGrid latest={latest} showSource />

          {older.length > 0 ? (
            <>
              <Text style={[type.bodySmall, styles.heading, { color: colors.text }]}>
                {t('village.olderFigures')}
              </Text>
              <Card>
                <View style={styles.list}>
                  {older.map((stat: VillageStat) => {
                    const key = labelKeyFor(stat.metric_key);
                    return (
                      <View key={`${stat.metric_key}-${stat.year}`} style={styles.row}>
                        <View style={styles.rowText}>
                          <Text style={[type.bodySmall, { color: colors.text }]}>
                            {key ? t(key) : humanise(stat.metric_key)}
                          </Text>
                          <Text style={[type.caption, { color: colors.textSecondary }]}>
                            {t('village.sourceYear', {
                              source: stat.source,
                              year: stat.year,
                            })}
                          </Text>
                        </View>
                        <Text style={[type.body, styles.value, { color: colors.textSecondary }]}>
                          {formatMetric(stat)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </Card>
            </>
          ) : null}

          <Banner message={t('village.statsCensusNote')} tone="info" />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontFamily: fontFamily.semibold, fontWeight: '600', paddingTop: space.sm },
  list: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rowText: { flex: 1 },
  value: { fontFamily: fontFamily.semibold, fontWeight: '600' },
});
