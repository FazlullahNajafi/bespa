# 08 — Design system

**The brief:** *modern and colourful, calm blue and white, cultural elements — mosques,
imambargah, snow-covered mountains. The vibe of Kargil: the land of the brave, the land of
scholars. Mountains, the Suru river, springs, greenery.*

**The interpretation:** calm blue and white as the *interface*, the landscape as the
*atmosphere*. Cultural motifs live in illustration, empty states, headers, and the
onboarding — never in chrome that a user must read through. A hospital's phone number must
not sit on a mountain.

## 8.1 Colour

Named for the place, so the palette stays honest.

| Token | Light | Dark | Use |
|---|---|---|---|
| `suru-600` **primary** | `#1B6FA8` | `#4FA3D9` | Primary actions, active tab, links |
| `suru-700` | `#155884` | `#3E8CBE` | Pressed |
| `suru-50` | `#EAF4FB` | `#12283A` | Selected rows, info surfaces |
| `snow-0` **surface** | `#FFFFFF` | `#0E1720` | Cards, sheets |
| `snow-50` **background** | `#F6F9FC` | `#0A1118` | Screen background |
| `stone-900` **text** | `#10202B` | `#EAF1F6` | Primary text |
| `stone-500` | `#5B7186` | `#9DB0C0` | Secondary text |
| `stone-200` | `#DCE6ED` | `#22323F` | Borders, dividers |
| `apricot-500` **accent** | `#E8823A` | `#F09A5C` | Festivals, highlights, banner accents |
| `willow-500` **success** | `#2E8B62` | `#4CB185` | Seat free, resolved, verified |
| `saffron-500` **warning** | `#D99C1C` | `#EBB544` | Seat held, pending, alerts |
| `garnet-500` **danger** | `#C33F3F` | `#E06060` | Seat booked, errors, emergency |

Two accents only — apricot (warmth, festival) and willow (the valley's greenery) — against
a blue-and-white base. Everything else is neutral. Emergency helplines use `garnet` at full
strength and are the only place a saturated red appears.

**Contrast is non-negotiable:** all text ≥ 4.5:1, large text and icons ≥ 3:1, verified in
both themes. Screens will be read outdoors at 3,000 m in bright snow-glare — mid-tone grey
on white is not acceptable anywhere.

**Colour is never the sole signal.** Seat states carry a glyph as well as a hue (free =
outline, held = clock, booked = lock). Issue statuses carry an icon. Notice categories
carry a labelled chip.

## 8.2 Typography

| Role | Font | Size / weight |
|---|---|---|
| Display | Inter Tight SemiBold | 28/34 |
| H1 | Inter SemiBold | 22/28 |
| H2 | Inter SemiBold | 18/24 |
| Body | Inter Regular | 16/24 |
| Body small | Inter Regular | 14/20 |
| Caption | Inter Medium | 12/16, +0.2 tracking |
| Numeric | Inter tabular figures | seat numbers, fares, stats |
| Urdu | Noto Nastaliq Urdu | +2px, +4 line-height — Nastaliq needs vertical room |
| Purgi | Noto Sans (Latin transliteration) at launch | Perso-Arabic script support tracked for v2 |

Minimum body size is 16px and the app honours OS font scaling up to 200% — layouts use
flex and wrap, never fixed heights on text containers. RTL is fully supported for Urdu
(`I18nManager`), including mirrored icons and the seat map.

## 8.3 Illustration & cultural motif

Custom illustrations in a flat, warm, geometric style with visible line weight — friendly
but not childish.

- **Motif library:** snow-capped ridgeline, Suru river bend, poplar avenue, apricot bloom,
  mosque and imambargah silhouettes, a stone-and-mud village house, an Eeco on a mountain
  road, a taxi stand, a chai glass.
- **Where they appear:** onboarding (3 panels), every empty state, section headers as a
  low-contrast ridgeline band, festival cards, achievement moments.
- **Where they never appear:** behind body text, behind phone numbers, behind seat maps,
  behind form fields.
- **The ridgeline header:** a subtle mountain silhouette at 6–8% opacity across the top of
  the Home and Calendar headers. This is the single most identity-carrying element — get
  it right and the app reads as Kargil's on the first screen.
- **Religious imagery:** architectural silhouettes only. No depiction of persons, no
  calligraphy of holy names in decorative roles. Festival artwork is reviewed locally
  before shipping.

## 8.4 Motion & haptics

Purposeful, short, and always disabled under `prefers-reduced-motion`.

| Interaction | Motion | Haptic |
|---|---|---|
| Seat select | 120ms scale 0.94→1 | `selectionAsync` |
| Booking confirmed | Checkmark draw + gentle confetti, 600ms | `notificationAsync(Success)` |
| Seat lost to another passenger | Shake 200ms | `notificationAsync(Warning)` |
| Driver goes live | Pulse on the live badge | `impactAsync(Medium)` |
| Pull to refresh | Ridgeline fills as it pulls | `impactAsync(Light)` at threshold |
| Issue submitted | Envelope-to-timeline transition | `notificationAsync(Success)` |
| Emergency call tap | none | `impactAsync(Heavy)` |
| Destructive confirm | none | `notificationAsync(Error)` |

Every animation is skippable and no animation blocks input. Haptics respect a Settings
toggle and the OS setting.

## 8.5 Components

Primitives in `src/components/`: `Button` (primary/secondary/ghost/danger, all with a
44×44pt minimum target), `Card`, `Chip`, `Sheet`, `ListRow`, `Avatar` (initials fallback
with a deterministic colour from the name), `EmptyState` (illustration + one line + one
action), `StatTile`, `SeatMap`, `CallButton`, `StatusPill`, `PhotoGrid`, `MapOrImage`
(auto-falls back to the stored static image when tiles fail), `OfflineBanner`,
`PendingChip`, `LanguageSwitch`.

Layout: 4pt spacing scale, 12pt card radius, 16pt screen gutters, one elevation level
(cards) plus one for sheets. No nested cards.

## 8.6 Accessibility

- Every interactive element has an `accessibilityLabel` and `accessibilityRole`; seat map
  seats announce as *"Seat 3, window, free, double tap to select"*.
- Full VoiceOver/TalkBack pass on: onboarding, Home, seat map, booking confirmation,
  helplines, issue submission. These are the paths where failure is most costly.
- Touch targets ≥ 44×44pt. Emergency call buttons ≥ 56pt.
- The app is usable one-handed: primary actions sit in the bottom third.
- **Low-literacy support** is a first-class requirement, not an afterthought: every
  category is an icon *and* a word; the issue reporter accepts a voice note; the helpline
  list is dialable without reading past the icon.

## 8.7 Lite mode

Auto-enabled on `2g`/`slow-2g` and toggleable in Settings. Suppresses the banner carousel,
loads avatars as initials, defers non-critical images, disables the map in favour of the
static image, and drops decorative animations. Announced once with a dismissible banner —
never silently.
