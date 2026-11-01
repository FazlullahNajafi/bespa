# What is in this repository

Orientation for someone opening `D:\apps\bespa` for the first time: every directory, what
each file carries, what has actually been built and proved, and what the next four phases
hold.

Three documents sit beside this one and are not repeated here. `spec/` settles product
decisions and wins wherever it disagrees with this page. `CLAUDE.md` holds the environment
— ports, Docker, EAS, the device, and the traps each of those has already sprung.
`docs/running-on-the-phone.md` is the step-by-step runbook for getting a build onto the
handset.

---

## The spine

Six decisions that every other file depends on. Each has a failure mode that stays
invisible until it is expensive.

**Tenancy is `profiles.village_id`.** Every village-scoped RLS policy compares against it,
so a session without one can see nothing. The auth gate in `src/app/_layout.tsx` therefore
has four states, not two: signed out, signed in without a village, signed in without a
privacy review, signed in. It holds its decision while the profile query is pending, so a
returning user is not bounced through onboarding on every cold start.

**Every mutation goes through the outbox, including when online** (spec 10.3). An offline
path that is a separate branch is only exercised on a plane, and is broken by the time
anyone flies. `submit()` writes to SQLite first for durability, then drains that row
immediately when there is a connection and returns the real server result; offline it
returns `queued`.

**RLS is not access on its own, and a policy constrains the row while only a GRANT
constrains the column.** Postgres needs a table-level grant as well, or every policy is
unreachable and the table reads as "permission denied". And `grant update on profiles`
behind a `using (id = auth.uid())` policy reads as "a user may edit their own profile"
while in fact permitting `update profiles set roles = '{super_admin}'`. UPDATE is granted
per column on the three identity tables; no table grants `insert`, because rows are
created by security-definer functions.

**All query keys come from `src/api/keys.ts`.** Keys are hierarchical so a broad
invalidation cascades. Inline key arrays are how invalidation silently breaks: one caller
writes `['places', id]`, another `['place', id]`, and a mutation invalidates neither.

**Errors never surface raw.** `src/lib/errors.ts` maps every Postgres and GoTrue failure
to a stable `ErrorCode` resolving to an `errors.*` i18n key. A raw Postgres message
reaching a user is a bug with a test.

**Geography is one `geo_units` table**, self-referencing via `parent_id` with an ltree
`path` maintained by trigger, so ancestor tests are index-backed operators rather than
recursive CTEs. Villages hang off the **block**, not a panchayat: the district spreadsheet
lists the two as independent columns with no mapping between them. The Kargil region is
**four districts** since the 2026 reorganisation — Kargil, Drass, Sankoo, Zanskar — and
the blocks and villages did not move, only which district each block hangs under.

One more, smaller: `src/lib/net.ts` is the single connectivity source. It feeds TanStack's
`onlineManager` and wakes the outbox. Before it existed, `refetchOnReconnect: true` was
configured but inert — on React Native that manager never changes state unless something
feeds it.

---

## `src/app/` — the routes

expo-router: a folder is a URL, and a group in brackets is a layout that adds no segment.

| File | What it is |
|---|---|
| `_layout.tsx` | **The auth gate, and the app's root.** Fonts, the persisted query client, the session store, Sentry, push registration, then the four-state routing decision. The most consequential file in the app. |
| `(auth)/sign-in.tsx` | Email and password, with "Continue with Google" above it carrying the real four-colour mark. |
| `(auth)/sign-up.tsx` | Leads with Google; the email path no longer dead-ends on an unconfirmed address. |
| `(onboarding)/pick-village.tsx` | The cascading geo picker. Auto-descends any level offering exactly one option — which is why nobody taps "Ladakh" — but never a *selectable* level. Offers "use my location" over the four-tap walk. |
| `(onboarding)/occupation.tsx` | "Tell us about you" as a tile grid, with a Skip. Asked, not required; the directory would otherwise be a list of names. |
| `(onboarding)/privacy.tsx` | The privacy step on its own screen (spec 03.4), because the defaults publish a new profile to the whole village, phone number included. |
| `(tabs)/_layout.tsx` | The five tabs of the brief. Adds `insets.bottom` to tab-bar *height* as well as padding — height too, or the padding just squeezes the icon — and announces itself through `BottomChromeProvider`. |
| `(tabs)/index.tsx` | Home: greeting, weather card, four quick-access tiles, latest notices. |
| `(tabs)/profile.tsx` | The user's own profile, with language, privacy and edit rows. |
| `(tabs)/transport.tsx`, `calendar.tsx`, `services.tsx` | Six lines each — `ScreenStub`, naming the phase that will build them. |
| `notices/index.tsx`, `notices/[id].tsx` | The list and one notice, with the document link and the share text. |
| `directory/index.tsx` | The member list, search, panchayat contact cards, and the reveal-one-number flow. |
| `profile/edit.tsx`, `profile/privacy.tsx` | Full-screen tasks with a Save, deliberately outside `(tabs)` so a stray tab tap cannot abandon unsaved edits. |

