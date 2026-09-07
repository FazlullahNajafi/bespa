/**
 * Design tokens — spec 08.
 *
 * Named for the place, so the palette stays honest: the Suru river, snow, the stone of
 * the valley, apricot bloom, willow green, saffron, garnet.
 *
 * Rules encoded here rather than left to each screen:
 *   - Contrast is non-negotiable (>=4.5:1 body, >=3:1 large/icons) in BOTH themes.
 *     Screens get read outdoors at 3,000 m in snow glare.
 *   - Colour is never the sole signal. Seat/issue/notice states pair a hue with a glyph;
 *     see `seatState` below, which carries both.
 *   - 4pt spacing scale, 12pt card radius, 16pt gutters, one elevation level.
 */

export const palette = {
  light: {
    'suru-600': '#1B6FA8',
    'suru-700': '#155884',
    'suru-50': '#EAF4FB',
    'snow-0': '#FFFFFF',
    'snow-50': '#F6F9FC',
    'stone-900': '#10202B',
    'stone-500': '#5B7186',
    'stone-200': '#DCE6ED',
    'apricot-500': '#E8823A',
    'willow-500': '#2E8B62',
    'saffron-500': '#D99C1C',
    'garnet-500': '#C33F3F',
  },
  dark: {
    'suru-600': '#4FA3D9',
    'suru-700': '#3E8CBE',
    'suru-50': '#12283A',
    'snow-0': '#0E1720',
    'snow-50': '#0A1118',
    'stone-900': '#EAF1F6',
    'stone-500': '#9DB0C0',
    'stone-200': '#22323F',
    'apricot-500': '#F09A5C',
    'willow-500': '#4CB185',
    'saffron-500': '#EBB544',
    'garnet-500': '#E06060',
  },
} as const;

export type Scheme = keyof typeof palette;
export type ColorToken = keyof (typeof palette)['light'];

/** Semantic aliases. Screens use these; only the design system touches raw tokens. */
export const semantic = (scheme: Scheme) => {
  const c = palette[scheme];
  return {
    primary: c['suru-600'],
    primaryPressed: c['suru-700'],
    infoSurface: c['suru-50'],
    surface: c['snow-0'],
    background: c['snow-50'],
    text: c['stone-900'],
    textSecondary: c['stone-500'],
    border: c['stone-200'],
    accent: c['apricot-500'],
    success: c['willow-500'],
    warning: c['saffron-500'],
    danger: c['garnet-500'],
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
 * Type scale (spec 08.2). Urdu renders in Noto Nastaliq with extra vertical room —
 * Nastaliq needs it, and clipping descenders makes the script unreadable rather than
 * merely tight.
 */
export const type = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: '600' },
  h1: { fontSize: 22, lineHeight: 28, fontWeight: '600' },
  h2: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodySmall: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500', letterSpacing: 0.2 },
} as const;

export const urduAdjust = { fontSizeDelta: 2, lineHeightDelta: 4 } as const;

/**
 * Seat states carry a glyph as well as a hue — for colour-blind users and for the many
 * cheap, washed-out screens in the field (spec 04.2, 08.1).
 */
export const seatState = {
  free: { token: 'willow-500', glyph: 'circle-outline', labelKey: 'transport.seat.free' },
  held: { token: 'saffron-500', glyph: 'clock', labelKey: 'transport.seat.held' },
  booked: { token: 'garnet-500', glyph: 'lock', labelKey: 'transport.seat.booked' },
  selected: { token: 'suru-600', glyph: 'check', labelKey: 'transport.seat.selected' },
} as const;

export const motion = {
  seatSelect: 120,
  bookingConfirmed: 600,
  seatLost: 200,
} as const;
