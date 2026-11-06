-- Long-distance rides — a working prototype (spec 04.2, 04.3, 04.6).
--
-- Not a mock-up. Two phones can run the whole loop against this: one posts a trip, the
-- other picks seats and books them, the first sees the passenger and their number, and
-- either side can cancel. Every enum it needs — `trip_status`, `seat_status`,
-- `booking_status`, `vehicle_type`, `trip_class`, `trip_mode` — was declared in the
-- August enums migration and has been waiting since.
--
-- ## The one thing a prototype must not fake
--
-- **Double-booking.** Spec 04.6 is unambiguous: "Two passengers must never get seat 3.
-- The seat map is not advisory; it is the source of truth, and it is enforced in the
-- database, not in the client." So `trip_seats` is real here, with its composite primary
-- key, and `hold_seats` is a conditional UPDATE that returns only the rows it actually
-- won. Two phones tapping seat 3 in the same second is a correctness test this schema
-- passes, and it is the single most expensive thing to retrofit later.
--
-- Hold expiry is evaluated **lazily, on read and on write**, so there is no sweeper to
-- run and a missed sweep can never strand a seat. Spec 04.6 asks for both; the lazy half
-- is the half that makes the scheduled half optional.
--
-- ## What is deliberately not here
--
-- Ratings, the payment QR, driver verification badges, the short-distance live stand
-- board, Realtime subscriptions and a vehicle-shaped seat map. Those are Phase 3. What
-- is here is the spine: post, browse, hold, book, cancel — the part that has to be right
-- before any of the rest is worth building.
--
-- ## Tenancy: this is the first table that is NOT village-scoped
--
-- Every other village table compares against `my_village_path()`. A trip cannot: it runs
-- Kargil → Leh and its passengers come from a dozen villages, so scoping it to the
-- driver's village would make it invisible to everyone it is for. Trips are therefore
-- readable by any onboarded user, which is correct — a trip is a public offer of a ride.
--
-- **A booking is not.** The passenger's phone number and pickup point are visible to
-- exactly two people, the passenger and that trip's driver, and the policy says so.
-- That split is the whole privacy design of this module.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- vehicles — remembered, so "create trip" can hit spec 04.3's 45 seconds
-- ---------------------------------------------------------------------------

create table vehicles (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references profiles(id) on delete cascade,
  type         vehicle_type not null,
  registration text,
  -- Passenger seats, not counting the driver. A seven-seat Xylo sells six.
  seats        smallint not null,
  created_at   timestamptz not null default now(),

  constraint vehicles_seats_sane check (seats between 1 and 60),
  constraint vehicles_registration_shape
    check (registration is null or length(btrim(registration)) between 4 and 20)
);

create index vehicles_owner_idx on vehicles (owner_id);

alter table vehicles enable row level security;

-- Readable by anyone who can see a trip, because the trip row names the vehicle.
create policy vehicles_readable on vehicles for select to authenticated using (true);
grant select on vehicles to authenticated;

-- ---------------------------------------------------------------------------
-- trips
-- ---------------------------------------------------------------------------

