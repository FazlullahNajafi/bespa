# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

Bespa is a community app for Kargil district, Ladakh — an Expo (SDK 57) React Native app
on a local Supabase stack. `spec/` holds the written specification; it is the authority
for product decisions, and files cite it (`spec 08.6`, `spec 02.2`) rather than restating
it. Read the cited section before changing behaviour it governs.

## Commands

```bash
npm start                      # Expo dev server (all platforms)
npm run web                    # web only; .claude/launch.json pins port 8082
npm run typecheck              # tsc --noEmit
npx expo lint                  # ESLint
```

Database — the stack must be running for the app to do anything, since `village_id` gates
every read:

```bash
npm run db:start               # supabase start
npm run db:reset               # re-apply all migrations + seeds; use after editing ANY migration
npm run db:types               # regenerate src/lib/database.types.ts from the live DB
npm run db:test                # pgTAP suite in supabase/tests/
```

Run one pgTAP file directly (`db:test` has no filter):

```bash
docker exec -i supabase_db_bespa psql -U postgres -d postgres -f /dev/stdin < supabase/tests/identity_rls.test.sql
```

Project-specific checks:

```bash
python scripts/check-contrast.py   # asserts spec 08.6 contrast floors against theme/tokens.ts
python scripts/gen-icons.py        # regenerates src/components/icon.tsx from the design export
```

`npm test` is in `package.json` but **does not work** — jest is neither installed nor
configured. `scripts/check-contrast.py` and the pgTAP suite are the only automated tests.

## Architecture

**Tenancy is `profiles.village_id`.** Every village-scoped RLS policy compares against it,
so a session without one can see nothing. This is why the auth gate in
`src/app/_layout.tsx` has *three* states, not two: signed out, signed in without a village,
signed in. The middle state routes to `(onboarding)/pick-village`, and the gate holds its
decision while the profile query is pending so a returning user is not bounced through
onboarding on every cold start.

**Geography is one `geo_units` table**, self-referencing via `parent_id` with an ltree
`path` maintained by trigger (`ladakh.kargil.sankoo.sangrah`). Villages hang off the
**block**, not off a panchayat — the Kargil source data lists panchayats and revenue
villages as two independent columns with no mapping between them. See
`supabase/seed/002_geo_kargil_villages.sql`. `set_my_village` currently validates
`panchayat.parent_id = village`, which is backwards and is a known open issue; it is
dormant because nothing passes a panchayat and none are seeded.

**RLS is not access on its own.** Postgres needs a table-level `GRANT` as well, or every
policy is unreachable and the table reads as "permission denied". Each migration grants
alongside its policies — read where a `select` policy exists, write where an `update` one
does. No table grants `insert`: rows are created by security-definer functions. A new
table with policies but no grant is invisible to the app, and the pgTAP suite is what
catches it.

**Errors never surface raw.** `src/lib/errors.ts` maps every Postgres/GoTrue failure to a
stable `ErrorCode` that resolves to an `errors.*` i18n key. RPCs raise their own machine
strings. PostgREST reads the digits after `PT` in a SQLSTATE as an HTTP status, which is
how `PT429` becomes a 429 — a plain `errcode = 'rate_limited'` is not a valid condition
name and fails at runtime.

**All query keys come from `src/api/keys.ts`.** Keys are hierarchical so a broad
invalidation cascades. Inline key arrays in screens are how invalidation silently breaks.

**The design system is `src/theme/tokens.ts`**, with the palette taken from the Claude
Design export in `design/` (reference only — web React, never imported by `src/`). Screens
use the semantic aliases, never raw palette entries.

Two rules here are enforced rather than trusted, because they are claims about specific
hex values:

- Contrast floors (≥4.5:1 body, ≥3:1 large/icons) in **both** themes — these screens are
  read outdoors at 3,000 m in snow glare. `scripts/check-contrast.py` asserts them.
- Label colour on a filled colour is per-colour, not per-theme. Use `onPrimary`/`onDanger`
  where they exist, `readableOn()` where the colour is chosen at runtime. White is never
  hard-coded: in dark, `primary` and `danger` both lighten, and white on them is 2.77:1
  and 3.46:1.

`textFaint` is below the body floor by design and is for decorative or disabled text only.

**Generated files** — do not hand-edit: `src/lib/database.types.ts` (`npm run db:types`)
and `src/components/icon.tsx` (`python scripts/gen-icons.py`).

## Conventions that are easy to get wrong

- **Custom fonts need the family, not the weight.** React Native does not synthesise
  weight for a bundled face, so `fontWeight: '600'` over a Regular family gives Regular on
  Android and fake-bold on web. Each `type` step names its real DM Sans face; a local
  override must set `fontFamily` too.
- **`react-native-svg` and this `react-native-web` forward unknown props to the DOM.** Use
  `aria-hidden`, not `accessibilityElementsHidden`/`importantForAccessibility`, or React
  warns about unknown attributes.
- **Editing an already-applied migration requires `npm run db:reset`**, then
  `npm run db:types` if it changed a signature.
- **Installing a dependency mid-session needs Metro's cache cleared**, or the next bundle
  fails with `Cannot read properties of undefined (reading 'get')` from
  `metro/src/node-haste/DependencyGraph.js` — which reads like a Metro bug rather than a
  stale cache. Stop the server, delete `node_modules/.cache` and `%TEMP%/metro-*`, restart.
- **Touch targets are ≥44pt (≥56 for emergency actions)** and baked into the primitives
  rather than left to screens. `StatusPill` is the deliberate exception — it carries no
  action, and padding a status to 44 makes it read as a button.
- **Colour is never the only signal** (spec 08.1) — states pair a hue with a glyph, and
  every category is an icon *and* a word (spec 08.6, low-literacy support).
- **The app ships no fake data**, not even in a stub (spec 01.8 #4). `ScreenStub` says
  what is missing rather than inventing content.
- `edge_runtime` is disabled in `supabase/config.toml`: the project has no edge functions,
  and the container segfaults on some hosts, which aborts the whole `supabase start`.
