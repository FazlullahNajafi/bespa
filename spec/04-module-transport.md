# 04 — Transport module

The highest-effort, highest-value module. Kargil has **two genuinely different transport
economies**, and the central design decision of this module is to refuse to merge them.

| | Long distance | Short distance |
|---|---|---|
| Vehicles | Xylo, Innova, Tempo Traveller, big bus | Omni van, Eeco, small bus |
| Routes | Kargil ↔ Kashmir / Leh / Zanskar / Jammu | Kargil ↔ Baroo / Minjee / Trespone / Choskore / Ando (TV station) |
| Fare | Thousands of ₹, per seat or full charter | ₹10–40 |
| Time horizon | **Days ahead** — driver fixes a date, fills 5–6 seats | **Right now** — 10–20 minute wait at the stand |
| The user's question | *"Who is going to Leh on Thursday and is there a window seat?"* | *"Is there a van leaving for Baroo in the next ten minutes, and does it have room?"* |
| Product answer | **Scheduled trips + seat map booking** | **Live stand board — presence, not booking** |

Building one "book a ride" flow for both would produce a product that serves neither.
Long distance gets a booking system. Short distance gets a *visibility* system.

---

## 4.1 Transport home

Two large segmented cards at the top — **Long distance** and **In & around Kargil** —
below which sits whichever board the user last used. Also on this screen: "My bookings"
and, for drivers, a persistent **"Go live"** control.

## 4.2 Long distance — passenger flow

### Browse

- Route selector: From / To, defaulting to the user's village → Kargil town, with the four
  canonical corridors as one-tap chips (Kashmir, Leh, Zanskar, Jammu) plus reverse.
- Date selector: horizontal 14-day strip.
- Result rows show: driver photo + name + rating, vehicle type and registration, departure
  date & time (with a "window" label like *"Early morning, ~5:00 AM"* — departure times
  here are approximate by nature and the UI should not pretend otherwise), seats free of
  total, price per seat, and pickup area.
- Sort: departure time (default) · price · rating. Filter: vehicle type, seats needed,
  shared vs. charter.

### Seat map — the centrepiece

The brief asks for "a taxi roof-based view". Implemented as a **top-down plan of the
vehicle interior**, rendered from a `seat_layout` definition rather than a fixed image, so
a new vehicle type is a data row and not a release.

```
Innova (7 seats)                Xylo (7)             Tempo Traveller (12)
┌─────────────────────┐
│  [🕵 driver]  [ 1 ]  │        same shape,          rows of 2 + 2, aisle
├─────────────────────┤        different label       last row of 4
│  [ 2 ]  [ 3 ]  [ 4 ] │
├─────────────────────┤
│    [ 5 ]  [ 6 ]  [7] │        Bus: 2+2 grid with an aisle column,
└─────────────────────┘         seat numbers as printed on the vehicle
```

A layout is `{ rows: [ { seats: [ {no, x, w, kind} ] } ] }` where `kind ∈
{driver, window, middle, aisle, folding}`. Seats render in four states: **free**,
**held** (someone is mid-checkout — shown greyed with a small clock), **booked**,
**selected**. Colour is never the only signal — booked seats also carry a lock glyph, for
colour-blind users and for the many cheap screens in the field.

Interaction: tap to select (haptic `selectionAsync`), tap again to deselect, multi-select
up to the number of passengers chosen. Selecting places a **server-side hold for 8
minutes**; a countdown appears in the footer. Window seats are labelled, because the
first thing a passenger asks a driver is for one.

### Book

