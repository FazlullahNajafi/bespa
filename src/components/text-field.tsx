import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { layout, radius, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

type Props = TextInputProps & {
  label: string;
  hint?: string;
  error?: string;
  /**
   * Fixed text inside the field, before the input — a country code, a currency. It is
   * part of the value the user is building but not part of what they type, so it sits
   * in the box rather than in the label, where it would read as a separate fact.
   */
  prefix?: string;
};

/**
 * Label is always visible — never a placeholder standing in for one. A placeholder
 * disappears the moment typing starts, which is exactly when a user with low literacy or
 * an unfamiliar script needs it most (spec 08.6).
 */
export function TextField({ label, hint, error, prefix, ...props }: Props) {
  const colors = useColors();

  const field = (
    <TextInput
      {...props}
      // With a prefix the border moves to the wrapper, or the box would be drawn twice.
      accessibilityLabel={prefix ? `${label}, ${prefix}` : label}
      accessibilityHint={hint}
      placeholderTextColor={colors.textSecondary}
      style={[
        type.body,
        prefix ? styles.inputInline : styles.input,
        {
          color: colors.text,
          backgroundColor: colors.surface,
          borderColor: error ? colors.danger : colors.border,
        },
      ]}
    />
  );

  return (
    <View style={styles.wrapper}>
      <Text style={[type.bodySmall, { color: colors.textSecondary }]}>{label}</Text>

      {prefix ? (
        <View
          style={[
            styles.prefixed,
            {
              backgroundColor: colors.surface,
              borderColor: error ? colors.danger : colors.border,
            },
          ]}
        >
          {/* Not focusable and not announced on its own: a screen reader hears it as
              part of the field's label instead, which is what it is. */}
          <Text
            aria-hidden
            style={[type.body, styles.prefixText, { color: colors.textSecondary }]}
          >
            {prefix}
          </Text>
          {field}
        </View>
      ) : (
        field
      )}

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
  prefixed: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.tap,
    borderWidth: 1,
    borderRadius: radius.card,
    paddingLeft: space.md,
  },
  prefixText: { paddingRight: space.xs },
  // Inside `prefixed`, which already draws the box.
  inputInline: {
    flex: 1,
    minHeight: layout.tap,
    borderWidth: 0,
    paddingRight: space.md,
    paddingVertical: space.sm,
  },
});