Every group sets `headerShown: false`: `Screen` pays the status-bar inset itself, and a
native header would pay it a second time.

---

## `src/api/` — one module per domain

Screens never import `supabase` directly. Every read and write goes through here, and
these modules return TanStack hooks or a discriminated result.

| File | What it is |
|---|---|
| `keys.ts` | The single query-key factory. |
| `auth.ts` | Sign-up, sign-in, sign-out, returning a result rather than throwing — a wrong password is an expected outcome of a form, not an exception. |
| `google.ts` | Native Google sign-in through Supabase's ID-token flow. The library gets the **web** client id, because that is the token's audience. |
| `profile.ts` | The profile, the private row, privacy flags, occupation. `useMyPrivate` sets `meta: { persist: false }` so a phone number never reaches disk. |
| `geo.ts` | The picker's children query, the nearest-place lookup, and `set_my_village` through the outbox. |
| `notices.ts` | One query with no village parameter to get wrong — RLS does the scoping, so a reader gets their village's notices and the district-wide ones in the same list. |
| `directory.ts` | Two queries and one deliberate non-query: the list comes from a view with no phone column at all. |
| `weather.ts` | Open-Meteo, called directly — no proxy, because there is no key to protect. Every failure path resolves to "no data" and the card returns null. |

---

## `src/lib/` — the machinery

| File | What it is |
|---|---|
| `supabase.ts` | The client, plus a **chunked SecureStore** session adapter: a session blob exceeds SecureStore's per-item limit, and phones are shared here, so AsyncStorage in the clear is the wrong default. |
| `database.types.ts` | Generated by `npm run db:types`, committed, and checked in CI. |
| `queryClient.ts` | TanStack Query with an AsyncStorage persister, 7-day TTL, hydrated before first render, with a per-query `meta.persist` opt-out. |
| `net.ts` | The single connectivity source. |
| `outbox/index.ts` | `submit()`, handler registration, the drain loop, idempotency keys. |
| `outbox/db.ts` | The SQLite table. SQLite rather than AsyncStorage because this is a queue with ordering and partial failure — a half-written JSON blob loses every pending write at once. |
| `outbox/policy.ts` | Backoff and give-up decisions, split out so they can be tested without the module reaching for SQLite at import time. One direction retries a refusal forever; the other throws away work. |
| `errors.ts` | Postgres/GoTrue to `ErrorCode` to i18n key. PostgREST reads the digits after `PT` in a SQLSTATE as an HTTP status, which is how `PT429` becomes a 429. |
| `push.ts` | Device registration, written before anything sent a notification. Survives reinstall, sign-out, and a handset changing hands. |
| `sentry.ts` | Crash reporting, off in a development build by design — a dev crash is already on the console. |
| `location.ts` | One coordinate, once, for the picker's shortcut. Nothing is stored; the fix becomes a village *proposal* and is dropped. |
| `phone.ts` | Stored as E.164, typed without the country code. A number outside India cannot be entered — the right trade for one district of one country. |
| `notice-share.ts` | The forwarded WhatsApp message, which is the app's real front door. Title first and bold, because a group list shows only two lines. |
| `notice-actions.ts` | Open the document, or pass it on. Neither throws: a share sheet the reader backs out of is not an error worth a banner. |
| `relative-date.ts` | "2 days ago" in calendar days, hand-rolled because Hermes ships a reduced ICU. Returns an i18n key and its values, not a string. |
| `format-date.ts` | The month is always named: `7/12/2026` is two different dates, and some notices carry legally meaningful objection windows. |
| `occupations.ts` | Stable keys rather than display text, so a profile written in English still reads in Urdu. The column stays `text` because the list ends with "other + free text". |

