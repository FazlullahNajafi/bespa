# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

Bespa is a community app for Kargil district, Ladakh — an Expo (SDK 57) React Native app
on Supabase. `spec/` holds the written specification; it is the authority
for product decisions, and files cite it (`spec 08.6`, `spec 02.2`) rather than restating
it. Read the cited section before changing behaviour it governs.

**The target is Android.** iOS and web are not the audience. `npm run web` exists because
it is the fast way to iterate here, not because the browser is a target — say "verified on
web" when that is what happened, because it is evidence, not proof. Three real defects
(tofu tab icons, the keyboard covering the submit button, content drawn under the status
bar) were invisible on web and appeared immediately on a device.

## Environment

**The project lives at `D:\apps\bespa`. Do not move it back under OneDrive.** It was
there, and OneDrive dehydrated `node_modules` into cloud placeholders — 1,183 of 4,000
sampled files. Reading one triggers a download, which made jest fail with
`UNKNOWN: unknown error, read` before a single test could load, and also caused stuck file
locks and slow installs. C: is chronically near-full; D: has room.

**Supabase runs on 553xx, not the 543xx defaults** (55321 api, 55322 db, 55323 studio,
55324 mailpit), set in `supabase/config.toml`. Windows reserves TCP 54271–54570 for WinNAT
on this machine, which covers every default port. The failure is confusing: `supabase
start` aborts after creating containers with no published ports, so `docker ps` shows
everything healthy while nothing on the host can reach it. Check with
`netsh interface ipv4 show excludedportrange protocol=tcp`.

**`supabase start` aborts if `analytics` (Logflare) or `vector` is unhealthy**, and on
the way out it tears down every other container — including the database — so the symptom
is "the whole stack vanished" rather than "one optional service failed". Neither is used
by this app. Start without them:

```bash
npx supabase start -x logflare,vector,supavisor,imgproxy,realtime,storage-api
```

**The Supabase CLI exits 0 when it fails.** It reports the error as a JSON object on
stdout and still returns success, so a backgrounded `supabase start` is announced as
"completed, exit code 0" with the stack in pieces. Check the output, never the exit code.

A failed start can also leave a container holding the name while the CLI believes it is
gone, and the next attempt dies with `Conflict. The container name "/supabase_db_bespa"
is already in use`. `supabase stop --no-backup` clears it.

Docker's engine on this machine wedges regularly, leaving orphaned AF_UNIX sockets that no
file API can delete (error 1920). The fix is to rename the directory, not delete the file:
rename `%LOCALAPPDATA%\Docker\run` and `%LOCALAPPDATA%\docker-secrets-engine`, recreate
them empty, and restart Docker Desktop (a per-user install, at
`%LOCALAPPDATA%\Programs\DockerDesktop`).

## Which backend the app talks to

**`.env` points at the hosted project `oibfmuwjzzbqtybwafxa`.** The local Docker stack is
still fully supported and is what the pgTAP suite and `db:reset` run against; swapping
back is two commented lines in `.env` plus `adb reverse tcp:55321`.

Use the hosted project when the phone has to work on its own — off the cable, off this
laptop, in someone else's hands. Use the local stack for schema work: it resets in
seconds, it costs nothing to destroy, and `supabase db reset` against the hosted project
would drop real users.

The hosted project issues the newer `sb_publishable_…` key rather than a legacy `anon`
JWT. Same privileges and the same env var; it simply is not a JWT, so nothing may try to
decode it. **The `sb_secret_…` key must never enter the repo, `.env`, `eas.json` or the
bundle** — it maps to `service_role` and bypasses every policy.

**`supabase db push --include-seed` seeds only when it also has migrations to push.** Once
the migration history is current it reports "Remote database is up to date" and silently
skips the seeds, so a project can end up with the whole schema and no geography — which
looks like a working app with an empty village picker. Load `supabase/seed/*.sql` through
the dashboard SQL editor in that case; the three files are about 350 lines in total.

## Commands

```bash
npm start                      # Expo dev server
npm run web                    # web only; .claude/launch.json has bespa-web (8082)
                               # and bespa-android (8081)
npm run typecheck              # tsc --noEmit
npm run lint                   # expo lint
npm test                       # jest
npx jest path/to/file.test.ts  # one test file
```

Database — the stack must be running for the app to do anything, since `village_id` gates
every read:

```bash
npm run db:start               # supabase start
npm run db:reset               # re-apply all migrations + seeds; after editing ANY migration
npm run db:types               # regenerate src/lib/database.types.ts from the live DB
npm run db:test                # pgTAP suite in supabase/tests/
```

