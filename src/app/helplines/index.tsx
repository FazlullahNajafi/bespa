import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { useTranslation } from '@/i18n';
import { BackLink } from '@/components/back-link';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { dial } from '@/lib/dial';
import {
  HELPLINE_GROUPS,
  HELPLINE_SOURCE,
  helplinesIn,
  type Helpline,
  type HelplineGroup,
} from '@/lib/helplines';
import { fontFamily, layout, radius, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * Emergency numbers (spec 05.2).
 *
 * **Nothing on this screen loads.** No query, no session check, no village. The numbers
 * are compiled into the bundle, so the screen paints on a dead connection, a paused
 * backend or a fresh install — which is the whole point of it. There is no loading state
 * because there is nothing to wait for.
 *
 * **The emergency group is oversized and first.** Spec 08.6 sets 44pt as the floor and
 * 56 for emergency actions; these are larger still, because the person using them is in
 * a hurry, possibly in the dark, possibly not reading the label. The number is printed
 * at display size next to the name — someone who cannot reach the app can still read
 * 112 off the screen and dial it on another phone.
 *
 * **One tap opens the dialer; it does not place the call.** A screen that rings the
 * police on a mis-tap in a pocket is a screen that gets uninstalled, and the extra press
 * costs nothing when the dialer is already showing the number.
 */

function EmergencyRow({ line }: { line: Helpline }) {
  const { t } = useTranslation();
  const colors = useColors();
  const name = t(`helplines.name.${line.key}`);

  return (
    <Pressable
      onPress={() => void dial(line.number)}
      accessibilityRole="button"
      accessibilityLabel={t('helplines.call', { name, number: line.number })}
      style={({ pressed }) => [
        styles.emergency,
        { backgroundColor: colors.danger, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Icon name="phone" size={24} color={colors.onDanger} />
      <View style={styles.emergencyText}>
        <Text style={[type.body, styles.bold, { color: colors.onDanger }]}>{name}</Text>
        {line.key === 'all' ? (
          <Text style={[type.caption, { color: colors.onDanger }]}>
            {t('helplines.name.allNote')}
          </Text>
        ) : null}
      </View>
      <Text style={[type.display, styles.bold, { color: colors.onDanger }]}>
        {line.number}
      </Text>
    </Pressable>
  );
}

function Row({ line }: { line: Helpline }) {
  const { t } = useTranslation();
  const colors = useColors();
  const name = t(`helplines.name.${line.key}`);

  return (
    <Pressable
      onPress={() => void dial(line.number)}
      accessibilityRole="button"
      accessibilityLabel={t('helplines.call', { name, number: line.number })}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Icon name="phone" size={18} color={colors.primary} />
      <Text style={[type.body, styles.rowName, { color: colors.text }]}>{name}</Text>
      <Text style={[type.body, styles.bold, { color: colors.primary }]}>{line.number}</Text>
    </Pressable>
  );
}

export default function HelplinesScreen() {
  const { t } = useTranslation();
  const colors = useColors();

  return (
    <Screen>
      <BackLink />

      <Text style={[type.display, { color: colors.text }]}>{t('helplines.title')}</Text>
      <Text style={[type.bodySmall, { color: colors.textSecondary }]}>
        {t('helplines.intro')}
      </Text>

      {HELPLINE_GROUPS.map((group: HelplineGroup) => {
        const lines = helplinesIn(group);
        if (lines.length === 0) return null;

        return (
          <View key={group} style={styles.section}>
            <Text style={[type.caption, styles.sectionLabel, { color: colors.textSecondary }]}>
              {t(`helplines.group.${group}`)}
            </Text>

            {group === 'emergency' ? (
              <View style={styles.emergencyList}>
                {lines.map((line) => (
                  <EmergencyRow key={line.key} line={line} />
                ))}
              </View>
            ) : (
              <Card>
                <View style={styles.list}>
                  {lines.map((line) => (
                    <Row key={line.key} line={line} />
                  ))}
                </View>
              </Card>
            )}
          </View>
        );
      })}

      {/* Spec 05.2: the footer states the verification date and links to the official
          page. It also says how old that page is, because "verified today" against a
          source frozen in 2020 would be a true sentence that misleads. */}
      <View style={styles.source}>
        <Text style={[type.caption, { color: colors.textSecondary }]}>
          {t('helplines.sourceLine', { checked: HELPLINE_SOURCE.checked })}
        </Text>
        <Text style={[type.caption, { color: colors.textSecondary }]}>
          {t('helplines.sourceStale', { pageUpdated: HELPLINE_SOURCE.pageUpdated })}
        </Text>
        <Pressable
          onPress={() => void WebBrowser.openBrowserAsync(HELPLINE_SOURCE.url)}
          accessibilityRole="link"
          style={styles.link}
        >
          <Text style={[type.caption, styles.bold, { color: colors.primary }]}>
            {t('helplines.openSource')}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.xs },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontFamily: fontFamily.semibold,
  },
  emergencyList: { gap: space.xs },
  emergency: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    // Well past spec 08.6's 56 for an emergency action. This is the one control in the
    // app that someone uses while panicking.
    minHeight: 72,
    borderRadius: radius.card,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  emergencyText: { flex: 1 },
  list: { gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.tap },
  rowName: { flex: 1 },
  bold: { fontFamily: fontFamily.semibold, fontWeight: '600' },
  source: { gap: space.xs, paddingTop: space.sm },
  link: { minHeight: layout.tap, justifyContent: 'center' },
});
