-- The live stand board (spec 04.4) — short distance.
--
-- Spec 04 refuses to merge Kargil's two transport economies, and this is the other one.
-- Long distance is days ahead and wants booking; short distance is ten minutes away and
-- wants **visibility**. Kargil↔Baroo is ₹20 and a van leaves when it fills. Nobody books
-- that, and a product that asked them to would be ignored.
--
-- So there is no seat map here and no booking. A driver says "I am at the stand with
-- four seats"; it shows on a board; it **expires on its own after 45 minutes**.
--
-- ## Expiry is the whole design
--
-- Spec 04.4: "Auto-expiry is essential — a stale board is worse than no board." A board
-- showing a van that left an hour ago sends someone to an empty stand, and they do not
-- come back. So `expires_at` is set on the row, every read filters on it, and nothing
-- depends on a sweeper having run. The driver can end it sooner by departing or filling.
--
-- ## A claim is a courtesy, not a contract
--
-- Spec 04.4 again: tapping "I'm coming" decrements the visible count for ten minutes and
-- tells the driver, and "it is a courtesy signal, not a contract, and the copy says so".
-- That is why claims are a separate table with their own short expiry rather than a
-- decrement of `seats_free` — the number the driver typed stays the number the driver
-- typed, and the board subtracts what is pending.

set search_path = public, extensions;

create table live_rides (
  id         uuid primary key default gen_random_uuid(),
  driver_id  uuid not null references profiles(id) on delete cascade,
  vehicle_id uuid not null references vehicles(id),

  from_label text not null,
  to_label   text not null,
  /** What the driver says is free right now. Claims are subtracted on read. */
  seats_free smallint not null,
  /** The route's usual fare. Informational — Bespa collects nothing. */
  fare       numeric(10, 2),
  /** "Main stand", "near the bridge". Spec 04.4's stand or approximate location. */
  stand_note text,

  -- The number to ring, typed when going live.
  --
  -- **Not read from `profile_private`.** Doing that would publish a driver's personal
  -- number to the whole district past their own privacy settings, which `privacy_settings`
  -- exists to govern and which they set for an entirely different purpose. Going live is
  -- a deliberate act of saying "call me about this van for the next 45 minutes", and the
  -- number belongs to that act — the same rule `trips.contact_phone` follows.
  contact_phone text,

  went_live_at timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '45 minutes',
  ended_at     timestamptz,
  ended_reason text,

  constraint live_rides_labels_present
    check (length(btrim(from_label)) > 0 and length(btrim(to_label)) > 0),
  constraint live_rides_labels_differ
    check (btrim(lower(from_label)) <> btrim(lower(to_label))),
  constraint live_rides_seats_sane check (seats_free between 0 and 60),
  constraint live_rides_fare_sane check (fare is null or (fare >= 0 and fare <= 10000)),
  constraint live_rides_contact_e164
    check (contact_phone is null or contact_phone ~ '^\+[1-9][0-9]{7,14}$')
);

create index live_rides_board_idx on live_rides (expires_at desc) where ended_at is null;
create index live_rides_driver_idx on live_rides (driver_id, went_live_at desc);

alter table live_rides enable row level security;

-- District-wide, like `trips` and for the same reason: a van to Baroo is a public offer
-- and the people who want it do not all live in one village.
create policy live_rides_readable on live_rides
  for select to authenticated
  using (my_village_path() is not null);

grant select on live_rides to authenticated;

create table live_claims (
  live_id      uuid not null references live_rides(id) on delete cascade,
  passenger_id uuid not null references profiles(id) on delete cascade,
  pickup_note  text,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '10 minutes',

  primary key (live_id, passenger_id)
);

create index live_claims_live_idx on live_claims (live_id, expires_at);

alter table live_claims enable row level security;

-- The claimer and that ride's driver. A claim carries a name and a pickup point, so it
-- is as private as a booking is.
create policy live_claims_readable on live_claims
  for select to authenticated
  using (
    passenger_id = (select auth.uid())
    or exists (
      select 1 from live_rides r
       where r.id = live_claims.live_id and r.driver_id = (select auth.uid())
    )
  );

grant select on live_claims to authenticated;

-- ---------------------------------------------------------------------------
-- Driver side
-- ---------------------------------------------------------------------------

create or replace function go_live(
  vehicle    uuid,
  from_label text,
  to_label   text,
  seats_free smallint,
  fare       numeric default null,
  stand_note text default null,
  contact_phone text default null
)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  me     uuid := auth.uid();
  owner  uuid;
  cap    smallint;
  new_id uuid;
