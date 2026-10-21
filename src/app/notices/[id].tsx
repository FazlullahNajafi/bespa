import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import i18n, { useTranslation } from '@/i18n';
import { BackLink } from '@/components/back-link';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { StatusPill } from '@/components/status-pill';
import { isOfficial, useNotice } from '@/api/notices';
import { relativeDate } from '@/lib/relative-date';
import { space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * One notice (spec 03.5).
 *
 * This screen exists for a **village** notice, which is words and so has something to
 * show. A mirrored one has no body by construction — Bespa indexes the district's
 * notices and never reproduces them (spec 09.4 #2) — so its card opens the original
 * document directly and never comes here. The page this used to show in between held
 * only the source's name and a disclaimer, both of which the list already states once.
 *
 * The mirrored branch below is kept as a destination, not as a route anyone taps: a
 * push notification or a shared link can name any notice id, and landing on a screen
 * with no way to reach the document would be worse than landing on one button.
 */
/**
 * The month is spelled out, and the locale is the app's rather than the handset's.
 *
 * `7/12/2026` is 7 December on a phone set to en-IN and 12 July on one set to en-US, and
 * several of these are land acquisition notices whose objection window closes on that
 * date. A numeric date is the one thing on this screen a reader could act on and be
 * wrong about.
 */
function formatDate(date: Date) {
  return date.toLocaleDateString(i18n.language, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

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
  const document = official ? item.source_url : null;
  const when = relativeDate(item.published_at);
  const expires = item.expires_at ? new Date(item.expires_at) : null;

  return (
    <Screen
      footer={
        document ? (
          <Button
            label={t('notices.openOriginal')}
            onPress={() => void openOriginal(document)}
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
            ? ` · ${t('notices.until', { date: formatDate(expires) })}`
            : ''}
        </Text>
      </View>

      {item.body ? (
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
});
