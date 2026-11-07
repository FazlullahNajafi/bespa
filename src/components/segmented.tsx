import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { fontFamily, radius, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * Two large cards that choose between two worlds (spec 04.1, and the design's
 * `SegToggle`).
 *
 * Built for the one place it is used and shaped by it. Spec 04 insists Kargil's two
 * transport economies must not be merged, so the control that switches between them is
 * not a thin iOS-style segmented strip — it is two cards with a glyph, a name and a line
 * saying what each is for, because "Long distance" and "In & around Kargil" mean nothing
 * to someone opening the tab for the first time.
 *
 * Colour is never the only signal (spec 08.1): the chosen card carries a filled
 * background *and* its label goes semibold, so it reads as chosen in greyscale.
 */
export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  hint: string;
  icon: IconName;
};

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: SegmentOption<T>[];
  onChange: (next: T) => void;
}) {
  const colors = useColors();

  return (
    <View style={styles.row}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            accessibilityHint={option.hint}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: active ? colors.primary : colors.surface,
                borderColor: active ? colors.primary : colors.borderSoft,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <Icon
              name={option.icon}
              size={20}
              color={active ? colors.onPrimary : colors.primary}
            />
            <Text
              style={[
                type.bodySmall,
                styles.label,
                { color: active ? colors.onPrimary : colors.text },
              ]}
              numberOfLines={2}
            >
              {option.label}
            </Text>
            <Text
              style={[
                type.caption,
                { color: active ? colors.onPrimary : colors.textSecondary },
              ]}
              numberOfLines={2}
            >
              {option.hint}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  card: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space.md,
    gap: space.xs,
    minHeight: 96,
  },
  label: { fontFamily: fontFamily.semibold, fontWeight: '600' },
});
