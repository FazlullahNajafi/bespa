# 09 — Roadmap, monetisation & risks

## 9.1 Phasing

Estimates assume one full-stack developer plus part-time design. Adjust for team size;
the *sequence* matters more than the numbers.

### Phase 0 — Foundation (3 weeks)

Expo app skeleton with expo-router and theming · Supabase project, migrations, RLS ·
auth (email/password, Google, phone OTP) · geo seeding for Kargil district · onboarding
with the geo picker · profile & privacy settings · the offline/outbox layer.

**Exit:** a user can sign up, verify a phone, pick their village, and set privacy. Nothing
else exists — but the tenancy spine and the privacy model are real and tested.

### Phase 1 — Village (4 weeks)

Home with all sections · village profile & stats · places (submit, moderate, browse, map)
· gallery with banner selection · directory with the contact RPC · notices with composer
and push · moderation queue.

**Exit:** three pilot villages fully populated with real content by real admins.

### Phase 2 — Civic (3 weeks)

Dual calendar with the Hijri offset mechanism · seeded festivals reviewed locally ·
helplines bundled and live · issue reporting, triage, WhatsApp forwarding, timeline, public
board.

**Exit:** ten real issues forwarded and at least three closed with a department response.
Civic ships before Transport because it is lower-risk and builds the admin relationships
that Transport's driver recruitment will need.

### Phase 3 — Transport (6 weeks — the long pole)

Routes, stands, driver onboarding and verification · vehicles and seat layouts · trip
creation · seat map · hold/book RPCs with realtime · bookings, cancellation, no-show ·
ratings · QR payment screen · live stand board with presence and claims · trust & safety.

**Exit:** 20 verified drivers on the Kargil↔Baroo corridor, 100 completed seat claims,
zero double-bookings in production.

### Phase 4 — Hardening & launch (3 weeks)

Performance on a 2GB Android · full offline pass · accessibility audit · Urdu localisation
· privacy policy and Play Store data-safety declarations · account deletion · Sentry and
analytics · closed beta in the pilot villages · public release.

**Total to v1: ~19 weeks.**

### v1.5 (post-launch, demand-ordered)

Weather · trip GPS tracking with share-my-trip · notice attachments as PDF · saved routes
and favourite drivers · in-app admin analytics · Purgi UI strings.

### v2

**Marketplace** — local shops and services, categories, shop profiles with photos and
hours, call/WhatsApp to enquire, village-scoped browse, verified-business badge. No
transactions, no catalogue, no delivery: a discoverable directory is the whole product.

**AI chatbot (English + Purgi mixed)** — the hardest deferred item and the reason it is
deferred. Purgi has minimal digital corpus, so a general model will code-switch poorly and
hallucinate confidently in a language the user cannot easily check. Approach when built:
retrieval-grounded over Bespa's own content (notices, helplines, schemes, places, calendar)
rather than open-ended chat; Claude with a Purgi/Balti glossary and few-shot transliterated
examples; every answer cites the notice or helpline it came from; a hard refusal boundary
on legal, medical, and scheme-eligibility advice. Free tier of N messages/day, then paid.

**Schemes** — NREGA job-card progress and payments, Jal Jeevan Mission, rural-development
dustbin payments. **Gated on data access.** There is no public API for individual NREGA
records; without an official data-sharing arrangement with the district administration this
becomes manual data entry, which does not scale and will go stale. Build only after that
arrangement exists — an out-of-date payment figure is worse than no figure.

**Smart Parking** — deliberately left for last. The brief lists it without detail, and it
needs a defined problem (which lots, whose lots, who enforces) before it needs a screen.

### v3

Purgi language learning — the crowd-translation loop from the brief, where users translate
English phrases and those translations train the module. Genuinely valuable as a *language
preservation* project and worth doing properly with local linguists, with explicit consent
and clear licensing of contributed translations.

## 9.2 Monetisation

Freemium, per the brief, but staged — **v1 monetises nothing**. A community app with no
users has nothing to sell, and charging early poisons adoption in a small, tightly
connected community where reputation travels fast.

