# 05 — Civic module (Calendar, Helplines, Report Issue)

## 5.1 Calendar

A dual Gregorian + Hijri calendar carrying the festivals that actually structure the year
in Kargil.

### The hard part: the Hijri date must be *locally* correct

An algorithmic Hijri date (Umm al-Qura, tabular civil) will disagree with the date Kargil
is actually observing, because the month begins on **local moon sighting**, confirmed by
the local religious authority. An app that confidently shows the wrong Muharram date is
worse than an app with no calendar.

Design:

- Compute a **base** Hijri date with a tabular algorithm (`hijri-converter` equivalent) —
  this gives a sane offline default.
- Apply a **district-level `hijri_offset`** in days (−2…+2), set by `district_admin` after
  the local sighting announcement, stored with an effective-from date and an audit trail.
- The displayed date is `base + offset`. Where an offset has been applied, the date chip
  carries a small verified glyph and "Confirmed locally".
- Where a month's start is **not yet confirmed**, moon-dependent events show as
  *"Expected 8 or 9 July — subject to moon sighting"* rather than a single false date.
  `calendar_events.is_moon_dependent` drives this.
- The tabular fallback is bundled in the app binary, so the calendar works on a fresh
  install with no network.

### Screens

- **Month view**: Gregorian grid with the Hijri day rendered small in each cell; days with
  events carry a coloured dot per category. Header shows both month names.
- **Today card**: "20 August 2026 · 6 Rabi al-Awwal 1448" plus the next upcoming event.
- **Event list**: upcoming, grouped by month.
- **Event detail**: name (English / Urdu / Purgi), description, date(s), category, photos
  pulled from the Gallery module's festival tag, and — for cultural festivals — an
  editorial note on how it is observed locally.

### Event categories & seed content

| Category | Examples |
|---|---|
| `religious_islamic` | Muharram (1–10, Ashura), Arbaeen, Eid al-Fitr, Eid al-Adha, Eid-e-Ghadeer, Milad-un-Nabi, Ramadan start/end, Shab-e-Qadr |
| `religious_buddhist` | Losar, Buddha Purnima |
| `cultural_local` | **Mamani**, harvest and sowing observances, local village festivals |
| `national` | Republic Day, Independence Day, Gandhi Jayanti |
| `civic_local` | School winter/summer vacation start & end, panchayat meetings |

Seed content must be reviewed by local scholars before launch. Ship fewer events, all
correct, rather than a full year of guesses. A "Suggest an event" action lets villagers
submit local observances into the moderation queue.

## 5.2 Helplines

An offline-first emergency directory. Seeded from the official district sources —
[kargil.nic.in/helpline](https://kargil.nic.in/helpline/) and
[kargil.nic.in/disaster-management](https://kargil.nic.in/disaster-management/) — and
verified before each release.

### Seed data (verified 20 Aug 2026)

**Emergency**

| Service | Number |
|---|---|
| Police Control Room, Kargil | 01985-232275 |
| Police | 100 |
| Fire Service | 101 |
| Ambulance | 102 |
| Joint Control Room | 01985-232263 |

**Disaster management — district officials**

| Office | Number |
|---|---|
| Deputy Commissioner / CEO, LAHDC Kargil | 01985-232216, 01985-232644 |
| Senior Superintendent of Police | 01985-232645 |
| Additional Deputy Commissioner | 01985-233057 |
| District Disaster Management Officer | 01985-233252, 01985-232216 |
| Dy. SP, State Disaster Response Force | 01985-232205 |
| National Disaster Helpline | 011-1078 |
| National Disaster Control Room | 011-26701728 |

**Public utility**

| Service | Number |
|---|---|
| Railways — general enquiry | 131, 1330, 1335 |
| Railways — reservation enquiry | 1345 |
| Airlines — general enquiry | 1400 |
| Airlines — reservation | 1401 |

### Behaviour

- **Bundled in the binary.** Emergency numbers must be reachable on a fresh install, in
  aeroplane mode, in a shutdown. The server copy overrides only when it is newer.
- Grouped by category; the Emergency group is pinned, oversized, and reachable from the
  Services tab in one tap. One tap dials.
- **Not scraped at runtime.** The source pages are HTML with no API. A scheduled Edge
  Function fetches them weekly and, on a detected diff, files an admin review task —
  it never publishes a change automatically. Each entry carries `source_url` and
  `last_verified_at`, and the screen footer states the verification date and links to the
  official page.
- Additional local numbers (village dispensary, ambulance driver, electrician, PHE
  lineman) may be added per geo unit by `panchayat_admin`.

## 5.3 Report Issue

Citizen complaints, categorised and routed. The brief's flow is implemented exactly:
**the admin receives it first, then forwards it to the correct department official.**

### Flow

1. **Category** — grid of illustrated tiles. Each maps to a department:

   | Category | Department |
   |---|---|
   | Water supply / handpump | PHE (Jal Shakti) |
   | Electricity / transformer / poles | PDD |
   | Road / bridge / culvert | PWD (R&B) |
   | Sanitation / waste / dustbin | Rural Development / Municipality |
   | School | Education |
   | Health centre | Health & Medical Education |
   | Irrigation / kuhl | Irrigation & Flood Control |
   | Animal husbandry | Sheep / Animal Husbandry |
   | Ration / PDS | Food, Civil Supplies & Consumer Affairs |
   | Other | District admin triage |

2. **Describe** — title, description, 0–5 photos, optional voice note (many users are more
   fluent speaking Purgi than typing it — this is a real accessibility feature here, not a
   nicety), location pin + address text (defaults to the user's village).
3. **Visibility** — "Show this to my villagers" (default on, enables upvoting and prevents
   duplicate reports) or "Keep private to officials".
4. **Submit** → status `submitted`, reference number issued, queued through the outbox if
   offline.

### Routing & lifecycle

```
submitted ──▶ acknowledged ──▶ forwarded ──▶ in_progress ──▶ resolved
    │             (admin)      (to dept.)      (dept.)       (dept./admin)
    └──▶ rejected (with reason)                     └──▶ reopened (reporter, ≤14 days)
```

- **Admin triage** (`district_admin` / `panchayat_admin`): a queue with the auto-suggested
  department pre-selected from the category. The admin confirms or re-routes, then taps
  **Forward**.
- **Forwarding** is an Edge Function that composes a message — reference number, category,
  village, description, location link, photo links (time-limited signed URLs) — and opens
  it as a **prefilled WhatsApp message** to the department contact, with an SMS fallback.
  v1 deliberately keeps a human in the loop rather than auto-sending: a wrongly routed
  complaint to a real official damages the app's standing with the administration.
- Every transition writes an `issue_events` row (actor, from, to, note, timestamp) — the
  reporter sees this as a timeline, which is the single biggest driver of trust in a
  complaint system.
- Resolution requires a note and optionally a photo. The reporter is pushed and asked to
  confirm; unconfirmed resolutions are flagged to the admin after 7 days.
- **Public issues board**: village-scoped list of public issues with status chips and
  upvotes. Upvotes surface what a village actually cares about and let the admin merge
  duplicates into one parent issue.

### Guardrails

- The UI must never imply a government SLA. Standing copy: *"Bespa forwards your report to
  the concerned department. It is not an official government complaint portal."*
- Rate limit: 5 issues per user per day; duplicate detection by category + 200 m radius +
  7-day window prompts "Someone already reported this — upvote instead?"
- Abuse reporting on public issues; admin can unpublish while keeping the report alive.