1. Confirm seats, passenger count, and pickup point (map pin + text note — *"near Baroo
   bridge"*; pickup from the passenger's location is the norm here, not a stand).
2. Contact number pre-filled from profile, editable.
3. Fare summary — **informational only.** A line states plainly: *"Pay the driver directly
   in cash or by scanning their QR at the end of the journey. Bespa does not collect
   payment."*
4. Confirm → booking created with status `requested`, seats move `held` → `booked`.
5. Confirmation screen with a **6-character booking code**, a **Call driver** button, and
   "Add to calendar".
6. Driver receives a push; on driver acceptance the booking moves to `confirmed` and the
   passenger is pushed again.

**"Call the driver" is deliberately prominent at every step.** The existing system runs on
personal trust; a booking that cannot be verbally confirmed will not be trusted.

### Cancel & no-show

- Passenger may cancel free until 12h before departure; between 12h and departure the
  cancellation is recorded and counts toward a visible reliability score.
- Driver cancellation notifies all passengers with a push and an in-app banner, and the
  trip is marked `cancelled` with a reason.
- After `departure_at + duration`, the trip auto-moves to `completed` and both sides are
  prompted: driver marks no-shows, passenger rates.

### Rate & pay

- 1–5 stars plus quick tags: *punctual, safe driving, clean vehicle, fair fare, helpful*.
  Negative tags: *late, overcharged, rash driving*.
- Payment screen shows the driver's uploaded **QR image** full-screen at maximum
  brightness, with their UPI ID as selectable text beneath it, and the agreed fare as a
  reminder. No amount is transmitted anywhere. Bespa records only
  `payment_marked_by_passenger: bool` for the driver's convenience.

## 4.3 Long distance — driver flow

- **Create trip** (target: under 45 seconds): route → date → departure window → vehicle
  (remembered) → price per seat → shared or charter → pickup area notes → publish.
  A "repeat this trip" action clones a past trip to a new date; most drivers run the same
  corridor weekly.
- **Trip management:** passenger list with names, seat numbers, pickup points, and call
  buttons; block a seat manually (a relative is coming); mark departed; mark completed;
  mark no-show.
- **Profile:** vehicle photo, registration, license (verified by admin, shown as a badge),
  payment QR, home stand, rating.

## 4.4 Short distance — the live stand board

No advance booking. The product's job is to answer *"what is leaving soon and does it have
room?"*

**Driver side — "Go live"**: one screen, three taps.

- Pick route (remembered) → set seats free with a large stepper → **Go live**.
- The driver appears on the board for **45 minutes** or until they tap "Departed" /
  "Full". Auto-expiry is essential — a stale board is worse than no board.
- While live, a persistent notification shows two controls: **−1 seat** and **Departed**.
  A driver must be able to update seat count without unlocking into the app.
- Optional: broadcast approximate location (stand, or coarse GPS) so passengers can see
  who is nearest. Off by default, explicit opt-in per session.

**Passenger side — the board**: a live list, grouped by route, of drivers currently
available, showing vehicle type, seats free, the stand or approximate location, minutes
since they went live, fare (from the route's published fare, e.g. Kargil↔Baroo ₹20 van /
₹10 small bus), and a **Call** button. Updates arrive over Supabase Realtime — no pull to
refresh, the numbers just change.

**Claiming a seat** (soft, not a booking): tapping "I'm coming" decrements the visible
seat count for 10 minutes and notifies the driver with the passenger's name and pickup
point. It expires silently. It is a courtesy signal, not a contract, and the copy says so:
*"Tell the driver you're on the way. Seats are first-come."*

**Charter a van** for a personal group: pick a driver from the board or from the full
driver list for that route → call to agree date, time, and fare. Bespa records nothing
beyond the call; this is intentional.

## 4.5 Trust, safety & verification

- A driver badge requires admin verification of license and vehicle registration.
  Unverified drivers may not create trips or go live.
- Every driver profile shows rating, trips completed, and member-since.
- **Report a driver** from any trip or booking, routed to `district_admin`; three upheld
  reports suspend the driver account pending review.
- Passenger phone numbers are visible to the driver **only for their own confirmed
  bookings**, and only until 24h after the trip completes.
- The pickup pin of a booking is visible to that trip's driver only.
- An SOS affordance on an active trip surfaces the police control room (01985-232275) and
  a "share my trip" link containing driver name, vehicle registration, and route — sent
  by the passenger's own WhatsApp, not by Bespa.

## 4.6 Concurrency — how double-booking is prevented

Two passengers must never get seat 3. The seat map is not advisory; it is the source of
truth, and it is enforced in the database, not in the client.

- Each trip materialises a row per seat in `trip_seats (trip_id, seat_no)` — a composite
  primary key. This makes a double-booking a **constraint violation**, not a logic bug.
- Selecting a seat calls `rpc.hold_seats(trip_id, seat_nos[])`, which updates rows
  `WHERE status='free' OR (status='held' AND hold_expires_at < now())` and returns the set
  it actually won. If the client asked for 3 seats and got 2, the UI says so immediately.
- Confirming calls `rpc.book_seats(trip_id, seat_nos[], …)`, which runs in a single
  transaction: verify the hold belongs to this user and is unexpired, insert the booking,
  flip seats to `booked`, decrement `trips.seats_available`. Any failure rolls back whole.
- A scheduled function sweeps expired holds every minute; expiry is also evaluated lazily
  on read, so a missed sweep never blocks a seat.
- Clients subscribe to `trip_seats` changes over Realtime, so a seat greys out on every
  open seat map within a second of someone else holding it.

## 4.7 Cold start — the module's real risk

A ride board with no drivers is an empty room, and the first user who finds it empty does
not come back. Mitigations, in order of importance:

1. **Launch with one route, not twenty.** Kargil↔Baroo is the highest-frequency short
   route in the brief. Saturate it before adding others.
2. **Recruit through the existing structure** — the taxi/bus stand unions and the drivers
   villagers already call. Onboard drivers in person, at the stand, with their vehicle
   photographed and QR uploaded for them.
3. **The driver list is useful even when nobody is live.** Ship a browsable, callable
   directory of verified drivers per route from day one; it beats the status quo (knowing
   one driver's number) even with zero real-time activity.
4. **Never fabricate supply.** No demo drivers, no fake seat counts. The empty state says
   how many drivers are registered on the route and offers to call one.
