import { createContext, useContext, type ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { layout, space } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * Set by a navigator whose own chrome sits below the screen and has already paid the
 * bottom safe-area inset. The tab bar does, and its screens stop above it — so a tab
 * screen that paid the inset again would leave a navigation bar's worth of dead space
 * above the tabs.
 *
 * A context rather than a prop because the rule belongs to the navigator, not to the
 * screen: the screen cannot know what is rendered beneath it, and a prop every screen
 * has to remember is a prop some screen will forget.
 */
const BottomChromeContext = createContext(false);

export function BottomChromeProvider({ children }: { children: ReactNode }) {
  return <BottomChromeContext.Provider value>{children}</BottomChromeContext.Provider>;
}

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
  const hasBottomChrome = useContext(BottomChromeContext);

  const Body = scroll ? ScrollView : View;

  /**
   * The bottom inset is the screen's to pay whenever nothing below it already has.
   *
   * Edge-to-edge means the window extends under the Android navigation bar — 48dp of it
   * on the test device — so without this the last row of a list scrolls *behind* the
   * back/home/recents buttons. It was visible on the village picker, where the final
   * villages (Sapi among them) sat under the buttons and could not be tapped, and on the
   * notices list.
   *
   * Two things below a screen already pay it, and must not be paid for twice: the tab bar
   * (see BottomChromeContext) and this component's own footer.
   */
  const padBottom = hasBottomChrome || footer ? 0 : insets.bottom;

  const edges = {
    // Edge-to-edge means the status bar sits ON the content, not above it. Without this
    // inset the first heading of every screen is clipped by the clock.
    paddingTop: insets.top + layout.gutter,
    paddingBottom: padBottom + layout.gutter,
  };

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
        // `contentContainerStyle` on a ScrollView, plain `style` on a View: a View ignores
        // the former outright, which silently cost a non-scrolling screen both insets.
        {...(scroll
          ? { contentContainerStyle: [styles.content, edges] }
          : { style: [styles.flex, styles.content, edges] })}
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
    paddingHorizontal: layout.gutter,
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