`phone`, `occupations`, `relative-date`, `notice-share` and `outbox/policy` each have a
`.test.ts` beside them. Those five are where a subtly wrong answer is expensive and cheap
to pin down.

---

## `src/components/` — the primitives

Spec 08's set, about twenty files. No UI kit, on purpose: accessibility, RTL and 200% font
scaling are far easier to guarantee when we own the primitives.

| File | What it is |
|---|---|
| `screen.tsx` | **Three jobs, all Android.** The top safe-area inset, `behavior="padding"` for the keyboard on every platform, and an opaque band painted behind the status bar, because Android 15 no longer allows a solid status-bar colour. Also owns the rule that the bottom inset has exactly one payer per screen. |
| `icon.tsx` | The design's line-icon set ported to react-native-svg by `gen-icons.py`. Path data degrades when retyped, so it is copied mechanically. |
| `button.tsx` | Four variants with the 44pt minimum baked in, labelled from `onPrimary`/`onDanger` rather than hard-coded white. |
| `text-field.tsx` | Label, hint, error, and a fixed prefix slot for the `+91` nobody should have to type. |
| `status-pill.tsx` | Each tone pairs a hue with a glyph (spec 08.1). The deliberate exception to the 44pt rule: it carries no action. |
| `pending-chip.tsx` | Unsent work, bound to the outbox's own subscription and tappable to force a drain. |
| `notice-card.tsx` | Category glyph and word, relative date, source attribution, open and share. Appears on Home and in the list. |
| `weather-card.tsx` | Hidden entirely on failure, never an error, and never restored from disk — a week-old temperature shown as current is worse than none. |
| `privacy-form.tsx` | The per-field controls, shared by the onboarding step and the settings screen. |
| `google-mark.tsx` | Google's "G", kept out of `icon.tsx` because every glyph there takes the theme's colour and this is a trademark that must not. |
| `avatar`, `card`, `chip`, `banner`, `list-row`, `empty-state`, `stepper`, `back-link`, `screen-stub` | The rest. `card` refuses a second elevation when nested; `back-link` lives in the content rather than a native header. |

---

## `src/theme/`, `src/i18n/`, `src/store/`, `src/features/`

| File | What it is |
|---|---|
| `theme/tokens.ts` | The design system: Suru Dawn (light) and Twilight (dark), with every deviation documented as the contrast failure that forced it. Screens use the semantic aliases, never raw palette entries. `textFaint` is below the body floor by design. |
| `theme/use-scheme.ts` | Normalises React Native's `'unspecified'` and `null` to light, once, so `Scheme` stays a closed two-value union. |
| `i18n/index.ts` | i18next with `en` complete, `ur` and `bft` declared, and `I18nManager` RTL wired from day one — it needs an app reload, so the prompt had to exist before forty screens did. |
| `i18n/en.json` | Every string, including the `errors.*` keys `errors.ts` resolves to. |
| `store/session.ts` | Zustand. Holds the session and a `ready` flag that stays false until SecureStore has been read, which is what stops a cold start flashing the sign-in screen. |
| `features/auth/validate.ts` | Form rules as pure functions returning i18n keys. Dependency-free: two forms with three fields do not justify react-hook-form plus zod. |

---

## `supabase/`

`migrations/` is the only source of truth for the schema. Nothing is clicked in a
dashboard, and an already-applied migration is never edited without a `npm run db:reset`.