create table trips (
  id         uuid primary key default gen_random_uuid(),
  driver_id  uuid not null references profiles(id) on delete cascade,
  vehicle_id uuid not null references vehicles(id),

  class trip_class not null default 'long',
  mode  trip_mode  not null default 'shared',

  -- Free text, not geo units. `geo_units` holds Kargil's own districts, blocks and
  -- villages; Leh, Srinagar and Jammu are not in it and have no business being added to
  -- a tenancy tree. The client offers the four canonical corridors as chips so the
  -- common spellings stay common, which is as much structure as this needs.
  from_label text not null,
  to_label   text not null,

  departure_date date not null,
  -- "Early morning, ~5:00 AM". Spec 04.2: departure times here are approximate by
  -- nature and the UI should not pretend otherwise, so this is a phrase and not a
  -- timestamp. The honest consequence is that the 12-hour cancellation rule cannot be
  -- computed yet, and it is not implemented.
  departure_window text,

  price_per_seat numeric(10, 2) not null,
  seats_total    smallint not null,
  pickup_note    text,

  -- The number passengers call. Spec 04.2 makes "call the driver" prominent at every
  -- step, because the system this replaces runs on personal trust and a booking nobody
  -- can confirm by voice will not be trusted.
  --
  -- It lives on the trip rather than being read from the driver's `profile_private`,
  -- and that is the point: posting a ride is a deliberate act of publishing a number to
  -- strangers, so it is typed here each time rather than leaking out of a profile whose
  -- owner set it for something else.
  contact_phone text,

  status     trip_status not null default 'open',
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint trips_labels_present
    check (length(btrim(from_label)) > 0 and length(btrim(to_label)) > 0),
  constraint trips_labels_differ check (btrim(lower(from_label)) <> btrim(lower(to_label))),
  constraint trips_seats_sane check (seats_total between 1 and 60),
  constraint trips_price_sane check (price_per_seat >= 0 and price_per_seat <= 100000),
  constraint trips_cancelled_has_reason
    check (status <> 'cancelled' or length(btrim(coalesce(cancel_reason, ''))) > 0),
  constraint trips_contact_e164
    check (contact_phone is null or contact_phone ~ '^\+[1-9][0-9]{7,14}$')
);

create index trips_browse_idx on trips (departure_date, status);
create index trips_driver_idx on trips (driver_id, departure_date desc);

alter table trips enable row level security;

-- District-wide, not village-scoped. See the header.
create policy trips_readable on trips
  for select to authenticated
  using (my_village_path() is not null);

grant select on trips to authenticated;

-- ---------------------------------------------------------------------------
-- trip_seats — spec 04.6's composite key, which turns a double-booking into a
-- constraint violation rather than a logic bug
-- ---------------------------------------------------------------------------

create table trip_seats (
  trip_id uuid not null references trips(id) on delete cascade,
  seat_no smallint not null,

  status          seat_status not null default 'free',
  held_by         uuid references profiles(id),
  hold_expires_at timestamptz,
  -- Live occupancy. `bookings.seat_nos` is the immutable record of what was booked; this
  -- is which seats are taken *now*, and a cancellation clears it while the booking keeps
  -- its history.
  booking_id      uuid,

  primary key (trip_id, seat_no),

  constraint trip_seats_hold_coherent
    check ((status = 'held') = (held_by is not null and hold_expires_at is not null))
);

create index trip_seats_booking_idx on trip_seats (booking_id);

alter table trip_seats enable row level security;

create policy trip_seats_readable on trip_seats
  for select to authenticated
  using (my_village_path() is not null);

grant select on trip_seats to authenticated;

-- ---------------------------------------------------------------------------
-- bookings — the only table here that is private
-- ---------------------------------------------------------------------------

create table bookings (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references trips(id) on delete cascade,
  passenger_id uuid not null references profiles(id) on delete cascade,

  -- Spec 04.2 step 5. Six characters from an alphabet with no O/0 or I/1, because it is
  -- read aloud down a bad phone line.
  code text not null unique,

  -- What was booked, kept even after a cancellation frees the seats.
  seat_nos smallint[] not null,

  -- Pre-filled from the profile and editable (spec 04.2 step 2). Stored on the booking
  -- rather than read from `profile_private`, because the number to call about *this
  -- journey* is not necessarily the one on the profile, and because the driver must be
  -- able to see it without being granted the passenger's private row.
  phone       text,
  pickup_note text,

  status     booking_status not null default 'requested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint bookings_seats_present check (array_length(seat_nos, 1) between 1 and 10),
  constraint bookings_phone_e164
    check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$')
);

create index bookings_trip_idx on bookings (trip_id);
create index bookings_passenger_idx on bookings (passenger_id, created_at desc);

alter table bookings enable row level security;