| Stage | Model | Notes |
|---|---|---|
| v1 | Free | Fund via grant, LAHDC support, or self-funding |
| v2 | **Business listings** — free basic listing, paid featured placement in Marketplace | The cleanest fit: businesses already pay for visibility, and it does not tax villagers |
| v2 | **Chatbot** — free daily message quota, paid beyond | As described in the brief |
| v2 | **Transport promotion** — a driver pays to be featured on a route | Cap it hard. Never let payment reorder a live availability board — that destroys the board's usefulness and its trust. Promoted drivers appear in a clearly-labelled slot, outside the ranked list |
| v2+ | Local ads | Village- and district-scoped only, clearly marked, never in emergency helplines, issue reporting, or notices |

**Never monetised:** helplines, notices, issue reporting, the directory, and per-ride
commission. Charging for a ride booking would push drivers back to phone calls in a week.

## 9.3 Risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | **Transport cold start** — an empty board kills retention on first open | **High** | One route first; recruit through the stand unions in person; ship a callable driver directory that is useful at zero liveness; never fake supply ([§4.7](04-module-transport.md)) |
| 2 | **Connectivity and shutdowns** | High | Offline-first cache, bundled helplines and calendar, outbox queue, Lite mode ([§2.3](02-architecture.md)) |
| 3 | **Wrong Hijri date** — a correctness failure that costs religious credibility instantly | High | Local moon-sighting offset set by district admin; "subject to moon sighting" language on unconfirmed months; local scholarly review of all seed events ([§5.1](05-module-civic.md)) |
| 4 | **Privacy breach — the directory becomes a phone-number harvest** | High | Numbers excluded from the base view, revealed one at a time by RPC, rate-limited, audited; village change rate-limited; clear per-field controls ([§3.4](03-module-village.md)) |
| 5 | **Moderation load on volunteer sarpanches** | Medium | Sensible auto-approve for trusted contributors after N approved items; batch approve; push reminders; more than one moderator per village |
| 6 | **Government relations** — a badly routed or aggressive complaint flow sours the administration and the issue module dies | Medium | Human-in-the-loop forwarding; no implied SLA; brief the district administration before launch and give them visibility into the queue |
| 7 | **Driver disputes over fares or no-shows** | Medium | Bespa records the agreed fare and marks no-shows but takes no position; reporting flow and admin review; explicit terms that Bespa is not a party to the ride |
| 8 | **Geo data drift** — boundaries and panchayat names change | Medium | LGD codes retained; adjacency-list model absorbs restructuring; villages created only by admins |
| 9 | **Single-maintainer bus factor** | Medium | Everything in migrations and code, nothing configured by hand in a dashboard; this spec kept current |
| 10 | **Play Store compliance** — data safety, account deletion, sensitive permissions | Low | Account deletion built in Phase 4; location and camera permissions requested in context with a plain reason; privacy policy published before submission |
| 11 | **Purgi chatbot quality** | Low (deferred) | Retrieval-grounded, cited, hard refusal boundaries — see v2 above |

## 9.4 Open questions

1. **Pilot villages** — which three? Baroo is the obvious transport anchor (highest route
   frequency); the other two should differ in size and distance from town.
2. **Institutional backing** — is there an LAHDC or panchayat sponsor? It changes what geo
   and department data is obtainable, and how much the issue module can promise.
3. **Village stats provenance** — Census 2011 is the only complete source and is now
   badly dated. Publish it labelled `source: Census 2011`, or collect fresh figures per
   village with the panchayat's help?
4. **Driver verification authority** — does the taxi union verify, or does the app team?
   Union endorsement would solve both verification and cold start at once.
5. **SMS/OTP provider and cost** — phone verification is the one hard per-user cost.
   Budget it, and decide whether Google sign-in can carry users who cannot receive SMS.
6. **Purgi orthography** — Latin transliteration or Perso-Arabic script? This must be
   settled with local input before any Purgi string is written, because it is expensive to
   change later.
7. **Name** — does "Bespa" carry a meaning in Purgi that should shape the identity and the
   illustration set?