One pgTAP file directly (`db:test` has no filter):

```bash
docker exec -i supabase_db_bespa psql -U postgres -d postgres -f /dev/stdin < supabase/tests/identity_rls.test.sql
```

Generators and checks. The first four write files that are committed; re-run the generator
rather than editing its output:

```bash
python scripts/check-contrast.py     # asserts spec 08.6 contrast floors against tokens.ts
python scripts/gen-icons.py          # src/components/icon.tsx, from the design export
python scripts/gen-geo-seed.py       # supabase/seed/002_*.sql, from the district spreadsheet
python scripts/geocode-villages.py   # supabase/seed/003_*.sql, hits two geocoding APIs
```

### EAS builds and updates

Project `38b1dd9a-ff70-4697-822c-1031700383b1` on `@y7.hez`; `eas-cli` is installed and
logged in. `eas.json` has three profiles matching the three app variants in
`app.config.ts`, each pinned to its own update channel so a preview build cannot receive a
production update.

```bash
npx eas-cli build --profile development --platform android   # dev client, APK, internal
npx eas-cli build:list --limit 3                             # status
npx eas-cli build:view <id>                                  # detail, including failures
npx eas-cli update --branch development -m "message"         # ship an OTA update
```

`eas env:list` and some other eas-cli subcommands **prompt for the environment** and
fail outright when stdin is not a terminal (`Input is required, but stdin is not
readable`). Pass `--environment development|preview|production` explicitly, and
`--non-interactive` on builds.

**EAS builds the committed git state, not the working tree.** A build started before
`git commit` archives the previous commit — that is how the first attempt failed in 58
seconds, building a tree whose `package.json` lacked `expo-dev-client` while the profile
asked for a dev client. Commit first, then build.

`runtimeVersion` uses the **fingerprint** policy, so the runtime version changes whenever
anything touching the native runtime changes. With `appVersion` it is possible to add a
native module, forget to bump the version, and publish an update to a build that cannot
run it.

The EAS project id is hard-coded in `app.config.ts` rather than read only from the
environment: EAS Build evaluates that file on its own servers, where a local `.env` does
not exist, so an env-only lookup silently drops the `updates` block from every build while
still looking correct locally. It is not a secret.

### Running on the physical Android device

No emulator or system image is installed, so a real phone over USB is the only route.
Expo Go works for anything in the SDK; **a dev-client build is required for native modules
outside it**, which is why Google Sign-In is gated behind one.

```bash
npx expo start --port 8081          # via preview_start, config "bespa-android"
adb reverse tcp:8081  tcp:8081      # Metro
adb reverse tcp:55321 tcp:55321     # ONLY for the local stack; not needed when hosted

# Expo Go:
adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081"

# The dev client (com.bespa.app.dev) — note the different scheme and the url param:
adb shell am start -a android.intent.action.VIEW   -d "bespa://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081"
```

**A dev client opening on a launcher screen is not a fault.** A development build carries
your native code but no bundled JavaScript, so until it is pointed at a running dev server
it shows a launcher that resembles Expo Go. The deep link above is what loads the app;
without the `?url=` parameter it stays on that screen.

`adb reverse` is the trick that matters for the local stack: without it `127.0.0.1` means
the *phone*. **The mappings drop silently** whenever USB hiccups — re-run them before
blaming the app. Pointed at the hosted project only the Metro mapping is needed.

**`preview_start` opens a browser tab at localhost:8081, which makes Metro bundle for
web — and the web bundle fails** on `expo-sqlite`'s `wa-sqlite.wasm`. While that is in
flight the device's request dies with `java.io.IOException: unexpected end of stream`,
which reads like a broken tunnel and is not. Close the browser tab, then relaunch the
deep link.

Reading the screen without eyes on it: `adb shell uiautomator dump /sdcard/ui.xml` then
`cat` it, and `adb shell screencap -p /sdcard/s.png` + `adb pull`. In Git Bash,
`export MSYS_NO_PATHCONV=1` first or `/sdcard/...` is rewritten to a Windows path, and
pull screenshots rather than redirecting `exec-out`, which corrupts the PNG.
`adb shell input text` drops characters on long strings and `@` can jump fields — type in
short pieces and verify between them. `adb shell pm clear host.exp.exponent` is the
practical way back to a signed-out state; there is no sign-out UI yet.

## CI