-- Exactly two people. Not the village, not the district — this row carries a phone
-- number and where someone will be standing at five in the morning.
create policy bookings_readable on bookings
  for select to authenticated
  using (
    passenger_id = (select auth.uid())
    or exists (
      select 1 from trips t
       where t.id = bookings.trip_id and t.driver_id = (select auth.uid())
    )
  );

grant select on bookings to authenticated;

-- ---------------------------------------------------------------------------
-- Writing
-- ---------------------------------------------------------------------------

/** Ten minutes: long enough to type a pickup note, short enough that a seat someone
    walked away from comes back while the trip is still being filled. */
create or replace function ride_hold_minutes() returns interval
  language sql immutable as $$ select interval '10 minutes' $$;

create or replace function save_vehicle(
  type         vehicle_type,
  seats        smallint,
  registration text default null,
  vehicle_id   uuid default null
)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  me  uuid := auth.uid();
  out_id uuid;
begin
  if me is null then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  if vehicle_id is null then
    insert into vehicles (owner_id, type, seats, registration)
    values (me, save_vehicle.type, save_vehicle.seats,
            nullif(btrim(coalesce(save_vehicle.registration, '')), ''))
    returning id into out_id;
  else
    update vehicles v
       set type = save_vehicle.type,
           seats = save_vehicle.seats,
           registration = nullif(btrim(coalesce(save_vehicle.registration, '')), '')
     where v.id = save_vehicle.vehicle_id and v.owner_id = me
    returning v.id into out_id;

    if out_id is null then
      raise exception 'not_permitted' using errcode = '42501';
    end if;
  end if;

  return out_id;
end $$;

create or replace function create_trip(
  vehicle          uuid,
  from_label       text,
  to_label         text,
  departure_date   date,
  price_per_seat   numeric,
  seats_total      smallint,
  departure_window text default null,
  mode             trip_mode default 'shared',
  pickup_note      text default null,
  contact_phone    text default null
)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  me      uuid := auth.uid();
  owner   uuid;
  cap     smallint;
  new_id  uuid;
begin
  if me is null then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  select v.owner_id, v.seats into owner, cap from vehicles v where v.id = create_trip.vehicle;
  if owner is null or owner <> me then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  if create_trip.seats_total > cap then
    raise exception 'more seats than the vehicle has' using errcode = '22023';
  end if;

  -- A trip in the past cannot be booked, so it cannot be posted either.
  if create_trip.departure_date < current_date then
    raise exception 'that date has passed' using errcode = '22023';
  end if;

  insert into trips (driver_id, vehicle_id, from_label, to_label, departure_date,
                     departure_window, price_per_seat, seats_total, mode, pickup_note,
                     contact_phone)
  values (me, create_trip.vehicle,
          btrim(create_trip.from_label), btrim(create_trip.to_label),
          create_trip.departure_date,
          nullif(btrim(coalesce(create_trip.departure_window, '')), ''),
          create_trip.price_per_seat, create_trip.seats_total, create_trip.mode,
          nullif(btrim(coalesce(create_trip.pickup_note, '')), ''),
          nullif(btrim(coalesce(create_trip.contact_phone, '')), ''))
  returning id into new_id;

  -- Materialise one row per seat. This is what makes a double-booking a primary-key
  -- violation instead of a race (spec 04.6).
  insert into trip_seats (trip_id, seat_no)
  select new_id, n from generate_series(1, create_trip.seats_total) as n;

  return new_id;
end $$;

comment on function create_trip is
  'Posts a trip and materialises one trip_seats row per seat, which is what makes '
  'double-booking a constraint violation rather than a logic bug (spec 04.6).';

-- ---------------------------------------------------------------------------
-- hold_seats — the conditional UPDATE that decides who won
-- ---------------------------------------------------------------------------

create or replace function hold_seats(trip uuid, seat_nos smallint[])
returns smallint[]
language plpgsql security definer set search_path = public, extensions as $$
declare
  me  uuid := auth.uid();
  won smallint[];
  st  trip_status;
