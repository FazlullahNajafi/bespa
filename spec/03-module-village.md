# 03 — Village module (Home, Places, Gallery, Directory, Notices)

The emotional core of the app. Everything here is scoped to the user's `village_id`.

## 3.1 Home screen

Vertical scroll, sections in this order. Each section is independently cached and
independently empty-able.

| # | Section | Content | Empty state |
|---|---|---|---|
| 1 | **Header** | Village name (English + Purgi transliteration), block · district, current Gregorian + Hijri date chip | — |
| 2 | **Photo banner** | Carousel of up to 5 admin-selected gallery images, 16:9, auto-advance 5s, pauses on touch, dots indicator. Suppressed in Lite mode. | Single illustrated placeholder: "Your village has no photos yet — add one" → Gallery upload |
| 3 | **My village card** | Cover image or map, 2–3 line description, "About this village" → detail | "Ask your sarpanch to add a description" |
| 4 | **Weather** | Current temp, condition icon, 3-day strip. Optional; hidden entirely on API failure — never shows an error | Hidden |
| 5 | **Stats** | Population, households, plus a donut (male/female) and a bar (age bands or literacy). Tapping opens full stats with `source` and `year` visible on every figure | "Village statistics not published yet" |
| 6 | **Notices** | Latest 3, pinned first, with category chip and relative date | "No notices right now" |
| 7 | **Places** | Horizontal cards, top 6 by category priority (hospital → school → mosque/imambargah → tourist) | "Add the first place in your village" |
| 8 | **Directory preview** | Sarpanch card (name, photo, call button) + "N members" → full directory | Sarpanch contact missing → prompt admin |
| 9 | **Quick actions** | Book a ride · Report an issue · Helplines | — |

**Village detail / About** shows: description, an embedded map (or a stored static map
image when tiles fail), panchayat name, sarpanch, block/district, notable places count,
founding/historical note, and an "Edit" affordance for `panchayat_admin`.

### Stats

Stats are `(metric_key, value, year, source)` rows, not columns — so a village can publish
population this year and literacy next year without a migration. Rendered with the
[dataviz](08-design-system.md) rules: donut only for a 2–3 category split, bars otherwise.
**Every number displays its source and year.** Unsourced figures are not shown.

Suggested `metric_key` seed set: `population_total`, `population_male`,
`population_female`, `households`, `literacy_rate`, `area_hectares`, `schools`,
`health_centres`.

## 3.2 Places

A visual directory of the physical village.

**Categories** (fixed, iconographic): `school`, `hospital` (incl. dispensary/PHC),
`mosque`, `imambargah`, `khanqah`, `government_office`, `bank_atm`, `water_point`,
`tourist`, `market`, `sports`, `other`.

**Contribution flow** — any member can submit:

1. Pick category → 2. Name (en, optional Purgi) → 3. Photo (1–5, required: at least one)
→ 4. Description → 5. Location: drop a pin on the map or "use my current location"
→ 6. Optional: contact number, timings → 7. Submit.

Enters `status='pending'`. The submitter sees their own pending item with a "Waiting for
approval" chip; nobody else sees it. `panchayat_admin` gets a push and a moderation queue
badge. On approval the submitter gets a push and is credited ("Added by Nasreen").

**Places list**: filter chips by category, search, list/map toggle. **Place detail**:
photo gallery, description, category, distance from user (if location granted),
"Directions" (opens the OS maps app), contact call button, contributor credit,
"Report this listing" (dedupe/abuse).

Duplicate control: on submit, if a place of the same category exists within 150 m, show
"Is this the same as *X*?" before allowing a new entry.

## 3.3 Gallery

Photos of places and festivals, contributed by villagers.

- Grid, 3 columns, lazy-loaded thumbnails; tap → full-screen pager with caption,
  contributor, date, and share.
- Tabs: **All · Places · Festivals**. Festival photos may be tagged to a
  `calendar_event` (Mamani, Losar, Eid, Muharram) and then also surface on that event's
  page in the Calendar module — this is the link that makes the festival requirement in
  the brief work.
- Upload: 1–10 images per submission, caption, optional festival/place tag. Client-side
  resize to ≤1600px before upload. Queued through the outbox when offline.
- Moderation: `pending` → `approved`/`rejected` with an optional reason shown to the
  uploader.
- **Banner selection** is an admin action: `panchayat_admin` selects up to 5 approved
  images and orders them; that ordered set is the Home carousel. (The brief allows a user
  to pick their own top 5 — deliberately made an admin action instead, because the banner
  is the village's shared front page, not a personal one.)

## 3.4 Directory

The list of registered villagers.

- **Only registered users appear.** Bespa does not maintain a census of non-users.
- List rows: avatar (or coloured initials), name, occupation, and — only if the owner
  permits — a call button. Search by name; filter by occupation.
- **Pinned at top:** the sarpanch card, and any panchayat member contacts published by the
  admin. These are `village_contacts` rows (name, designation, phone) maintained by
  `panchayat_admin` and are *public within the village* by definition of the office.
- Tapping a member opens their profile subject to their privacy settings.

**Privacy — the rules that govern this screen**

| Field | Default | User options |
|---|---|---|
| Name | Visible to villagers | Always visible (required) |
| Avatar | Visible to villagers | Villagers / Nobody (falls back to initials) |
| Occupation | Visible to villagers | Villagers / Nobody |
| Phone number | Visible to villagers | Villagers / Panchayat officials only / Nobody |
| Listed in directory at all | Yes | Opt out entirely |

- "Villagers" means: users whose `village_id` equals yours. Never district-wide.
- A phone number is **never** included in a list response. It is fetched one at a time via
  `rpc.get_member_contact(member_id)`, which re-validates and writes an access log row.
  Rate-limited to 30 lookups/user/day to make bulk harvesting impractical.
- Onboarding presents these settings explicitly on a dedicated screen, not buried in
  Settings, with the plain-language line: *"Only people from your village can see this."*

## 3.5 Notices

Announcements from the panchayat: vacations, orders, events, alerts.

- **Categories:** `vacation`, `order`, `event`, `alert`, `general`. `alert` renders in the
  warning colour and pushes with high priority.
- **Composer** (`panchayat_admin`): title, body (basic formatting), category, optional
  image or PDF attachment, optional expiry date, "pin to top" toggle, and a preview.
  Publishing sends a push to every member of that geo unit.
- **Scope:** a notice targets a geo unit. A `district_admin` may publish to a block or the
  whole district; the notice then appears for every descendant village
  (`path <@ notice.geo_path`).
- Notice detail supports share-to-WhatsApp with a deep link — the realistic distribution
  channel in this region, and the main organic growth loop.
- List is grouped by month; expired notices move to an "Archive" section rather than
  disappearing.

## 3.6 Profile

- **Editable:** full name, avatar, occupation (from a fixed list — student, farmer,
  teacher, shopkeeper, local trader, hotel owner, driver, Islamic scholar, transport
  operator, government employee, health worker, engineer, contractor, digital creator,
  other + free text), phone (verified via OTP), village/panchayat, short bio.
- **Read-only:** member since, contributions count (places, photos), driver rating if a
  driver.
- **Sections:** My bookings · My reported issues · My contributions · Privacy · Language ·
  Notifications · Help · About & Privacy Policy · Delete account.
- **Delete account** is a real requirement (Play Store policy): a confirmed request
  anonymises the profile, removes avatar and phone, retains bookings/issues in
  de-identified form for the counterpart's records, and completes within 30 days.