| Migration | What it settles |
|---|---|
| `…_extensions` | pgcrypto, ltree, postgis into the `extensions` schema. `pg_cron` deliberately not enabled until Phase 3 needs it. |
| `…_enums` | The executable copy of spec 06.1. Adding a value later cannot run in a transaction, so it gets its own migration. |
| `…_geo_units` | The tenancy spine: the adjacency list, the materialised ltree path, the repath trigger. |
| `…_identity` | `profiles`, `profile_private`, `privacy_settings`, `contact_access_log`, and the `shares_my_village()` / `has_role()` helpers every later policy is built on. Documents the one deviation from spec 06.10: sensitive columns moved to their own table rather than revoking SELECT. |
| `…_geo_rpcs` | `geo_children`, `set_my_village` with its 30-day limit and audit log, `my_village_path`. |
| `…_weather_point` | `my_weather_point()`, which falls back to the block when a village has no centroid and says which happened, so the card can name the place honestly. |
| `…_profile_privacy` | **A privilege-escalation fix.** Narrows UPDATE to the columns a user may write, adds `privacy_reviewed_at`, adds `set_my_privacy`. |
| `…_root_slug_unique` | A unique constraint treats NULLs as distinct, so the geography root was unconstrained — and running the seed twice doubled the whole tree: 2 districts, 30 blocks, 258 villages. |
| `…_devices_notifications` | The device registry and in-app inbox, built before the feature that would send anything. |
| `…_notices` | One table carries both a village notice and a mirrored official one; three CHECK constraints make sure neither shape can be written wrong. |
| `…_notice_source_attribution` | Corrects LAHDC to the District Administration. Attributing a government notice to the wrong institution is what would make an unsponsored index indefensible. |
| `…_geo_nearest` | Coordinate to the chain from root to best match, so the picker's four-tap walk collapses into one round trip. A village is accepted only when it is genuinely close. |
| `…_occupation_step` | `set_my_occupation` and the `occupation_asked_at` gate flag, on `profiles` so routing still costs one query. |
| `…_kargil_town` | The district headquarters had no row, because it is not a revenue village — so the largest settlement in Kargil was unpickable. |
| `…_geo_nearest_block_fallback` | With no village inside the distance cap, a village 9 km away could still beat the block you are standing in. Found by a test asserting the intended behaviour rather than the shipped one. |
| `…_notice_push` | The three service-role functions behind the daily announce job. The queue hands out push tokens, so nothing here may widen their visibility. |
| `…_directory` | `village_contacts`, `get_member_contact` with its rate limit and audit write, and `publish_village_contact`. |
| `…_geo_district_split` | Kargil's fifteen blocks regrouped into the four districts of the 2026 reorganisation — and a fix for the repath trigger, declared `after update OF path` and so never firing for a re-parent, which names `parent_id` instead. |

`seed/` is real Kargil geography: 001 hand-written and stopping at block level on purpose,
002 generated from the district's revenue-village spreadsheet (129 places across 15
blocks), 003 generated by the geocoder (79 of 129 resolved), 004 Kargil town, 005 the
2026 district split. The last two are declared twice, here and as migrations: migrations
run before seeds, so on a fresh database the migration finds nothing to change and the
seed does the work, while on a project seeded months ago the seeds never run again and the
migration is the only thing that reaches it.

`tests/` is pgTAP, one file per policy family, and every family gets both an allow and a
deny assertion. The deny half is the point: a policy that grants correctly but fails to
refuse is invisible to manual testing. `identity_rls`, `profile_privacy` and `directory`
cover the privacy model; `notices`, `notice_push` and `devices` cover who is told what;
`onboarding` and `geo_idempotent` cover the gates and the seed.

---

## `scripts/`

Python. The first four write files that are committed — re-run the generator rather than
editing its output.

| Script | What it does |
|---|---|
| `check-contrast.py` | Asserts 24 contrast rules against the real hex values in `tokens.ts`, in both themes, and exits non-zero. These screens are read outdoors at 3,000 m in snow glare, so it is checked rather than claimed in a comment. Runs in CI. |
| `gen-icons.py` | The design's inline SVG to `src/components/icon.tsx`. CI checks the committed file still matches. |
| `gen-geo-seed.py` | The district spreadsheet to seed 002. Block boundaries come from the Sr. No. columns restarting at 1, not from the block label, which is sometimes typed a couple of rows late. |
| `geocode-villages.py` | Two geocoding APIs to seed 003, with two gates every candidate must clear. |
| `import-notices.py` | Mirrors `kargil.nic.in` as an *index*, not a republication: titles and dates copied exactly, always linking to the original, never paraphrased. It never deletes. |
| `send-notice-push.py` | Announces pending notices to the phones they are for. The scoping lives in the database, not here — two copies of a visibility rule is how they drift. |
| `reset-project.js` | Left over from the Expo template. Safe to delete. |

