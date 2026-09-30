/**
 * Design tokens — spec 08, with the palette taken from the Bespa Claude Design project
 * (`design/bespa_design/design-system.jsx`).
 *
 * Light is the design's **Suru Dawn** (warm parchment, twilight indigo, apricot); dark is
 * its **Twilight**. The design's other two light themes (Drass Snow, Stone Village) are
 * not shipped — they existed for the Tweaks panel, which was a design tool rather than a
 * product feature.
 *
 * Named for the place, so the palette stays honest: the Suru valley at dawn, parchment,
 * ink, apricot bloom, terracotta, glacier teal.
 *
 * Rules encoded here rather than left to each screen:
 *   - Contrast is non-negotiable (>=4.5:1 body, >=3:1 large/icons) in BOTH themes.
 *     Screens get read outdoors at 3,000 m in snow glare.
 *   - Colour is never the sole signal. Seat/issue/notice states pair a hue with a glyph;
 *     see `seatState` below, which carries both.
 *   - 4pt spacing scale, 12pt card radius, 16pt gutters, one elevation level.
 *
 * DEVIATIONS FROM THE DESIGN, all of them contrast failures measured against white
 * (light) or the Twilight surface (dark). Each is the smallest darkening along the same
 * hue that clears the floor, so the design's colour character survives:
 *   - light `accent`  #e8915a -> #ce8150 — was 2.43:1 as an icon/large colour, needs 3.0
 *   - light `success` #5a8a6b -> #548064 — was 3.98:1 as text, needs 4.5
 *   - light `info`    #5d8a99 -> #547c8a — was 3.78:1 as text, needs 4.5
 *   - `onPrimary` added. The design paints button labels white in every theme, but dark
 *     `primary` is a LIGHT indigo (#7e9bd9): white on it is 2.77:1, unreadable. Dark
 *     therefore labels its primary buttons with near-black (6.63:1).
 *   - `onDanger` added, for the same reason: dark `danger` is a light terracotta
 *     (#D76A51) and white on it is 3.46:1. Dark labels its danger buttons near-black.
 *   - `warning` added. The design has no warning hue, but spec 08 needs one for the
 *     held-seat state and `PendingChip`. Light and dark need different values: a single
 *     amber cannot clear 4.5:1 on both parchment and near-black.
 *
 * `inkFaint` fails 4.5:1 in every one of the design's themes (2.55–3.41). Rather than
 * change it, it is exposed as `textFaint` and reserved for decorative and disabled text
 * only — never for anything a user has to read. Disabled controls are exempt from the
 * contrast requirement; genuinely faint body text is not, and must use `textSecondary`.
 */

export const palette = {
  light: {
    // Suru Dawn
    bg: '#F6EFE4', // warm parchment
    surface: '#FFFFFF',
    surfaceAlt: '#FBF6EC',
    ink: '#1A2238', // deep ink-blue
    inkSoft: '#5B6580',
    inkFaint: '#9AA2B8',
    border: '#E7DCC7',
    borderSoft: '#EFE7D5',
    primary: '#2B3A6B', // twilight indigo
    primaryPressed: '#25315B',
    primarySoft: '#DFE3EE',
    onPrimary: '#FFFFFF',
    accent: '#CE8150', // apricot, darkened to clear 3:1
    accentSoft: '#FCE7D6',
    success: '#548064',
    warning: '#9A6300',
    danger: '#B9543D', // terracotta
    onDanger: '#FFFFFF',
    info: '#547C8A', // glacier teal
  },
  dark: {
    // Twilight
    bg: '#0F1421',
    surface: '#1A2238',
    surfaceAlt: '#222B45',
    ink: '#EEF0F6',
    inkSoft: '#A3ACC4',
    inkFaint: '#6A7494',
    border: '#2C3654',
    borderSoft: '#252D48',
    primary: '#7E9BD9',
    primaryPressed: '#6B84B8',
    primarySoft: '#27324E',
    onPrimary: '#0F1421', // near-black: white on this primary is 2.77:1
    accent: '#E8915A',
    accentSoft: '#3A2A1F',
    success: '#7AB28C',
    warning: '#D99C1C',
    danger: '#D76A51',
    onDanger: '#0F1421', // white on this danger is 3.46:1
    info: '#7EB0C4',
  },
} as const;

