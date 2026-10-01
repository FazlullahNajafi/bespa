import type { ReactNode } from 'react';
import { I18nManager, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { fontFamily, layout, radius, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

type Props = {
  title: string;
  subtitle?: string;
  /** Leading slot — an `Icon`, `Avatar`, or a number. Decorative; label the row instead. */
  leading?: ReactNode;
  /** Trailing text, e.g. a count or a time. */
  meta?: string;
  onPress?: () => void;
  /** Renders the selected treatment: tinted fill, accent border, and a check. */
  selected?: boolean;
  /** Shows a chevron, for a row that drills into another level. */
  drills?: boolean;
  accessibilityHint?: string;
};

/**
 * The selectable list row from the design's location picker, which is the pattern its
 * directory and services lists reuse.
 *
 * Two deliberate departures from the design, both spec 08:
 *   - it sets the title at 14pt and the subtitle at 12pt, against the design's 13.5 and
 *     10.5. Spec 08.2's scale stops at 12, and 10.5pt is not a size to read outdoors at
 *     3,000 m in glare, which is the condition spec 08.1 is written for.
 *   - it enforces the 44pt minimum target (spec 08.6). The design's 11pt padding lands
 *     just under it on a single-line row.
 *
 * Selection is never colour alone (spec 08.1): the tint and border are joined by a check
 * glyph, and the row reports `selected` to screen readers.
 */
export function ListRow({
  title,
  subtitle,
  leading,
  meta,
  onPress,
  selected = false,
  drills = false,
  accessibilityHint,
}: Props) {
  const colors = useColors();

  // Align to the LAYOUT's direction, not the text's. Left to itself, React Native aligns a
  // run of Arabic script to the right even inside an LTR screen, which strands a village's
  // Urdu name against the far edge while its English name sits at the left.
  const align = I18nManager.isRTL ? ('right' as const) : ('left' as const);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: selected ? colors.infoSurface : colors.surface,
          borderColor: selected ? colors.primary : colors.borderSoft,
          opacity: pressed && onPress ? 0.85 : 1,
        },
      ]}
    >
      {leading}

      <View style={styles.text}>
        <Text
          style={[type.bodySmall, styles.title, { color: colors.text, textAlign: align }]}
          numberOfLines={2}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[type.caption, { color: colors.textSecondary, textAlign: align }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {meta ? (
        <Text style={[type.caption, { color: colors.textSecondary }]} numberOfLines={1}>
          {meta}
        </Text>
      ) : null}

      {selected ? (
        <View style={[styles.check, { backgroundColor: colors.primary }]}>
          <Icon name="check" size={12} color={colors.onPrimary} strokeWidth={3} />
        </View>
      ) : drills ? (
        <Icon name="chevron" size={18} color={colors.textSecondary} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: layout.tap,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.card,
    borderWidth: 1.5,
  },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: fontFamily.semibold, fontWeight: '600' },
  check: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