---

## Everything else

| Path | What it is |
|---|---|
| `spec/` | Eleven documents, read in order; `spec/README.md` says which settles what. The authority for product decisions. |
| `design/` | The Claude Design export. Web React, reference only — read and translated, never imported by `src/`, never bundled. |
| `app.config.ts` | Three variants side by side on one device, each with its own package, scheme and update channel. The EAS project id and Sentry slugs are hard-coded because EAS evaluates this file on its own servers, where `.env` does not exist. |
| `eas.json` | Three build profiles, each pinned to its own channel so a preview build cannot receive a production update. |
| `metro.config.js` | Sentry's wrapper, which emits the Debug ID that matches a minified frame back to a line of TypeScript. |
| `google-services.json` | One file, every registered package. A variant needs its Firebase client *before* its first build — Gradle fails outright on a package it cannot find. |
| `supabase/config.toml` | Local stack config on ports 553xx, with logflare, vector and `edge_runtime` disabled. Never `config push` it: the Google secret here is a placeholder. |
| `.github/workflows/ci.yml` | Two jobs. App: typecheck, lint, jest, the contrast floors, the icon-generator check. Database: Postgres alone, pgTAP, which also proves the migrations apply in order to an empty database. |
| `.github/workflows/daily.yml` | 02:30 UTC, which is 08:00 in Kargil. Imports notices, pushes them, and touches the project so a free Supabase instance does not pause. `dry_run` input for testing by hand. |
| `.claude/launch.json` | Two dev-server configs: `bespa-web` on 8082, `bespa-android` on 8081. |

---

## Where the work has got to

Phase 0's spine is complete and most of its exit criterion is met. Phase 1 started out of
order — notices first, because the district mirror is useful at zero local participation
(spec 09.3 risk 1b).

| | State | How we know |
|---|---|---|
| Email + password auth | Done | The working path. The hosted project has `mailer_autoconfirm` on, so sign-up completes with no confirmation link, deliberately. |
| Google sign-in | Done | Verified on device 2026-10-19: a `google` identity reaches `auth.identities` and the gate routes the new account to the picker. |
| Phone OTP | **Blocked** | Needs an SMS provider and India DLT registration, neither of which exists. Profile edit saves a number *unverified*, labelled "Not verified" everywhere, with a trigger clearing the flag on any change. |
| Geography and the picker | Done | 129 villages, 15 blocks, Kargil town, 79 centroids. Idempotence proved by pgTAP. |
| Onboarding, three gated steps | Done | Village, occupation, privacy — each gated on its own column, stamped only by a definer function. |
| Privacy model | Done | Per-column UPDATE grants, a closed privilege escalation, and a pgTAP file asserting each refusal. Your own phone number is never persisted to disk. |
| The outbox | Done | Verified on device, `PendingChip` mounted, retry policy unit-tested. |
| Offline cache | Done | A profile renders offline on a cold start; the phone number deliberately does not. |
| Notices — reading | Done | List, detail, document link, share text, and the card on Home. The mirror imports daily and never deletes. |
| Notices — announcing | Done | Push registration, the fan-out queue, and the daily sender. |
| Notices — composing | Not built | `publish_notice` exists in the database; there is no composer screen, so a village notice cannot be written from the app. |
| Village directory | Done | Migration, API module, screen, and 16 pgTAP assertions. The contact reveal is rate-limited and audited where the subject can read it. |
| Weather | Done | For the user's own village, hidden entirely on failure. Formally out of v1 scope. |
| Design system | Done | Tokens in both themes with 24 contrast rules asserted in CI, about twenty primitives, the icon set generated. |
| i18n | Partial | `en` complete; `ur` and `bft` declared and RTL wired, but no strings yet. |
| Builds and OTA | Done | Three EAS profiles, dev client and preview both building, fingerprint runtime policy, first update published 2026-10-20 to `preview`. |
| Crash reporting | Done | Sentry on from `preview` upward, off in dev by design. Source-map upload verified on build `95bf076f`. |
| Android chrome | Done | Edge-to-edge handled in one place: the status-bar band, keyboard avoidance, and exactly one payer for the bottom inset. |
| CI | Done | Two jobs on every push and PR, including pgTAP against a fresh database. |
| Transport, Calendar, Services | Phase 2–3 | Three stubs naming the phase that will build them. Nothing invented in the meantime. |