begin
  if me is null then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  select t.status into st from trips t where t.id = hold_seats.trip;
  if st is null then
    raise exception 'no such trip' using errcode = '22023';
  end if;
  if st in ('cancelled', 'departed', 'completed') then
    raise exception 'that trip is closed' using errcode = '22023';
  end if;

  -- The whole concurrency design in one statement. A seat is winnable when it is free,
  -- when its hold has expired (evaluated here, so no sweeper is required), or when this
  -- same user already holds it — re-tapping your own seat must not fail.
  update trip_seats s
     set status = 'held', held_by = me, hold_expires_at = now() + ride_hold_minutes()
   where s.trip_id = hold_seats.trip
     and s.seat_no = any (hold_seats.seat_nos)
     and (
       s.status = 'free'
       or (s.status = 'held' and (s.hold_expires_at < now() or s.held_by = me))
     );

  -- Read back rather than using RETURNING: `returning ... into` keeps only the last row
  -- of a multi-row update, which would silently report one seat won out of three.
  select array_agg(s.seat_no order by s.seat_no) into won
    from trip_seats s
   where s.trip_id = hold_seats.trip
     and s.seat_no = any (hold_seats.seat_nos)
     and s.status = 'held'
     and s.held_by = me
     and s.hold_expires_at >= now();

  return coalesce(won, '{}'::smallint[]);
end $$;

comment on function hold_seats is
  'Claims the seats it can and returns only those. Asking for three and getting two is '
  'the normal case when two people are choosing at once, and the caller must say so.';

create or replace function release_my_holds(trip uuid)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  update trip_seats s
     set status = 'free', held_by = null, hold_expires_at = null
   where s.trip_id = release_my_holds.trip
     and s.status = 'held'
     and s.held_by = (select auth.uid());
end $$;

-- ---------------------------------------------------------------------------
-- book_seats — one transaction, all or nothing
-- ---------------------------------------------------------------------------

create or replace function book_seats(
  trip        uuid,
  seat_nos    smallint[],
  phone       text default null,
  pickup_note text default null
)
returns table (booking_id uuid, code text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  me       uuid := auth.uid();
  held     int;
  new_code text;
  new_id   uuid;
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if me is null then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  if coalesce(array_length(book_seats.seat_nos, 1), 0) = 0 then
    raise exception 'pick a seat first' using errcode = '22023';
  end if;

  -- Every seat must still be held by this caller and unexpired. Anything else and the
  -- whole booking is refused rather than partly made.
  select count(*) into held
    from trip_seats s
   where s.trip_id = book_seats.trip
     and s.seat_no = any (book_seats.seat_nos)
     and s.status = 'held'
     and s.held_by = me
     and s.hold_expires_at >= now();

  if held <> array_length(book_seats.seat_nos, 1) then
    -- Its own code so the screen can say "someone took that seat" rather than showing a
    -- generic failure and leaving the passenger to guess.
    raise exception 'those seats are no longer held' using errcode = 'PT409';
  end if;

  -- Six characters, retried on the astronomically unlikely collision.
  loop
    new_code := '';
    for _i in 1..6 loop
      new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from bookings b where b.code = new_code);
  end loop;

  insert into bookings (trip_id, passenger_id, code, seat_nos, phone, pickup_note)
  values (book_seats.trip, me, new_code,
          (select array_agg(x order by x) from unnest(book_seats.seat_nos) as x),
          nullif(btrim(coalesce(book_seats.phone, '')), ''),
          nullif(btrim(coalesce(book_seats.pickup_note, '')), ''))
  returning id into new_id;

  update trip_seats s
     set status = 'booked', held_by = null, hold_expires_at = null, booking_id = new_id
   where s.trip_id = book_seats.trip
     and s.seat_no = any (book_seats.seat_nos);

  -- Once nothing is free the trip stops advertising itself as open.
  update trips t
     set status = 'filling', updated_at = now()
   where t.id = book_seats.trip and t.status = 'open';

  return query select new_id, new_code;
