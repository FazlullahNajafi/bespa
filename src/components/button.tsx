import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { fontFamily, layout, radius, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  /** Emergency actions get the larger target from spec 08.6. */
  emergency?: boolean;
  accessibilityHint?: string;
};

/**
 * The 44×44pt minimum touch target (spec 08.6) is baked in here rather than left to each
 * screen — it is the kind of rule that holds only if it is impossible to forget.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  emergency = false,
  accessibilityHint,
}: Props) {
  const colors = useColors();
  const inactive = disabled || loading;

  const background = {
    primary: colors.primary,
    secondary: colors.infoSurface,
    ghost: 'transparent',
    danger: colors.danger,
  }[variant];

  // Not white: in the dark theme both `primary` and `danger` lighten, so a white label
  // drops to 2.77:1 and 3.46:1 respectively. `onPrimary`/`onDanger` carry the readable
  // label colour for whichever theme is active.
  const foreground = {
    primary: colors.onPrimary,
    secondary: colors.primary,
    ghost: colors.primary,
    danger: colors.onDanger,
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: background,
          minHeight: emergency ? layout.tapEmergency : layout.tap,
          borderColor: variant === 'ghost' ? 'transparent' : background,
          opacity: inactive ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <View style={styles.content}>
          <Text style={[type.body, styles.label, { color: foreground }]} numberOfLines={2}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.card,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    // Names the real semibold face, not just a weight: `type.body` carries the Regular
    // family, and asking for 600 on it yields Regular on Android and fake-bold on web.
    fontFamily: fontFamily.semibold,
    fontWeight: '600',
    textAlign: 'center',
  },
});
