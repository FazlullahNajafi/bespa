import { useRouter } from 'expo-router';
import { I18nManager, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { Icon } from '@/components/icon';
import { fontFamily, layout, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * Back, for a screen pushed on top of the tabs.
 *
 * In the content rather than in a navigation header, which is why this exists at all:
 * `Screen` pays the status-bar inset itself, because Expo draws edge-to-edge from SDK 54
 * and Android 15 enforces it. A native header pays that inset too, and the two together
 * push the first heading a bar-height down the screen.
 *
 * Android's hardware back still works; this is for the thumb, and for the many users who
 * reach a screen without knowing the gesture.
 */
export function BackLink() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.back()}
      accessibilityRole="button"
      accessibilityLabel={t('common.back')}
      hitSlop={space.sm}
      style={({ pressed }) => [styles.base, { opacity: pressed ? 0.6 : 1 }]}
    >
      {/* The arrow points the way back, which in a mirrored layout is the other way.
          `react-native-svg` does not mirror with the layout, so flip it here. */}
      <View style={I18nManager.isRTL ? styles.mirrored : undefined}>
        <Icon name="back" size={18} color={colors.primary} />
      </View>
      <Text style={[type.bodySmall, styles.label, { color: colors.primary }]}>
        {t('common.back')}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.xs,
    minHeight: layout.tap,
    paddingRight: space.sm,
  },
  label: { fontFamily: fontFamily.semibold, fontWeight: '600' },
  mirrored: { transform: [{ scaleX: -1 }] },
});