begin
  if me is null then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  select v.owner_id, v.seats into owner, cap from vehicles v where v.id = go_live.vehicle;
  if owner is null or owner <> me then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  if go_live.seats_free > cap then
    raise exception 'more seats than the vehicle has' using errcode = '22023';
  end if;

  -- One live row per driver. Going live again replaces the last one rather than
  -- stacking two vans that do not exist — a driver who taps twice is correcting
  -- themselves, not multiplying.
  update live_rides r
     set ended_at = now(), ended_reason = 'replaced'
   where r.driver_id = me and r.ended_at is null and r.expires_at > now();

  insert into live_rides (driver_id, vehicle_id, from_label, to_label,
                          seats_free, fare, stand_note, contact_phone)
  values (me, go_live.vehicle, btrim(go_live.from_label), btrim(go_live.to_label),
          go_live.seats_free, go_live.fare,
          nullif(btrim(coalesce(go_live.stand_note, '')), ''),
          nullif(btrim(coalesce(go_live.contact_phone, '')), ''))
  returning id into new_id;

  return new_id;
end $$;

comment on function go_live is
  'Puts a driver on the short-distance board for 45 minutes. Replaces their previous '
  'live row rather than adding a second.';

create or replace function set_live_seats(live uuid, seats_free smallint)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null
     or not exists (select 1 from live_rides r
                     where r.id = set_live_seats.live and r.driver_id = (select auth.uid())) then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  update live_rides r
     set seats_free = greatest(0, set_live_seats.seats_free)
   where r.id = set_live_seats.live;
end $$;

create or replace function end_live(live uuid, reason text default 'departed')
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null
     or not exists (select 1 from live_rides r
                     where r.id = end_live.live and r.driver_id = (select auth.uid())) then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  update live_rides r
     set ended_at = now(), ended_reason = btrim(reason)
   where r.id = end_live.live and r.ended_at is null;
end $$;

-- ---------------------------------------------------------------------------
-- Passenger side — the courtesy signal
-- ---------------------------------------------------------------------------

create or replace function claim_live_seat(live uuid, pickup_note text default null)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  ok boolean;
begin
  if me is null then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  select true into ok from live_rides r
   where r.id = claim_live_seat.live and r.ended_at is null and r.expires_at > now();

  if ok is null then
    raise exception 'that van has gone' using errcode = '22023';
  end if;

  -- Tapping again extends rather than failing: someone still walking to the stand is
  -- still coming, and refusing them would be refusing the only honest answer.
  insert into live_claims (live_id, passenger_id, pickup_note)
  values (claim_live_seat.live, me,
          nullif(btrim(coalesce(claim_live_seat.pickup_note, '')), ''))
  on conflict (live_id, passenger_id) do update
     set pickup_note = excluded.pickup_note,
         expires_at  = now() + interval '10 minutes';
end $$;

comment on function claim_live_seat is
  'Spec 04.4''s "I''m coming" — holds nothing, tells the driver, and expires in ten '
  'minutes. A courtesy signal, not a booking.';

create or replace function release_live_claim(live uuid)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  delete from live_claims c
   where c.live_id = release_live_claim.live
     and c.passenger_id = (select auth.uid());
end $$;

/**
 * The board: every van currently out, with the claims already subtracted.
 *
 * A function rather than a view because the expiry of both the ride and its claims has
 * to be evaluated at read time — that is what makes the board honest without a sweeper.
 */
create or replace function live_board()
returns table (
  id          uuid,
  driver_id   uuid,
  driver_name text,
  vehicle     vehicle_type,
  registration text,
  from_label  text,
  to_label    text,
  seats_free  smallint,
  claimed     int,
  fare        numeric,
  stand_note  text,
  went_live_at timestamptz,
  expires_at  timestamptz,
  contact     text
)
language sql stable security definer set search_path = public, extensions as $$
  select r.id,
         r.driver_id,
         p.full_name,
         v.type,
         v.registration,
         r.from_label,
         r.to_label,
         r.seats_free,
         (select count(*)::int from live_claims c
           where c.live_id = r.id and c.expires_at > now()),
         r.fare,
         r.stand_note,
         r.went_live_at,
         r.expires_at,
         -- The number the driver published when going live — never their profile's.
         r.contact_phone
    from live_rides r
    join profiles p on p.id = r.driver_id
    join vehicles v on v.id = r.vehicle_id
   where r.ended_at is null
     and r.expires_at > now()
     -- Readable only by someone who has finished onboarding, matching the table policy
     -- this function reads past.
     and my_village_path() is not null
   order by r.went_live_at desc
   limit 50;
$$;

comment on function live_board is
  'Vans currently out, newest first, with expired rides and expired claims already '
  'excluded — so the board is honest whether or not anything swept.';

revoke execute on function go_live(uuid, text, text, smallint, numeric, text, text) from public;
revoke execute on function set_live_seats(uuid, smallint) from public;
revoke execute on function end_live(uuid, text) from public;
revoke execute on function claim_live_seat(uuid, text) from public;
revoke execute on function release_live_claim(uuid) from public;
revoke execute on function live_board() from public;

grant execute on function go_live(uuid, text, text, smallint, numeric, text, text) to authenticated;
grant execute on function set_live_seats(uuid, smallint) to authenticated;
grant execute on function end_live(uuid, text) to authenticated;
grant execute on function claim_live_seat(uuid, text) to authenticated;
grant execute on function release_live_claim(uuid) to authenticated;
grant execute on function live_board() to authenticated;
