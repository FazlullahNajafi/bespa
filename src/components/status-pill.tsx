import { StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { fontFamily, radius, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * Each tone pairs a hue with a glyph, because spec 08.1 does not allow colour to be the
 * only signal — for colour-blind users, and for the washed-out screens these are read on.
 */
const TONE = {
  neutral: { icon: 'clock', color: 'textSecondary' },
  success: { icon: 'check', color: 'success' },
  warning: { icon: 'clock', color: 'warning' },
  danger: { icon: 'close', color: 'danger' },
  info: { icon: 'bell', color: 'info' },
} as const satisfies Record<string, { icon: IconName; color: string }>;

export type StatusTone = keyof typeof TONE;

type Props = {
  label: string;
  tone?: StatusTone;
};

/**
 * A small non-interactive state marker — pending, confirmed, cancelled (spec 08.5).
 *
 * Unlike `Chip` this is not a target, so it is exempt from the 44pt rule: it carries no
 * action, and padding it out to 44 would make a status read as a button.
 */
export function StatusPill({ label, tone = 'neutral' }: Props) {
  const colors = useColors();
  const { icon, color } = TONE[tone];
  const foreground = colors[color as keyof typeof colors];

  return (
    <View
      style={[styles.base, { borderColor: foreground, backgroundColor: colors.surface }]}
      accessibilityRole="text"
      accessibilityLabel={label}
    >
      <Icon name={icon} size={12} color={foreground} strokeWidth={2} />
      <Text style={[type.caption, styles.label, { color: foreground }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  label: { fontFamily: fontFamily.semibold, fontWeight: '600' },
});
