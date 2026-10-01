import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { radius, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

type Tone = 'info' | 'danger';

const TONE: Record<Tone, { icon: IconName; color: 'info' | 'danger' }> = {
  info: { icon: 'bell', color: 'info' },
  danger: { icon: 'close', color: 'danger' },
};

type Props = {
  message: string;
  tone?: Tone;
  /** A retry or dismiss action, rendered under the message. */
  action?: ReactNode;
};

/**
 * Inline message strip — a failed submit, a lost connection.
 *
 * Shared because sign-in, sign-up and onboarding each had their own copy, which is how
 * three slightly different error treatments appear in one flow.
 *
 * `accessibilityLiveRegion` is on the text: a banner usually arrives *after* the screen
 * has rendered, in response to something the user just did, so it has to announce itself
 * rather than wait to be found. Colour is never the only signal (spec 08.1) — the glyph
 * and the message carry it.
 */
export function Banner({ message, tone = 'danger', action }: Props) {
  const colors = useColors();
  const { icon, color } = TONE[tone];
  const foreground = colors[color];

  return (
    <View
      style={[
        styles.base,
        { backgroundColor: colors.surfaceAlt, borderColor: foreground },
      ]}
    >
      <View style={styles.row}>
        <Icon name={icon} size={18} color={foreground} strokeWidth={2} />
        <Text
          accessibilityLiveRegion="polite"
          style={[type.bodySmall, styles.message, { color: colors.text }]}
        >
          {message}
        </Text>
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    padding: space.md,
    borderRadius: radius.card,
    borderWidth: 1,
    gap: space.sm,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  message: { flex: 1 },
});
