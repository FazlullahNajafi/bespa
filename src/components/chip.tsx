import { Pressable, StyleSheet, Text } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { fontFamily, layout, radius, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

type Props = {
  label: string;
  icon?: IconName;
  selected?: boolean;
  onPress?: () => void;
  accessibilityHint?: string;
};

/**
 * Filter and category chip (spec 08.5).
 *
 * Always label *and* glyph when an icon is given, never the glyph alone — spec 08.6 makes
 * low-literacy support a first-class requirement, and an unlabelled icon is exactly the
 * thing it rules out.
 *
 * The 44pt floor applies here too, which is why a chip is taller than its text needs.
 */
export function Chip({ label, icon, selected = false, onPress, accessibilityHint }: Props) {
  const colors = useColors();

  const foreground = selected ? colors.onPrimary : colors.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
          opacity: pressed && onPress ? 0.85 : 1,
        },
      ]}
    >
      {icon ? <Icon name={icon} size={16} color={foreground} /> : null}
      <Text style={[type.caption, styles.label, { color: foreground }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    minHeight: layout.tap,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  label: { fontFamily: fontFamily.semibold, fontWeight: '600' },
});