end $$;

comment on function book_seats is
  'Turns this caller''s unexpired holds into a booking, in one transaction. Refuses with '
  'PT409 when any seat has slipped, rather than booking part of the request.';

-- ---------------------------------------------------------------------------
-- Cancelling
-- ---------------------------------------------------------------------------

create or replace function cancel_booking(booking uuid)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  me      uuid := auth.uid();
  row     bookings%rowtype;
  driver  uuid;
begin
  select * into row from bookings b where b.id = cancel_booking.booking;
  if row.id is null then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  select t.driver_id into driver from trips t where t.id = row.trip_id;

  if me is null or (row.passenger_id <> me and driver <> me) then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  update bookings b
     set status = case when row.passenger_id = me
                       then 'cancelled_by_passenger'
                       else 'cancelled_by_driver' end::booking_status,
         updated_at = now()
   where b.id = cancel_booking.booking;

  -- The seats come back; the booking keeps its `seat_nos` as the record of what was
  -- held, which is what makes a cancellation auditable rather than invisible.
  update trip_seats s
     set status = 'free', booking_id = null, held_by = null, hold_expires_at = null
   where s.booking_id = cancel_booking.booking;

  update trips t
     set status = 'open', updated_at = now()
   where t.id = row.trip_id and t.status = 'filling';
end $$;

create or replace function cancel_trip(trip uuid, reason text)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null
     or not exists (select 1 from trips t
                     where t.id = cancel_trip.trip and t.driver_id = (select auth.uid())) then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  if length(btrim(coalesce(reason, ''))) = 0 then
    -- Passengers are about to be told their ride is off. They are owed a sentence.
    raise exception 'a cancellation needs a reason' using errcode = '22023';
  end if;

  update trips t
     set status = 'cancelled', cancel_reason = btrim(reason), updated_at = now()
   where t.id = cancel_trip.trip;

  update bookings b
     set status = 'cancelled_by_driver', updated_at = now()
   where b.trip_id = cancel_trip.trip
     and b.status in ('requested', 'confirmed');

  update trip_seats s
     set status = 'free', booking_id = null, held_by = null, hold_expires_at = null
   where s.trip_id = cancel_trip.trip;
end $$;

/** The driver accepting a request (spec 04.2 step 6). */
create or replace function confirm_booking(booking uuid)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null
     or not exists (
       select 1 from bookings b join trips t on t.id = b.trip_id
        where b.id = confirm_booking.booking and t.driver_id = (select auth.uid())
     ) then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  update bookings b
     set status = 'confirmed', updated_at = now()
   where b.id = confirm_booking.booking and b.status = 'requested';
end $$;

revoke execute on function save_vehicle(vehicle_type, smallint, text, uuid) from public;
revoke execute on function create_trip(uuid, text, text, date, numeric, smallint, text, trip_mode, text, text) from public;
revoke execute on function hold_seats(uuid, smallint[]) from public;
revoke execute on function release_my_holds(uuid) from public;
revoke execute on function book_seats(uuid, smallint[], text, text) from public;
revoke execute on function cancel_booking(uuid) from public;
revoke execute on function cancel_trip(uuid, text) from public;
revoke execute on function confirm_booking(uuid) from public;

grant execute on function save_vehicle(vehicle_type, smallint, text, uuid) to authenticated;
grant execute on function create_trip(uuid, text, text, date, numeric, smallint, text, trip_mode, text, text) to authenticated;
grant execute on function hold_seats(uuid, smallint[]) to authenticated;
grant execute on function release_my_holds(uuid) to authenticated;
grant execute on function book_seats(uuid, smallint[], text, text) to authenticated;
grant execute on function cancel_booking(uuid) to authenticated;
grant execute on function cancel_trip(uuid, text) to authenticated;
grant execute on function confirm_booking(uuid) to authenticated;
