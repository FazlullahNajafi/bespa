import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { useTranslation } from '@/i18n';
import { BackLink } from '@/components/back-link';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { StatusPill } from '@/components/status-pill';
import { isOfficial, useNotice } from '@/api/notices';
import { relativeDate } from '@/lib/relative-date';
import { fontFamily, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * One notice (spec 03.5).
 *
 * The two kinds read very differently, and should. A village notice is words, so it
 * shows them. An official notice has no body by construction — Bespa indexes the
 * district's notices and never reproduces them (spec 09.4 #2) — so the screen's job is
 * to attribute it, state its dates, and hand the reader the original document.
 *
 * That restraint is the point rather than a limitation. Several of these are land
 * acquisition notices whose objection windows are legally meaningful; a summary of ours
 * sitting where the document should be is how someone ends up relying on our paraphrase.
 */
export default function NoticeScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();

  const notice = useNotice(id);
  const [opening, setOpening] = useState(false);

  async function openOriginal(url: string) {
    setOpening(true);
    try {
      // In-app browser rather than handing off to Chrome: the reader comes back to
      // Bespa with the back gesture instead of app-switching, which matters more on a
      // cheap phone where relaunching costs seconds.
      await WebBrowser.openBrowserAsync(url);
    } catch {
      // A missing browser is not worth an error screen; the link is still visible.
    } finally {
      setOpening(false);
    }
  }

  if (notice.isPending) {
    return (
      <Screen>
        <BackLink />
        <ActivityIndicator accessibilityLabel={t('common.loading')} color={colors.primary} />
      </Screen>
    );
  }

  if (notice.isError || !notice.data) {
    return (
      <Screen>
        <BackLink />
        <Banner message={t('errors.unknown')} tone="danger" />
      </Screen>
    );
  }

  const item = notice.data;
  const official = isOfficial(item);
  const when = relativeDate(item.published_at);
  const expires = item.expires_at ? new Date(item.expires_at) : null;

  return (
    <Screen
      footer={
        official && item.source_url ? (
          <Button
            label={t('notices.openOriginal')}
            onPress={() => void openOriginal(item.source_url!)}
            loading={opening}
            accessibilityHint={t('notices.opensPdf')}
          />
        ) : undefined
      }
    >
      <BackLink />

      <View style={styles.header}>
        <View style={styles.pills}>
          <StatusPill
            label={t(`notices.category.${item.category}`)}
            tone={item.category === 'alert' ? 'warning' : 'neutral'}
          />
          {item.is_pinned ? <StatusPill label={t('notices.pinned')} tone="info" /> : null}
        </View>

        <Text style={[type.display, { color: colors.text }]}>{item.title}</Text>

        <Text style={[type.bodySmall, { color: colors.textSecondary }]}>
          {t(when.key, when.values)}
          {expires
            ? ` · ${t('notices.until', { date: expires.toLocaleDateString() })}`
            : ''}
        </Text>
      </View>

      {official ? (
        <Card>
          <View style={styles.sourceRow}>
            <Icon name="shield" size={18} color={colors.info} />
            <Text style={[type.bodySmall, styles.sourceLabel, { color: colors.text }]}>
              {item.notice_sources?.label ?? t('notices.official')}
            </Text>
          </View>
          {/* The disclaimer lives on the source row in the database, so it travels with
              the source rather than being restated on every screen that shows one. */}
          {item.notice_sources?.disclaimer ? (
            <Text style={[type.caption, { color: colors.textSecondary }]}>
              {item.notice_sources.disclaimer}
            </Text>
          ) : null}
        </Card>
      ) : item.body ? (
        <Card>
          <Text style={[type.body, { color: colors.text }]}>{item.body}</Text>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.sm },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sourceLabel: { fontFamily: fontFamily.semibold, fontWeight: '600', flex: 1 },
});
