import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useTranslation } from '@/i18n';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { fontFamily, layout, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * Services (spec 09.1, Phase 2) — one real entry so far.
 *
 * Helplines live here because spec 05.2 asks for them to be "reachable from the Services
 * tab in one tap". Report an issue and the rest of Phase 2 are not listed at all: a row
 * that goes nowhere is a promise the app does not keep (spec 01.8 #4), and they appear
 * as they are built.
 *
 * The note under the heading says so, which is the honest version of a half-empty tab.
 */
export default function ServicesScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();

  return (
    <Screen>
      <Text style={[type.display, { color: colors.text }]}>{t('tabs.services')}</Text>
      <Text style={[type.bodySmall, { color: colors.textSecondary }]}>
        {t('services.intro')}
      </Text>

      <Pressable
        onPress={() => router.push('/helplines')}
        accessibilityRole="button"
        accessibilityLabel={t('helplines.title')}
      >
        <Card>
          <View style={styles.row}>
            {/* The glyph is danger-coloured, the badge behind it is not: `danger` on
                `surfaceAlt` clears the contrast floor in both themes, while a tinted
                badge would need its own pair checking. Colour is never the only signal
                anyway (spec 08.1) — the phone glyph and the word carry it. */}
            <View style={[styles.badge, { backgroundColor: colors.surfaceAlt }]}>
              <Icon name="phone" size={20} color={colors.danger} />
            </View>
            <View style={styles.text}>
              <Text style={[type.body, styles.title, { color: colors.text }]}>
                {t('helplines.title')}
              </Text>
              <Text style={[type.caption, { color: colors.textSecondary }]} numberOfLines={2}>
                {t('helplines.intro')}
              </Text>
            </View>
            <Icon name="chevron" size={16} color={colors.textSecondary} />
          </View>
        </Card>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.tap },
  badge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: fontFamily.semibold, fontWeight: '600' },
});