`.github/workflows/ci.yml`, on push to `main` and on pull requests; green as of the last
push. The app job runs typecheck, lint, jest, the contrast floors, and a check that the
committed `icon.tsx` still matches what its generator produces. The database job starts
Postgres alone (every other service excluded) and runs pgTAP, which also proves the
migrations apply in order to an empty database.

## Architecture

**Tenancy is `profiles.village_id`.** Every village-scoped RLS policy compares against it,
so a session without one can see nothing. Hence the auth gate in `src/app/_layout.tsx` has
*three* states, not two: signed out, signed in without a village, signed in. The middle
state routes to `(onboarding)/pick-village`, and the gate holds its decision while the
profile query is pending, so a returning user is not bounced through onboarding on every
cold start.

**Every mutation goes through the outbox** (`src/lib/outbox/`), **including when online**.
That is spec 10.3's rule and it is the point: an offline path that is a separate branch is
only exercised on a plane, and is broken by the time anyone flies. `submit()` writes to
SQLite first for durability, then drains that row immediately when there is a connection
and returns the real server result; offline it returns `queued`. That shape exists because
some callers need the answer — "you changed village 3 days ago" is something the picker has
to render. Retry policy lives in `outbox/policy.ts`, split out so it can be unit-tested
without the module reaching for SQLite at import time.

**`src/lib/net.ts` is the single connectivity source.** It feeds TanStack's `onlineManager`
and wakes the outbox. Before it existed, `refetchOnReconnect: true` was configured but
inert — on React Native that manager never changes state unless something feeds it.

**Geography is one `geo_units` table**, self-referencing via `parent_id` with an ltree
`path` maintained by trigger (`ladakh.kargil.sankoo.sangrah`). Villages hang off the
**block**, not off a panchayat: the Kargil source spreadsheet lists panchayats and revenue
villages as two independent columns with no mapping between them. Three entries come from
the panchayat column because residents name them as home (Gongma Minjee, Chanigund,
Badgam); the other candidates were spelling variants of villages already seeded, and
seeding those would split one village's directory across two tenancies.

The picker auto-descends any level offering exactly one option, which is why nobody taps
"Ladakh". It never auto-descends a *selectable* level — Pashkum has a single village, and
skipping it would choose the user's village for them.

**RLS is not access on its own.** Postgres needs a table-level `GRANT` as well, or every
policy is unreachable and the table reads as "permission denied". Each migration grants
alongside its policies — read where a `select` policy exists, write where an `update` one
does. No table grants `insert`: rows are created by security-definer functions. A new
table with policies but no grant is invisible to the app, and pgTAP is what catches it.

**A policy constrains the row; only a GRANT constrains the column.** `grant update on
profiles` behind a `using (id = auth.uid())` policy reads as "a user may edit their own
profile" and in fact permits `update profiles set roles = '{super_admin}'` — the row is
still their own. That was live until migration `20261019120000`, together with
self-writable `village_id` (walking past `set_my_village`'s 30-day limit and its audit
log) and `phone_verified` (which `is_phone_verified()` gates posting on). UPDATE is now
granted per column on the three identity tables, and `supabase/tests/profile_privacy.test.sql`
asserts each refusal. SELECT stays table-wide deliberately: a column-level SELECT grant
makes `select *` fail outright, which through PostgREST is a trap. **Any new user-writable
table needs the same treatment** — grant the columns a user may write and put the rest
behind a definer function.

**Errors never surface raw.** `src/lib/errors.ts` maps every Postgres/GoTrue failure to a
stable `ErrorCode` resolving to an `errors.*` i18n key. PostgREST reads the digits after
`PT` in a SQLSTATE as an HTTP status, which is how `PT429` becomes a 429 — a plain
`errcode = 'rate_limited'` is not a valid condition name and fails at runtime.

**All query keys come from `src/api/keys.ts`.** Keys are hierarchical so a broad
invalidation cascades. Inline key arrays are how invalidation silently breaks.

**Weather** (`src/api/weather.ts`) calls Open-Meteo directly. No proxy, because there is no
API key to protect — which also sidesteps edge functions being disabled. Spec 03.1 is
strict: the card is **hidden entirely on failure, never an error**, so every failure path
resolves to "no data" and the component returns null. It is never restored from disk; a
week-old temperature shown as current is worse than none. Coordinates come from
`my_weather_point()`, which falls back to the block when a village has no centroid — only
79 of 129 resolved, because geocoders cover small Ladakhi hamlets badly and anything
outside a Kargil bounding box is rejected rather than trusted.