export type Scheme = keyof typeof palette;
export type ColorToken = keyof (typeof palette)['light'];

/** Semantic aliases. Screens use these; only the design system touches raw tokens. */
export const semantic = (scheme: Scheme) => {
  const c = palette[scheme];
  return {
    primary: c.primary,
    primaryPressed: c.primaryPressed,
    /** Label colour for a filled primary button. Never hard-code white. */
    onPrimary: c.onPrimary,
    /** Tinted surface for informational banners and selected rows. */
    infoSurface: c.primarySoft,
    surface: c.surface,
    /** A second surface for rows nested on `surface` — spec 08 forbids nested cards. */
    surfaceAlt: c.surfaceAlt,
    background: c.bg,
    text: c.ink,
    textSecondary: c.inkSoft,
    /** Decorative and disabled text ONLY — below 4.5:1 by design. */
    textFaint: c.inkFaint,
    border: c.border,
    borderSoft: c.borderSoft,
    accent: c.accent,
    accentSoft: c.accentSoft,
    success: c.success,
    warning: c.warning,
    danger: c.danger,
    /** Label colour for a filled danger button. Never hard-code white. */
    onDanger: c.onDanger,
    info: c.info,
  } as const;
};

/** 4pt scale. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  card: 12,
  sheet: 20,
  pill: 999,
} as const;

export const layout = {
  gutter: 16,
  /** Minimum touch target (spec 08.6). Emergency call buttons use `tapEmergency`. */
  tap: 44,
  tapEmergency: 56,
} as const;

/**
 * DM Sans, the design's UI face, bundled from `assets/fonts` (OFL — licence kept beside
 * the files) and registered by `useFonts` in the root layout.
 *
 * One family per weight, deliberately. React Native does not synthesise weight for a
 * custom font: asking for `fontWeight: '600'` on a family that only ships Regular gets
 * you Regular on Android and a smeared fake-bold on some web engines. Naming the real
 * face is the only reliable way, so the type scale below pairs each step with its file.
 */
export const fontFamily = {
  regular: 'DMSans-Regular',
  medium: 'DMSans-Medium',
  semibold: 'DMSans-SemiBold',
  bold: 'DMSans-Bold',
} as const;

/**
 * Type scale (spec 08.2). Urdu renders in Noto Nastaliq with extra vertical room —
 * Nastaliq needs it, and clipping descenders makes the script unreadable rather than
 * merely tight.
 *
 * The design sets headings in Instrument Serif; we deliberately do not. Pairing a Latin
 * serif with Nastaliq headings reads as two unrelated voices, and the app is bilingual in
 * every screen. Headings stay in the UI sans at a heavier weight.
 *
 * `fontWeight` is kept alongside `fontFamily` for react-native-web, which uses it to pick
 * a face and to fall back sanely before the font has loaded.
 */
export const type = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: '600', fontFamily: fontFamily.semibold },
  h1: { fontSize: 22, lineHeight: 28, fontWeight: '600', fontFamily: fontFamily.semibold },
  h2: { fontSize: 18, lineHeight: 24, fontWeight: '600', fontFamily: fontFamily.semibold },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400', fontFamily: fontFamily.regular },
  bodySmall: { fontSize: 14, lineHeight: 20, fontWeight: '400', fontFamily: fontFamily.regular },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    letterSpacing: 0.2,
    fontFamily: fontFamily.medium,
  },
} as const;

export const urduAdjust = { fontSizeDelta: 2, lineHeightDelta: 4 } as const;

/**
 * Seat states carry a glyph as well as a hue — for colour-blind users and for the many
 * cheap, washed-out screens in the field (spec 04.2, 08.1).
 */
export const seatState = {
  free: { token: 'success', glyph: 'circle-outline', labelKey: 'transport.seat.free' },
  held: { token: 'warning', glyph: 'clock', labelKey: 'transport.seat.held' },
  booked: { token: 'danger', glyph: 'lock', labelKey: 'transport.seat.booked' },
  selected: { token: 'primary', glyph: 'check', labelKey: 'transport.seat.selected' },
} as const satisfies Record<string, { token: ColorToken; glyph: string; labelKey: string }>;

export const motion = {
  seatSelect: 120,
  bookingConfirmed: 600,
  seatLost: 200,
} as const;
