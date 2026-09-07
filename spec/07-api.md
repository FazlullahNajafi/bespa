# 07 — API surface

Three layers, chosen per operation:

1. **PostgREST + RLS** — the default. Plain reads and simple owner-writes go straight from
   the app to Postgres. No API code to write or maintain.
2. **Postgres RPCs (`security definer`)** — anything needing a transaction, a
   privacy re-check, or an audit write. Called via `supabase.rpc()`.
3. **Edge Functions (Deno)** — anything needing a secret, a third party, or fan-out:
   push notifications, WhatsApp forwarding, OTP, weather, moderation side effects.

The app never holds a service-role key.

---

## 7.1 Direct reads (PostgREST)

| Purpose | Query |
|---|---|
| Home banner | `gallery_items?select=*,media(*)&geo_unit_id=eq.{v}&is_banner=is.true&order=banner_order` |
| Village profile | `village_profiles?select=*,geo_units(*),sarpanch:profiles(*)&geo_unit_id=eq.{v}` |
| Stats | `village_stats?geo_unit_id=eq.{v}&order=metric_key` |
| Notices | `notices?select=*,media(*)&order=is_pinned.desc,published_at.desc&limit=20` |
| Places | `places?select=*,place_media(media(*))&status=eq.approved&category=eq.{c}` |
| Directory | `directory_members?village_id=eq.{v}&order=full_name` |
| Trips | `trips?select=*,drivers(*,profiles(full_name,avatar_path)),vehicles(*),routes(*)&route_id=eq.{r}&departure_at=gte.{d}&status=in.(open,filling)` |
| Seat map | `trip_seats?trip_id=eq.{t}&order=seat_no` |
| Live board | `driver_presence?select=*,drivers(*),vehicles(*),routes(*)&route_id=eq.{r}&ended_at=is.null&expires_at=gt.{now}` |
| Calendar | `calendar_events?or=(scope_geo_id.is.null,scope_geo_id.eq.{d})` |
| Helplines | `helplines?select=*,helpline_categories(*)&is_active=is.true` |
| My issues | `issues?select=*,issue_categories(*),issue_events(*)&reporter_id=eq.{me}` |

All list reads paginate with `Range` headers at 20 rows and are wrapped in TanStack Query
hooks under `src/api/`.

## 7.2 RPCs

### Directory

```ts
rpc('get_member_contact', { member_id: uuid })
  -> { phone: string } | { error: 'not_permitted' | 'rate_limited' }
```
Re-checks that caller and subject share a `village_id`, that `show_phone` allows it (or the
caller is a panchayat official and the setting is `officials`), enforces 30 lookups/user/day
against `contact_access_log`, writes the log row, then returns the number.

### Transport — the booking transaction

```ts
rpc('hold_seats', { trip_id: uuid, seat_nos: string[] })
  -> { held: string[], unavailable: string[], expires_at: timestamptz }
```
```sql
create or replace function hold_seats(trip_id uuid, seat_nos text[])
returns jsonb language plpgsql security definer as $$
declare held text[];
begin
  update trip_seats s set status='held', held_by=auth.uid(),
         hold_expires_at = now() + interval '8 minutes'
   where s.trip_id = hold_seats.trip_id
     and s.seat_no = any(seat_nos)
     and (s.status='free'
          or (s.status='held' and (s.hold_expires_at < now() or s.held_by = auth.uid())))
  returning s.seat_no into held;          -- array_agg in the real implementation
  return jsonb_build_object('held', held,
    'unavailable', (select array_agg(x) from unnest(seat_nos) x where not x = any(held)),
    'expires_at', now() + interval '8 minutes');
end $$;
```
Partial success is a normal outcome, not an error — the UI reports exactly which seats were
lost and lets the passenger re-pick.

```ts
rpc('book_seats', {
  trip_id, seat_nos, passenger_count, contact_phone, pickup_lat?, pickup_lng?, pickup_note?
}) -> { booking_id, code, seats, fare_total }
```
One transaction: assert every seat is `held` by `auth.uid()` and unexpired → insert
`bookings` with a generated 6-char `code` → flip seats to `booked` with `booking_id` →
`update trips set seats_available = seats_available - n` → return. Any failure raises and
rolls back the whole thing. Emits `booking.created` for the push fan-out.

