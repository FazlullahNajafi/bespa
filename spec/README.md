# Bespa — Product & Technical Specification

A community app for the villages of Kargil, Ladakh. One place for a villager to see
their village — its people, places, notices, festivals — and to solve the two things
that actually cost them time every week: **finding a ride** and **getting a civic
problem to the right official**.

| | |
|---|---|
| **Platform** | React Native + Expo (iOS + Android, one codebase) |
| **Backend** | Supabase (Postgres + RLS, Auth, Storage, Realtime, Edge Functions) |
| **Primary geography** | District Kargil, UT of Ladakh — architected to extend to Leh and beyond |
| **Languages** | English + Urdu UI at launch; Purgi (Balti) strings phased in |
| **v1 modules** | Village (Home, Places, Gallery, Directory, Notices) · Transport · Civic (Calendar, Helpline, Report Issue) |
| **Deferred to v2** | Marketplace · AI chatbot · Schemes/NREGA tracking · Smart Parking · Purgi language learning |

## Read in this order

| # | Document | What it settles |
|---|---|---|
| 00 | [Source brief](00-source-brief.md) | The original idea document, kept verbatim as the requirements baseline |
| 01 | [Product](01-product.md) | Vision, personas, scope, non-goals, success metrics |
| 02 | [Architecture](02-architecture.md) | Stack, geo hierarchy, offline strategy, repo layout |
| 03 | [Village module](03-module-village.md) | Home, Places, Gallery, Directory, Notices |
| 04 | [Transport module](04-module-transport.md) | Long-distance seat booking, short-distance live stand board |
| 05 | [Civic module](05-module-civic.md) | Dual calendar, helplines, issue reporting & routing |
| 06 | [Data model](06-data-model.md) | Full Postgres schema, enums, indexes, RLS policies |
| 07 | [API surface](07-api.md) | PostgREST usage, RPCs, Edge Functions, realtime channels |
| 08 | [Design system](08-design-system.md) | Colour, type, motion, illustration, haptics, accessibility |
| 09 | [Roadmap & risks](09-roadmap-and-risks.md) | Phasing, monetisation, cold-start and connectivity risks |
| 10 | [Implementation plan](10-implementation-plan.md) | Build order, toolchain, dependencies, phase exit criteria |

## The one-paragraph pitch

Kargil's villages run on phone calls and physical presence. To travel to Leh you call a
driver you happen to know, or walk to the stand. To report a broken water line you find
someone who knows the right officer. To know when Muharram or Losar falls you ask.
Bespa turns each of these into a screen: a seat map you tap instead of a call you hope
gets answered, a categorised complaint that lands with a named department, a calendar
that shows the Hijri date your own moon-sighting committee confirmed. Everything is
scoped to *your* village — your neighbours see your profile, strangers three blocks away
do not.

## Status

Specification only. No implementation exists yet in this repository.
