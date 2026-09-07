import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { layout, radius, type } from '@/theme/tokens';
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

  const foreground = {
    primary: '#FFFFFF',
    secondary: colors.primary,
    ghost: colors.primary,
    danger: '#FFFFFF',
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
    fontWeight: '600',
    textAlign: 'center',
  },
});
