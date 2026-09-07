import { StyleSheet, Text, View } from 'react-native';

import { layout, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * Temporary placeholder for screens whose phase has not started yet.
 *
 * Deliberately says what is missing rather than showing invented content — the app never
 * ships fake data, not even in a stub (spec 01.8 #4). Delete this component once the last
 * stub is replaced.
 */
export function ScreenStub({ title, note }: { title: string; note?: string }) {
  const colors = useColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[type.h1, { color: colors.text }]}>{title}</Text>
      <Text style={[type.body, styles.note, { color: colors.textSecondary }]}>
        {note ?? 'Not built yet.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: layout.gutter,
  },
  note: {
    marginTop: 8,
    textAlign: 'center',
  },
});
