import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { layout, space } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

type Props = {
  children: ReactNode;
  /** Scrollable by default; forms and lists want it, seat maps do not. */
  scroll?: boolean;
  /**
   * Pins content to the bottom third. Primary actions live there so the app stays usable
   * one-handed (spec 08.6) — which matters for a driver holding a phone at the wheel-side.
   */
  footer?: ReactNode;
};

export function Screen({ children, scroll = true, footer }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const Body = scroll ? ScrollView : View;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      // `padding` on Android too, not just iOS. Expo SDK 54+ draws edge-to-edge by
      // default and Android 15 enforces it, so the window no longer resizes when the
      // keyboard opens — without this the keyboard covers the footer outright, and the
      // footer is where the primary action lives by design.
      behavior="padding"
    >
      <Body
        style={styles.flex}
        contentContainerStyle={[
          scroll ? styles.content : undefined,
          // Edge-to-edge means the status bar sits ON the content, not above it. Without
          // this inset the first heading of every screen is clipped by the clock.
          { paddingTop: insets.top + layout.gutter },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </Body>

      {/* An opaque band behind the status bar.
          The inset above keeps the FIRST heading clear of the clock, but nothing stops
          the rest scrolling underneath it — and a heading sliding behind the time and
          battery is unreadable exactly where spec 08.1 asks for legibility in glare.
          Android 15 no longer allows a solid status-bar colour, so the app draws its own.
          Last child and absolutely positioned, so it paints over the scrolling content
          without taking part in the layout. */}
      <View
        pointerEvents="none"
        style={[styles.statusBand, { height: insets.top, backgroundColor: colors.background }]}
      />

      {footer ? (
        <View
          style={[
            styles.footer,
            {
              paddingBottom: Math.max(insets.bottom, space.lg),
              borderTopColor: colors.border,
              backgroundColor: colors.background,
            },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: layout.gutter,
    gap: space.lg,
    flexGrow: 1,
  },
  statusBand: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  footer: {
    padding: layout.gutter,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: space.sm,
  },
});