```ts
rpc('release_seats',  { trip_id, seat_nos })            // user backed out of checkout
rpc('cancel_booking', { booking_id, reason })           // frees seats, restores count, notifies
rpc('complete_trip',  { trip_id, no_show_booking_ids })
rpc('submit_rating',  { booking_id, stars, tags, comment })  // recomputes drivers.rating_avg
```

### Transport — live presence

```ts
rpc('go_live',        { vehicle_id, route_id, stand_id?, seats_free, fare?, share_location? })
rpc('update_presence',{ presence_id, seats_free })      // the −1 control in the notification
rpc('end_presence',   { presence_id, reason })          // 'departed' | 'full'
rpc('claim_seat',     { presence_id, pickup_note? })    // soft 10-minute signal
```

### Civic

```ts
rpc('submit_issue', { category_id, title, description, media_ids, lat, lng, address_text, is_public })
  -> { issue_id, ref_no }
```
Generates `ref_no` (`KRG-YYYY-NNNNNN`), auto-assigns `department_id` from the category,
writes the opening `issue_events` row, enforces 5/day, and returns duplicate candidates
(same category within 200 m in 7 days) so the client can offer "upvote instead".

```ts
rpc('update_issue_status', { issue_id, to_status, note, department_id? })  // admins/liaisons
rpc('upvote_issue',        { issue_id })
rpc('current_hijri_date',  { geo_unit_id })  -> { hijri: {d,m,y}, offset_days, confirmed: bool }
```

### Geo & onboarding

```ts
rpc('geo_children', { parent_id })     // cascading pickers
rpc('set_my_village', { village_id, panchayat_id })   // 30-day rate limit, logged
```

## 7.3 Edge Functions

| Function | Trigger | Does |
|---|---|---|
| `push-fanout` | DB webhook on `notices`, `bookings`, `issue_events`, `seat_claims` | Resolves recipients (village members / trip passengers / reporter), writes `notifications`, batches to Expo Push, prunes dead tokens |
| `verify-phone` | Client | Sends and checks OTP via SMS provider; sets `phone_verified`. Rate-limited per number and per IP |
| `forward-issue` | Admin action | Builds the department message (ref no, category, village, description, map link, signed photo URLs) and returns a `wa.me` deep link + SMS fallback body; records `forwarded_at`/`forwarded_via`. **Composes; a human sends.** |
| `weather` | Client, 30-min cache | Proxies the weather API so the key stays server-side. Returns 204 on upstream failure — the section hides rather than erroring |
| `moderate` | Admin action | Approves/rejects a place or gallery item, notifies the submitter, and — on approval of a banner pick — reorders the banner set |
| `helpline-sync` | Weekly cron | Fetches the kargil.nic.in pages, diffs against `helplines`, opens an admin review task. Never writes live data |
| `account-delete` | Client | Anonymises the profile, purges avatar and phone, de-identifies bookings/issues, schedules auth-user deletion |
| `driver-verify` | Admin action | Flips `drivers.verified`, notifies the driver |

## 7.4 Realtime channels

| Channel | Subscribed by | Payload |
|---|---|---|
| `trip_seats:trip_id=eq.{id}` | Anyone with the seat map open | Seat status changes — a seat greys out within ~1s of someone else holding it |
| `driver_presence:route_id=eq.{id}` | The live stand board | Insert/update/delete of live drivers and their seat counts |
| `notifications:user_id=eq.{me}` | Every signed-in app | In-app badge without polling |
| `issues:id=eq.{id}` | Issue detail screen | Status transitions as they happen |

Realtime is a **progressive enhancement**. Every screen that uses it also works with pull
to refresh, because a WebSocket over 2G will drop.

## 7.5 Conventions

- **Errors:** RPCs raise with `errcode` + a stable machine string
  (`seat_unavailable`, `hold_expired`, `not_permitted`, `rate_limited`, `phone_unverified`).
  The client maps these to localised copy; raw Postgres text never reaches a user.
- **Idempotency:** every mutating RPC callable from the offline outbox accepts an
  `idempotency_key uuid`, stored unique per table, so a retried upload cannot duplicate.
- **Timestamps** are `timestamptz` in UTC, rendered in `Asia/Kolkata`.
- **Money** is `numeric(10,2)` and is *display only* — Bespa moves no funds.
- **Media** is uploaded to Storage first, then the returned `media.id` is passed to the RPC.
  Orphaned media with no owning row is swept nightly after 24h.