**Onboarding is two gated steps, not one.** `profiles.village_id` routes to the picker;
`profiles.privacy_reviewed_at` then routes to `(onboarding)/privacy`, because spec 03.4
requires the privacy settings on a dedicated screen rather than buried in Settings — the
defaults publish a new profile to the whole village, phone number included. The flag
lives on `profiles` rather than on `privacy_settings` so the gate still costs one query
at cold start, and only `set_my_privacy` can stamp it. Offline, the privacy step marks
itself reviewed in the cache so a user is not held behind a screen they have already
answered; that is safe only because the row's current values are already in force and the
user's deltas are more restrictive, not less.

**Your own phone number is never persisted to disk.** `useMyPrivate` sets
`meta: { persist: false }`, so it is absent on an offline cold start while the rest of the
profile renders from cache. The query cache is AsyncStorage — unencrypted — and phones
are shared here, which is the same reason the session is in SecureStore. Spec 10.5's
Phase 0 exit criterion reads "reopens offline and still sees their profile"; the name,
occupation, village and member-since satisfy that, and the number deliberately does not.

**The design system is `src/theme/tokens.ts`** — the palette is the Claude Design export's
Suru Dawn (light) and Twilight (dark), in `design/` (reference only; web React, never
imported by `src/`). Screens use the semantic aliases, never raw palette entries.

Two rules are enforced rather than trusted, because they are claims about specific hex
values:

- Contrast floors (≥4.5:1 body, ≥3:1 large/icons) in **both** themes — these screens are
  read outdoors at 3,000 m in snow glare. `scripts/check-contrast.py` asserts 24 rules.
- Label colour on a filled colour is per-colour, not per-theme. Use `onPrimary`/`onDanger`
  where they exist, `readableOn()` where the colour is chosen at runtime. White is never
  hard-coded: in dark, `primary` and `danger` both lighten, and white on them is 2.77:1
  and 3.46:1.

`textFaint` is below the body floor by design — decorative and disabled text only.

**Generated files — do not hand-edit.** `src/lib/database.types.ts` (`npm run db:types`),
`src/components/icon.tsx` (`gen-icons.py`), and the geo seeds `002`/`003`
(`gen-geo-seed.py`, `geocode-villages.py`).

## Conventions that are easy to get wrong

- **Custom fonts need the family, not the weight.** React Native does not synthesise weight
  for a bundled face, so `fontWeight: '600'` over a Regular family gives Regular on Android
  and fake-bold on web. Each `type` step names its real DM Sans face; a local override must
  set `fontFamily` too.
- **Expo draws edge-to-edge since SDK 54, and Android 15 enforces it.** The window no
  longer resizes for the keyboard, and the system bars sit *on* the content. `Screen`
  handles three things — a top safe-area inset, `behavior="padding"` on every platform,
  and an opaque band painted behind the status bar so scrolling content disappears under
  it instead of colliding with the clock. Android 15 no longer allows a solid status-bar
  colour, which is why the app draws its own. Anything bypassing `Screen` must do the same.
- **A navigator's own chrome pays its own insets.** The tab bar is not inside `Screen`,
  so it got none: its labels ended at y=1544 on the test device and the navigation bar
  begins at exactly y=1544, leaving them flush against the back/home/recents buttons (and
  under the pill on a gesture-nav phone). `tabBarStyle` now adds `insets.bottom` to both
  `height` and `paddingBottom` — height as well, or the padding just squeezes the icon
  and label instead of growing the bar. Verify with
  `adb shell dumpsys window windows | grep -A8 NavigationBar0` for the real frame, and
  `uiautomator dump` for where the labels actually land.
- **`react-native-svg` and `react-native-web` forward unknown props to the DOM.** Use
  `aria-hidden`, not `accessibilityElementsHidden`/`importantForAccessibility`.
- **Installing a dependency mid-session needs Metro's cache cleared**, or the next bundle
  fails with `Cannot read properties of undefined (reading 'get')` from
  `metro/src/node-haste/DependencyGraph.js` — which reads like a Metro bug. Stop the
  server, delete `node_modules/.cache` and `%TEMP%/metro-*`, restart.
- **Editing an already-applied migration requires `npm run db:reset`**, then
  `npm run db:types` if it changed a signature.
- **The persisted query cache hides server-side changes.** The profile query has a
  five-minute staleTime and is persisted for a week, so changing `village_id` in the
  database does not reach a running app. Clear app data rather than waiting.
