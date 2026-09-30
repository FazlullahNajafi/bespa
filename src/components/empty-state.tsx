import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Icon, type IconName } from '@/components/icon';
import { layout, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

type Props = {
  icon: IconName;
  /** One line. If it needs two, the screen is explaining too much. */
  message: string;
  action?: { label: string; onPress: () => void };
};

/**
 * Illustration, one line, one action (spec 08.5).
 *
 * The icon is decorative and hidden from screen readers: the message says the same thing
 * in words, and announcing both just doubles it.
 *
 * An empty state says what is *absent*, never invents placeholder content to fill the
 * space — the app ships no fake data (spec 01.8 #4).
 */
export function EmptyState({ icon, message, action }: Props) {
  const colors = useColors();

  return (
    <View style={styles.base}>
      <Icon name={icon} size={40} color={colors.textFaint} strokeWidth={1.4} />
      <Text
        style={[type.body, styles.message, { color: colors.textSecondary }]}
        accessibilityRole="text"
      >
        {message}
      </Text>
      {action ? (
        <View style={styles.action}>
          <Button label={action.label} onPress={action.onPress} variant="secondary" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    padding: layout.gutter,
  },
  message: { textAlign: 'center', maxWidth: 320 },
  action: { alignSelf: 'stretch', maxWidth: 320 },
});
