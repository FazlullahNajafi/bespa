import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { layout, radius, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

type Props = TextInputProps & {
  label: string;
  hint?: string;
  error?: string;
};

/**
 * Label is always visible — never a placeholder standing in for one. A placeholder
 * disappears the moment typing starts, which is exactly when a user with low literacy or
 * an unfamiliar script needs it most (spec 08.6).
 */
export function TextField({ label, hint, error, ...props }: Props) {
  const colors = useColors();

  return (
    <View style={styles.wrapper}>
      <Text style={[type.bodySmall, { color: colors.textSecondary }]}>{label}</Text>

      <TextInput
        {...props}
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={colors.textSecondary}
        style={[
          type.body,
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : colors.border,
          },
        ]}
      />

      {/* Errors carry text, never colour alone (spec 08.1). */}
      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[type.bodySmall, { color: colors.danger }]}
        >
          {error}
        </Text>
      ) : hint ? (
        <Text style={[type.caption, { color: colors.textSecondary }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: space.xs,
  },
  input: {
    minHeight: layout.tap,
    borderWidth: 1,
    borderRadius: radius.card,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
});