- **Touch targets are ≥44pt (≥56 for emergency actions)**, baked into the primitives.
  `StatusPill` is the deliberate exception — it carries no action, and padding a status to
  44 makes it read as a button.
- **Colour is never the only signal** (spec 08.1): states pair a hue with a glyph, and
  every category is an icon *and* a word (spec 08.6, low-literacy support).
- **The app ships no fake data**, not even in a stub (spec 01.8 #4). Home shows a greeting
  and tiles because those are real; the design's weather badges and activity feed are
  absent because no table backs them.
- `edge_runtime` is disabled in `supabase/config.toml`: there are no edge functions, and
  the container segfaults on this host, aborting the whole `supabase start`.

## Open issues

- **`set_my_village` validates `panchayat.parent_id = village`, which is backwards.** A
  panchayat contains villages. It is dormant — nothing passes a panchayat and none are
  seeded — but `panchayat_admin` scoping cannot work until a real panchayat→village source
  exists. Do not infer the mapping from row adjacency.
- **Google is enabled locally but NOT on the hosted project.** Verified 2026-10-20:
  `/auth/v1/settings` reports `google: true` against 127.0.0.1 and `google: false`
  against `oibfmuwjzzbqtybwafxa`, and sign-in on the device fails with the generic
  `errors.unknown`. The hosted dashboard's Google form will not save with the toggle on
  unless a **client secret** is supplied, even though the ID-token flow never uses one —
  safelisting the client id alone is not enough. That settings endpoint is the fast way
  to tell a real provider failure from a configuration one; it needs only the
  publishable key.
- **Google sign-in works locally** (verified on device 2026-10-19: a `google` identity reaches
  `auth.identities` and the gate routes the new account to the picker). Firebase project
  `bespa-b215b` provisioned the clients; Firebase Auth itself is unused. The library is
  given the **web** client id — that is the ID token's audience and what Supabase
  verifies — while the Android client only makes Google willing to issue the token. The
  client secret in `config.toml` is a placeholder: a secret authenticates the web redirect
  exchange, which this flow never performs. `.preview` and production each need their own
  Firebase Android app and SHA-1, and production needs the Play App Signing fingerprint.
- **Phone-OTP is intended as the primary sign-in** but needs an SMS provider and India DLT
  registration, neither of which exists. Email/password is the working path. The flow can
  be built and tested locally with `[auth.sms.test_otp]`, a fixed phone→code map.
  Meanwhile profile edit **saves a number unverified**, against spec 03.6 — it is what the
  privacy step's phone setting is about, and half the Phase 0 exit criterion. It is
  labelled "Not verified" everywhere it appears, a trigger clears the flag on any change,
  and `is_phone_verified()` still refuses everything it gates.
- **Sentry is OFF in a development build**, by `enabled: !__DEV__ || debug` — and
  `__DEV__` is true whenever the app is attached to Metro. So a dev build reports nothing
  unless `EXPO_PUBLIC_SENTRY_DEBUG=1` is set, which also turns on the SDK's own logging.
  That is deliberate (a dev crash is already on the console, and sending it spends the
  free tier on noise) but it means **the first build that actually reports anything is
  `preview`**, where `__DEV__` is false.
  Build `bd613aba` (2026-10-20, commit 78b4841) is the first dev client containing the
  native SDK; before it, logcat said `RNSentry module not found` / `Native Sentry SDK is
  disabled`, so Java/Kotlin crashes and ANRs went unreported while JS errors did not.
  `tracesSampleRate: 0` is confirmed working from the discard lines.
- **Sentry's remaining setup.** DSN, `SENTRY_ORG=najafi-cm` and `SENTRY_PROJECT=bespa`
  are in `.env`, so the config plugin is active locally. `SENTRY_AUTH_TOKEN` is in
  `.env.local` and is **not** on EAS — `eas env:list --environment development` returns
  "No variables found", so build `bd613aba` uploaded no source maps. That costs nothing
  for a dev build (JS comes from Metro already mapped) and a great deal for preview and
  production, where the bundle is minified and every frame reads
  `index.android.bundle:1:284513`. Add it before those builds:
  `eas env:create --name SENTRY_AUTH_TOKEN --scope project --visibility sensitive`.
  `npx expo install --check` reports `@sentry/react-native@8.31.0` as wrong and wants
  `~7.11.0`. **Do not downgrade.** Expo's `bundledNativeModules.json` lags; 8.25 is the
  release that fixed silently dropped spans on React Native >= 0.86, which is this
  project.
