# Bespa — Product Spec

Community super-app prototype for Kargil and surrounding Himalayan valleys (Ladakh, J&K). Bilingual (English / Purgi), theme-switchable, mobile-first.

## Design system (`design-system.jsx`)
- **Typography:** DM Sans (UI), Instrument Serif / Cormorant Garamond (headline/serif accents)
- **Themes** (4, switchable via Tweaks panel):
  - Suru Dawn — warm parchment + indigo + apricot (default, light)
  - Drass Snow — glacier blues (light)
  - Stone Village — terracotta + stone (light)
  - Twilight — dark mode, indigo/apricot on near-black
- **Iconography:** custom line-icon set (mountain, bell, people, car, spark, chat, weather, etc.) — no branded glyphs
- **Motif:** abstract layered-mountain SVG used on hero/header sections
- **Components:** `Phone` device shell w/ custom status bar & gesture nav, `TabBar` (Home / Community / Bespa AI / Profile), `Header` (serif title + optional mountain motif), `Placeholder` (striped image placeholder), `Avatar` (initials), `BespaLogo`
- **Copy registry:** all strings keyed in `COPY.en` / `COPY.pq`, driven by a language tweak (`en` LTR / `pq` RTL, Perso-Arabic script)

## Screens / flows (`app.jsx` wires these onto a design canvas)

1. **Onboarding** — Login (mobile number) → OTP verify
2. **Profile setup** — name + occupation, two layout variants (tile grid / list)
3. **Taxi driver verification** — shown only if occupation = Taxi Driver; document checklist + one-at-a-time camera capture (RTO documents gate ride-accepting)
4. **Location setup** — cascading picker: State → District → Block → Village+Panchayat or Town+Municipality → summary ("Your area")
5. **Home & Weather** — main dashboard + 7-day forecast screen
6. **Profile & Settings** (Account) — merged identity + app settings, opened from avatar tap
7. **Govt & community services** — Government Notices, Village Members directory
8. **Cab booking** — shared/private, short/long distance; full loop for both passenger and driver roles (search → results → trip; driver: dashboard → request → active trip). Ladakh short-private-hire case covered separately (village ↔ town, immediate departure)
9. **MGNREGA tracker** — two dashboard variants (progress-first / wages-first ledger)
10. **Social & assistance** — Community feed + post composer (no like/comment counts, by request), Photo Gallery, Bespa AI assistant chat

## Interaction notes
- Cab booking screens are live/tappable inside their artboards — walk the full flow per role.
- Tweaks panel: language toggle (en/pq) and theme palette selector, global across all screens.

## Known content gaps (placeholder copy, currently `\n` in COPY — needs real strings)
- Profile: name placeholder/hint, all occupation subtitles (Farmer, Driver, Shopkeeper, Official, Teacher, Health worker), "optional" label
- NREGA section subtitle