---

## What is next

The phasing is spec 09.1's, with Civic before Transport: it is lower-risk, and it builds
the admin relationships that driver recruitment will need.

**Finish Phase 1 — Village.** The notice composer and the moderation queue. Places, from
submit through moderate and browse to map, with the 150 m duplicate check. The gallery
with admin banner selection. Village profile and stats under the source-and-year rule.
Home's remaining sections, each independently empty-able. Spike first: the image pipeline
on 2G, measured with a real 4 MB photo.
*Exit:* three pilot villages populated with real content by real admins, with no developer
touching the database, and Home cold-starting to first paint under 4s on a 2 GB Android.

**Phase 2 — Civic.** The dual calendar and `hijri.ts` — a tabular implementation in-repo,
about 60 lines, unit-tested against dates a local scholar supplies, because this is risk
#3 and owning it is cheaper than auditing a dependency. The `hijri_offsets` admin control
with its audit trail. Helplines bundled in the binary *and* served live, newer copy
winning. `submit_issue` with duplicate detection, the triage queue, WhatsApp forwarding,
the timeline, the public board.
*Exit:* ten real issues forwarded and three closed with a department response, and a local
scholar signing off on the Hijri dates for this month and next.

**Phase 3 — Transport**, the long pole. Routes, stands, driver onboarding and
verification, vehicles, seat layouts as data, trip creation under 45 seconds, the SVG seat
map with its four states, hold/book/release/cancel against Realtime, the live stand board
with presence and soft claims, ratings, the QR payment screen, trust and safety. Spike
first: the persistent driver notification, two interactive actions mutating server state
from a locked screen.
*Exit:* 20 verified drivers on the Kargil–Baroo corridor, 100 completed seat claims, zero
double-bookings in production, and a seat greying out on a second device within a second.

**Phase 4 — Hardening and launch.** Performance on a 2 GB Android over 3G, a full offline
pass in aeroplane mode, the TalkBack audit on the five critical paths, Urdu localisation
and the RTL layout audit, the privacy policy and Play data-safety declarations, account
deletion, closed beta, release.
*Exit:* 99.5% crash-free sessions across the beta, every spec 1.7 metric instrumented.

Then v1.5 in demand order (trip GPS tracking, notice attachments, saved routes, admin
analytics, Purgi strings) and v2 gated on things outside the code: Marketplace, the
retrieval-grounded Purgi chatbot, and NREGA tracking only once a data-sharing arrangement
with the district exists. v1 monetises nothing.

---

## What blocks it

The two things that slip this schedule are not code: SMS approval and driver recruitment.
Both have to start weeks before the code that depends on them.

- **SMS and DLT registration.** Entity, header and template approval, typically one to
  three weeks. Phone verification is half the Phase 0 exit criterion and the one hard
  per-user cost. The flow can be built and tested locally against `[auth.sms.test_otp]`
  meanwhile.
- **No institutional backing** (answered 2026-10-20). Three consequences, all now in the
  code: official notices are an unofficial *index*; the mirror has a kill switch readable
  at query time, `notice_sources.enabled`, so it can be turned off in minutes without a
  release; and the realistic route to backing is one elected LAHDC councillor, not the
  council as an institution.
- **`set_my_village` validates parentage backwards.** It checks
  `panchayat.parent_id = village`, but a panchayat contains villages. Dormant — nothing
  passes a panchayat and none are seeded — but `panchayat_admin` scoping cannot work until
  a real panchayat-to-village source exists. Do not infer the mapping from row adjacency.
- **Four decisions with long lead times.** Which three pilot villages. Village stats
  provenance: Census 2011 labelled as such, or fresh figures collected with the panchayat.
  Purgi orthography, settled before any Purgi string is written. And whether the taxi
  union verifies drivers, which would solve verification and cold start at once.

The two cold starts are the top-ranked risks, and both are answered the same way: ship
something useful at zero local participation — the district notice mirror, and a callable
driver directory — and never fake supply.
