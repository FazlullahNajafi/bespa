# 02 — Architecture

## 2.1 Stack

| Layer | Choice | Why |
|---|---|---|
| App | React Native via **Expo SDK (managed, prebuild for native modules)** | One codebase, OTA updates via EAS Update — critical when users are on slow connections and won't re-download an APK |
| Navigation | `expo-router` (file-based) | Deep links for free: `bespa://trip/:id`, shareable notice links |
| State — server | **TanStack Query** | Cache-first reads, background refetch, offline persistence via `AsyncStorage` persister |
| State — client | **Zustand** | Small: session, active geo unit, draft forms |
| Backend | **Supabase** — Postgres 15+, Auth, Storage, Realtime, Edge Functions (Deno) | RLS maps directly onto "my data is visible to my villagers"; Realtime gives live seat maps without polling |
| Auth | Supabase Auth: email/password (JWT) + Google OAuth + phone OTP verification | Matches requirement for both custom JWT and social login |
| Push | `expo-notifications` + Expo Push Service, fanned out from an Edge Function | |
| Maps | `react-native-maps` (Google provider) with **offline static fallback** | Village map may just be a stored image + pins when tiles won't load |
| Images | `expo-image-picker` → client-side resize → Supabase Storage; served through the image transform CDN | Uploads must survive 2G: resize to ≤1600px, ~70% quality, before upload |
| i18n | `i18next` + `expo-localization`, ICU plurals | en / ur / bft(Purgi) resource bundles |
| Errors | Sentry (`sentry-expo`) | |
| Analytics | PostHog (self-hostable, no PII by policy) | |
| CI/CD | EAS Build + EAS Update, GitHub Actions for lint/test/typecheck | |

**Why Supabase over Firebase here:** the geo hierarchy needs recursive/ancestor queries and
the privacy model needs row-level rules keyed on *the viewer's village vs. the row's
village*. That is a two-line Postgres policy and a painful set of Firestore rules plus
denormalisation. Seat booking also needs a real transaction — see [§4.6](04-module-transport.md).

## 2.2 The geo hierarchy — the spine of the app

Everything hangs off one self-referencing table, `geo_units`:

```
UT (Ladakh)
└── District (Kargil)
    └── Block (Sankoo, Drass, Shakar-Chiktan, Taisuru, Kargil, Zanskar …)
        ├── Village (Minjee, Trespone, Baroo …)
        │     └── Panchayat / halqa
        └── Town (Kargil)
              └── Municipality / ward
```

Design decisions:

- **One adjacency-list table, not five.** The hierarchy is ragged (villages have
  panchayats, towns have municipalities) and will change as administrative boundaries are
  redrawn. Five tables would hard-code today's shape.
- **Materialised `path` column of type `ltree`.** Ancestor and descendant checks become
  index-backed operators rather than recursive CTEs on every request:
  `WHERE path <@ 'ladakh.kargil.sankoo'`. A trigger maintains `path` on insert/update.
- **`profiles.village_id` is the tenancy key.** It points at the `village`/`town` level
  node, and is the value nearly every RLS policy compares against.
- Seeding: geo units are imported from LGD (Local Government Directory) codes where
  available and hand-corrected. `geo_units.lgd_code` is kept for reconciliation.
  **No village is created by users** — a missing village is a support request, so the
  namespace stays clean.

Changing your village is allowed but rate-limited (once per 30 days, logged) — it moves
what you can see, so it is an attack surface for scraping a neighbouring village's
directory.

## 2.3 Offline & low-connectivity strategy

Kargil sees genuine connectivity gaps: 2G pockets, seasonal outages, administrative
shutdowns. The app assumes the network is absent, not present.

| Content | Strategy |
|---|---|
| Village profile, stats, places, gallery thumbnails, notices, helplines, calendar | **Persisted TanStack Query cache**, TTL 7 days, hydrated at launch before any network call. Fully readable offline. |
| Helplines & calendar | Additionally **bundled as seed JSON in the app binary** — emergency numbers must work on a fresh install with no network, ever. Server copy overrides when newer. |
| Directory | Cached, but phone numbers re-fetched on view (privacy settings may have changed) |
| Trips / seat maps | **Never cached as authoritative.** Stale seat availability is worse than no seat availability. Show last-known with a prominent "as of HH:MM — reconnect to book" banner; booking is disabled offline. |
| Issue reports, place submissions, gallery uploads, ratings | **Outbox queue.** Written to a local SQLite outbox with attached images, uploaded by a background task on reconnect. UI shows a "pending" chip. Idempotency key per queued item prevents duplicates on retry. |

Additional measures: images served at explicit widths via the Storage transform CDN;
list screens paginate at 20; a "Lite mode" toggle (auto-enabled on `2g`/`slow-2g` from
`expo-network`) suppresses banner carousels and loads avatars as initials.

## 2.4 Security & privacy posture

- **All tables have RLS enabled and deny-by-default.** There is no service-role key in the
  app bundle. Anything requiring elevated rights goes through an Edge Function.
- **Phone numbers are the sensitive field.** They are never returned by a broad list query.
  The directory list returns names/avatars/occupations; a phone number is fetched by a
  dedicated RPC that re-checks the viewer's village and the owner's privacy setting, and
  logs the access.
- **Storage buckets:** `avatars` (public-read, owner-write), `village-media`
  (village-scoped read via signed URLs, moderated write), `issue-media`
  (private — reporter + routed department + admins only).
- Moderation: every user-submitted place, photo, and gallery item enters `status='pending'`
  and is invisible to others until a `panchayat_admin` approves it.
- Full detail of policies in [06 — Data model](06-data-model.md).

## 2.5 Repository layout

```
bespa/
├── app/                          # expo-router routes
│   ├── (auth)/                   # sign-in, sign-up, otp, geo-picker onboarding
│   ├── (tabs)/
│   │   ├── index.tsx             # Home
│   │   ├── transport/
│   │   ├── calendar.tsx
│   │   ├── services/             # helplines, report issue
│   │   └── profile.tsx
│   ├── village/[id]/             # places, gallery, directory, notices
│   ├── trip/[id].tsx             # seat map
│   └── admin/                    # notice composer, moderation queue
├── src/
│   ├── api/                      # one module per domain; typed Supabase client
│   ├── components/               # design-system primitives
│   ├── features/                 # feature-local hooks + logic
│   ├── i18n/{en,ur,bft}.json
│   ├── lib/                      # supabase client, outbox, hijri, geo helpers
│   └── theme/                    # tokens from doc 08
├── supabase/
│   ├── migrations/               # numbered SQL — source of truth for the schema
│   ├── functions/                # Edge Functions (Deno)
│   └── seed/                     # geo units, helplines, calendar, departments
├── assets/                       # illustrations, fonts, bundled seed JSON
└── docs/spec/                    # this specification
```

Database types are generated (`supabase gen types typescript`) into
`src/lib/database.types.ts` and committed — the schema is the contract.

## 2.6 Environments

| Env | Supabase project | App channel | Data |
|---|---|---|---|
| `local` | Local Supabase CLI stack | Expo Go / dev client | Seed + fixtures |
| `staging` | `bespa-staging` | EAS `preview` | Anonymised copy, real geo seed |
| `production` | `bespa-prod` | EAS `production` | Live. PITR backups enabled |

Region: choose the Supabase region with lowest RTT from Ladakh (typically
`ap-south-1`, Mumbai). Latency matters more than usual here.
