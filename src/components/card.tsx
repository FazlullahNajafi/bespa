import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { radius, space } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

type Props = {
  children: ReactNode;
  /**
   * Sits on another card's surface. Spec 08.5 forbids nested cards, so this does not add
   * a second elevation — it switches to `surfaceAlt` and drops the border instead.
   */
  inset?: boolean;
  style?: ViewStyle;
};

/**
 * The one card treatment (spec 08.5): 12pt radius, a single hairline border, one
 * elevation level. The design draws cards as a flat surface with a soft border rather
 * than a shadow, which also survives the cheap washed-out screens spec 08.1 is written
 * for — a shadow is the first thing to disappear on them.
 */
export function Card({ children, inset = false, style }: Props) {
  const colors = useColors();

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: inset ? colors.surfaceAlt : colors.surface,
          borderColor: inset ? 'transparent' : colors.borderSoft,
          borderWidth: inset ? 0 : StyleSheet.hairlineWidth * 2,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.card,
    padding: space.lg,
    gap: space.sm,
  },
});
