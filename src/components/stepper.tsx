import { StyleSheet, Text, View } from 'react-native';

import { fontFamily, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

type Props = {
  /** Already-translated step names, in order. */
  steps: string[];
  /** Zero-based index of the step being asked now. */
  current: number;
};

/**
 * The onboarding progress row from the design (`LocStepper` in
 * `design/bespa_design/screens-location.jsx`): a bar and a word per step.
 *
 * It exists because the village picker is one screen that asks several questions in
 * sequence, so without it there is nothing to say how far along a walk is or how much is
 * left. "Two more taps" is the difference between a cascade someone finishes and one they
 * abandon.
 *
 * The steps are passed in rather than derived here, because which levels get asked is a
 * property of the seeded geography — today Ladakh and Kargil are auto-descended, and the
 * day a second district is seeded the walk grows a step by itself.
 */
export function Stepper({ steps, current }: Props) {
  const colors = useColors();

  if (steps.length < 2) return null;

  return (
    <View
      style={styles.row}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: steps.length, now: Math.min(current + 1, steps.length) }}
    >
      {steps.map((label, index) => {
        const done = index < current;
        const active = index === current;

        return (
          <View key={label} style={styles.step}>
            <View
              style={[
                styles.bar,
                { backgroundColor: done || active ? colors.primary : colors.border },
              ]}
            />
            <Text
              style={[
                type.caption,
                styles.label,
                {
                  color: active
                    ? colors.primary
                    : done
                      ? colors.textSecondary
                      : // An unreached step is not information yet, which is the one case
                        // `textFaint` is for (it sits below the body contrast floor).
                        colors.textFaint,
                },
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.xs },
  step: { flex: 1, gap: space.xs },
  bar: { height: 3, borderRadius: 2 },
  label: { textTransform: 'uppercase', letterSpacing: 0.4, fontFamily: fontFamily.semibold },
});
