# 01 — Product

## 1.1 Problem

Kargil district has roughly 130 inhabited villages spread across mountain blocks, connected
by a single highway system that closes seasonally. Three frictions recur:

1. **Nothing about your village is written down anywhere you can reach.** Who lives here,
   who the sarpanch is, where the nearest dispensary is, when the school reopens after
   winter vacation — all of it travels by word of mouth and expires.
2. **Transport is an oral network.** Booking a seat to Kashmir means knowing a driver's
   number. Getting to Baroo means standing at a road. Neither the passenger nor the driver
   can see the other's availability, so both waste time — drivers wait 10–20 minutes for a
   van to fill; passengers wait for a van that already left full.
3. **Civic problems have no address.** A villager knows the problem but not the department,
   so complaints either die or arrive at the wrong desk.

## 1.2 Vision

> A villager opens Bespa and sees their own village: its faces, its places, its notices,
> its calendar. Two taps books a seat. Two taps sends a photographed problem to the
> department that owns it.

Bespa is **hyper-local by construction**. The unit of the product is the village, not the
district. Content, directory, notices, and privacy all scope to the geography the user
belongs to.

## 1.3 Personas

| Persona | Who | Primary jobs | Design implication |
|---|---|---|---|
| **Nasreen — the villager** | Homemaker in Minjee, mid-30s, shared Android phone, 4G that drops to 2G | See notices, find a van to Kargil town, check when Eid falls | Must work on a 2-year-old budget Android; every screen readable at 2G; large tap targets |
| **Mohd. Ali — the driver** | Owns an Eeco, runs Kargil↔Baroo 6× a day | Advertise free seats *right now*, get called less, get paid | Driver flows must take <15 seconds and work one-handed at the wheel-side; never require typing while working |
| **Kacho — the long-haul operator** | Runs an Innova on Kargil↔Leh, 2–3 trips a week | Fill 6 seats before departure day, avoid no-shows | Needs a trip he creates once and passengers fill; needs passenger phone numbers |
| **Sadiq — the student** | 19, in Kargil town for college, from Trespone | Get home cheaply, see village events, know exam/vacation notices | Highest engagement, lowest spend — the growth engine. Make sharing effortless |
| **Sarpanch Zahra — panchayat admin** | Elected head, one village | Publish notices, moderate photos, see complaints from her halqa | Needs a low-friction publishing tool, not a dashboard. Mobile-first admin |
| **Dept. official** | Line department (PHE, PDD, Education) | Receive routed complaints, mark resolved | Should not need the app at all in v1 — reach them by WhatsApp/SMS, let them reply |

## 1.4 Roles & permissions

| Role | Granted by | Can |
|---|---|---|
| `member` | Self sign-up + phone verification | Read own-village content; submit places/photos/issues; book rides; edit own profile |
| `driver` | Applies in-app, approved by `district_admin` | Everything a member can + create trips, broadcast stand presence, manage vehicle & QR |
| `panchayat_admin` | Appointed by `district_admin` | Everything a member can + publish notices, moderate submissions, edit village profile/stats for **their own** geo unit |
| `dept_liaison` | Appointed by `district_admin` | View and update issues routed to their department |
| `district_admin` | Seeded manually | All of the above district-wide + approve drivers, manage departments, set Hijri offset, manage helplines |
| `super_admin` | Seeded manually | Platform-wide, geo seeding, feature flags |

Roles are additive and stored as a set, not a single column — a sarpanch may also be a driver.

## 1.5 v1 scope

**In scope**

- Auth: email/password (JWT via Supabase Auth) + Google sign-in + mandatory phone verification
- Geography selection: UT → District → Block → Village/Town → Panchayat/Municipality
- **Village**: village profile & map, population/household stats, photo banner carousel,
  gallery, places directory, member directory, notices
- **Transport**: long-distance trip listing + visual seat-map booking + call-to-confirm +
  ratings + driver QR payment; short-distance live stand board
- **Civic**: dual Gregorian/Hijri calendar with local festivals; helpline directory;
  categorised issue reporting with admin-mediated routing to departments
- Privacy controls per field; profile visible to co-villagers only by default
- Push notifications for notices, booking status, issue status
- Offline read of cached village content

**Explicitly out of scope for v1** (see [09](09-roadmap-and-risks.md))

- Marketplace, AI chatbot, NREGA/Jal Jeevan scheme tracking, Smart Parking
- Any in-app payment gateway — **payment is cash or the driver's own QR code**, always
  settled outside the app. Bespa never touches money in v1.
- Live GPS tracking of vehicles
- Purgi language-learning portal
- A web app of any kind, including for admins (admins use the mobile app)

## 1.6 Non-goals (permanent, not just v1)

- Bespa is **not** a payment processor or an escrow. No wallet, no commission on rides.
- Bespa is **not** an official government channel. Issue reporting is a
  citizen-to-admin-to-department courier, and the UI must say so — no implied SLA from
  any government body.
- Bespa is **not** a general social network. No open feed, no strangers, no DMs in v1.

## 1.7 Success metrics

| Horizon | Metric | Target |
|---|---|---|
| Launch + 60 days | Verified members in the 3 pilot villages | 40% of adult population |
| Launch + 60 days | Villages with a complete profile (photo, stats, sarpanch contact) | 3/3 pilot |
| Launch + 90 days | Weekly active drivers broadcasting presence | 15 |
| Launch + 90 days | Short-distance seats claimed via app / week | 150 |
| Launch + 90 days | Long-distance bookings that end in a completed trip | ≥70% of bookings |
| Launch + 120 days | Issues that reach a department within 48h | ≥80% |
| Ongoing | Crash-free sessions | ≥99.5% |
| Ongoing | Cold start to Home on a 2GB-RAM Android over 3G | <4s |

**Counter-metric:** driver-reported no-shows. If app bookings produce more no-shows than
phone bookings, the booking flow has failed regardless of volume.

## 1.8 Guiding principles

1. **The phone call is a feature, not a failure.** Every booking screen keeps a one-tap
   call button. Trust here is personal; the app augments the call, it doesn't replace it.
2. **Degrade, never block.** No connectivity means cached content and a queued action,
   not an error screen. Internet shutdowns are a fact of life in the region.
3. **Village-scoped by default.** A user should never have to think about who can see
   their number — the default is "my villagers", and it is stated in plain language.
4. **Nothing is fake.** No placeholder villages, no seeded fake drivers, no invented
   population figures. Empty states say "no one has added this yet — add it."
5. **Cultural specificity is the product.** Mamani and Losar and Muharram are first-class
   objects, not "events". Getting the Hijri date right locally matters more than any
   feature on this list.
