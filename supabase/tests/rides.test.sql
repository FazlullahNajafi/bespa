-- pgTAP: the ride prototype (spec 04.2, 04.3, 04.6).
--
-- Most of this file is about **two passengers and one seat**. Spec 04.6: "Two passengers
-- must never get seat 3. The seat map is not advisory; it is the source of truth, and it
-- is enforced in the database, not in the client." That is the claim a prototype is most
-- tempted to fake and the most expensive thing to retrofit, so it is tested from both
-- sides: the loser of a race must be told they lost, and a stale hold must not strand a
-- seat for ever.
--
-- The other half is who may see a booking. A trip is public — it is an offer of a ride.
-- A booking carries a phone number and where someone will be standing at five in the
-- morning, and exactly two people may read it.
--
-- Run: npm run db:test

begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Fixture: a driver, two passengers in one village, a third in another —
-- because trips deliberately cross village boundaries and bookings do not.
-- ---------------------------------------------------------------------------

insert into geo_units (id, type, parent_id, slug, name_en)
select '00000000-0000-0000-0000-0000000d1100'::uuid, 'village', b.id, 'ridevillage_one', 'Ride Village One'
  from geo_units b where b.path = 'ladakh.kargil.kargil'::ltree;

insert into geo_units (id, type, parent_id, slug, name_en)
select '00000000-0000-0000-0000-0000000d2200'::uuid, 'village', b.id, 'ridevillage_two', 'Ride Village Two'
  from geo_units b where b.path = 'ladakh.kargil.kargil'::ltree;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000d1101', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'driver@example.test', '{"full_name":"Driver"}'),
  ('00000000-0000-0000-0000-0000000d1102', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rider1@example.test', '{"full_name":"Rider One"}'),
  ('00000000-0000-0000-0000-0000000d1103', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rider2@example.test', '{"full_name":"Rider Two"}'),
  ('00000000-0000-0000-0000-0000000d2201', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rider3@example.test', '{"full_name":"Rider Three"}');

update profiles set village_id = '00000000-0000-0000-0000-0000000d1100'
 where id in ('00000000-0000-0000-0000-0000000d1101',
              '00000000-0000-0000-0000-0000000d1102',
              '00000000-0000-0000-0000-0000000d1103');
update profiles set village_id = '00000000-0000-0000-0000-0000000d2200'
 where id = '00000000-0000-0000-0000-0000000d2201';

create or replace function tests_become(uid uuid) returns void
language plpgsql as $$
begin
  execute format('set local role authenticated');
  execute format('set local request.jwt.claims = %L', json_build_object('sub', uid, 'role', 'authenticated')::text);
end $$;

-- ---------------------------------------------------------------------------
-- Posting a trip
-- ---------------------------------------------------------------------------
select tests_become('00000000-0000-0000-0000-0000000d1101');

select lives_ok(
  $$ select save_vehicle('xylo', 6::smallint, 'JK07 1234') $$,
  'a driver can save their vehicle');

select throws_ok(
  $$ select create_trip(
       (select id from vehicles limit 1), 'Kargil', 'Leh',
       (current_date + 3), 1500, 9::smallint) $$,
  '22023',
  null,
  'and cannot sell more seats than the vehicle has');

select throws_ok(
  $$ select create_trip(
       (select id from vehicles limit 1), 'Kargil', 'Leh',
       (current_date - 1), 1500, 6::smallint) $$,
  '22023',
  null,
  'nor post a trip into the past');

select throws_ok(
  $$ select create_trip(
       (select id from vehicles limit 1), 'Kargil', 'kargil',
       (current_date + 3), 1500, 6::smallint) $$,
  '23514',
  null,
  'nor one that goes where it already is');

select lives_ok(
  $$ select create_trip(
       (select id from vehicles limit 1), 'Kargil', 'Leh',
       (current_date + 3), 1500, 6::smallint, 'Early morning, ~5:00 AM') $$,
  'a real trip posts');

select is(
  (select count(*)::int from trip_seats
    where trip_id = (select id from trips limit 1)),
  6,
  'and materialises one row per seat, which is what makes a double-booking a '
  'constraint violation (spec 04.6)');

select is(
  (select count(*)::int from trip_seats
    where trip_id = (select id from trips limit 1) and status = 'free'),
  6,
  'all of them free to begin with');

-- A passenger cannot post a trip on someone else's vehicle.
select tests_become('00000000-0000-0000-0000-0000000d1102');
select throws_ok(
  $$ select create_trip(
       (select id from vehicles limit 1), 'Kargil', 'Srinagar',
       (current_date + 4), 900, 4::smallint) $$,
  '42501',
  null,
  'and nobody can post a trip on a vehicle that is not theirs');

-- ---------------------------------------------------------------------------
-- Who can see a trip — deliberately not village-scoped
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from trips),
  1,
  'a passenger in the driver''s village sees the trip');

select tests_become('00000000-0000-0000-0000-0000000d2201');
select is(
  (select count(*)::int from trips),
  1,
  'and so does one in another village — a trip is a public offer of a ride, and '
  'scoping it to the driver''s village would hide it from everyone it is for');

-- ---------------------------------------------------------------------------
-- The race: two passengers, one seat (spec 04.6)
-- ---------------------------------------------------------------------------
select tests_become('00000000-0000-0000-0000-0000000d1102');

select is(
  hold_seats((select id from trips limit 1), array[3]::smallint[]),
  array[3]::smallint[],
  'the first passenger holds seat 3');

select tests_become('00000000-0000-0000-0000-0000000d1103');

select is(
  hold_seats((select id from trips limit 1), array[3]::smallint[]),
  '{}'::smallint[],
  'the second is told plainly that they got nothing, rather than being allowed to '
  'carry on and fail at the end');

select is(
  hold_seats((select id from trips limit 1), array[3, 4]::smallint[]),
  array[4]::smallint[],
  'asking for two and winning one returns only the one — the UI has to be able to say so');

-- The loser's partial win must be real, not just reported.
select is(
  (select held_by from trip_seats
    where trip_id = (select id from trips limit 1) and seat_no = 4),
  '00000000-0000-0000-0000-0000000d1103'::uuid,
  'and the seat they did win is really theirs');

select is(
  (select held_by from trip_seats
    where trip_id = (select id from trips limit 1) and seat_no = 3),
  '00000000-0000-0000-0000-0000000d1102'::uuid,
  'while seat 3 still belongs to whoever got there first');

-- Re-tapping your own seat must not fail.
select is(
  hold_seats((select id from trips limit 1), array[4]::smallint[]),
  array[4]::smallint[],
  'holding a seat you already hold is not a conflict');

-- ---------------------------------------------------------------------------
-- Booking
-- ---------------------------------------------------------------------------
select tests_become('00000000-0000-0000-0000-0000000d1103');

select throws_ok(
  $$ select book_seats((select id from trips limit 1), array[3]::smallint[]) $$,
  'PT409',
  null,
  'booking a seat held by somebody else is refused with its own code, so the screen '
  'can say which seat went');

select lives_ok(
  $$ select book_seats((select id from trips limit 1), array[4]::smallint[],
       '+919419000000', 'Near Baroo bridge') $$,
  'booking a seat you hold works');

select is(
  (select status::text from trip_seats
    where trip_id = (select id from trips limit 1) and seat_no = 4),
  'booked',
  'the seat flips to booked');

select is(
  (select length(code) from bookings limit 1),
  6,
  'and the booking carries a six-character code to read down a phone line');

select is(
  (select status::text from trips limit 1),
  'filling',
  'the trip stops advertising itself as wide open');

-- A hold that expired is not a booking.
--
-- `reset role` first: `trip_seats` grants no UPDATE to `authenticated`, so this would be
-- a silent no-op left running as the last passenger, and the two assertions below would
-- pass against an unexpired hold. That failure mode has already cost this suite once.
reset role;
update trip_seats set hold_expires_at = now() - interval '1 minute'
 where trip_id = (select id from trips limit 1) and seat_no = 3;

select tests_become('00000000-0000-0000-0000-0000000d1102');
select throws_ok(
  $$ select book_seats((select id from trips limit 1), array[3]::smallint[]) $$,
  'PT409',
  null,
  'an expired hold cannot be cashed in');

select tests_become('00000000-0000-0000-0000-0000000d1103');
select is(
  hold_seats((select id from trips limit 1), array[3]::smallint[]),
  array[3]::smallint[],
  'and somebody else can now take it — expiry is evaluated on read, so no sweeper is '
  'needed and a missed sweep can never strand a seat');

-- ---------------------------------------------------------------------------
-- Who can read a booking — the one private table here
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from bookings),
  1,
  'the passenger reads their own booking');

select tests_become('00000000-0000-0000-0000-0000000d1101');
select is(
  (select count(*)::int from bookings),
  1,
  'the driver of that trip reads it too, or there is no passenger list');

select tests_become('00000000-0000-0000-0000-0000000d1102');
select is(
  (select count(*)::int from bookings),
  0,
  'another passenger on the same trip cannot — it carries a phone number and a '
  'pickup point');

select tests_become('00000000-0000-0000-0000-0000000d2201');
select is(
  (select count(*)::int from bookings),
  0,
  'and nor can anyone else at all');

-- ---------------------------------------------------------------------------
-- Cancelling
-- ---------------------------------------------------------------------------
-- Captured as postgres, because the whole point of the next assertion is that this
-- caller cannot see the row — including to find its id.
reset role;
create temp table booking_under_test as select id from bookings limit 1;

select tests_become('00000000-0000-0000-0000-0000000d2201');
select throws_ok(
  $$ select cancel_booking((select id from booking_under_test)) $$,
  '42501',
  null,
  'a stranger cannot cancel a booking');

select tests_become('00000000-0000-0000-0000-0000000d1103');
select lives_ok(
  $$ select cancel_booking((select id from bookings limit 1)) $$,
  'its passenger can');

select is(
  (select status::text from trip_seats
    where trip_id = (select id from trips limit 1) and seat_no = 4),
  'free',
  'the seat comes back');

select tests_become('00000000-0000-0000-0000-0000000d1103');
select is(
  (select array_length(seat_nos, 1) from bookings limit 1),
  1,
  'while the booking keeps a record of what was held, so a cancellation is auditable '
  'rather than invisible');

select tests_become('00000000-0000-0000-0000-0000000d1102');
select throws_ok(
  $$ select cancel_trip((select id from trips limit 1), 'changed my mind') $$,
  '42501',
  null,
  'a passenger cannot cancel the whole trip');

select tests_become('00000000-0000-0000-0000-0000000d1101');
select throws_ok(
  $$ select cancel_trip((select id from trips limit 1), '  ') $$,
  '22023',
  null,
  'and the driver cannot cancel one without a reason — passengers are owed a sentence');

select lives_ok(
  $$ select cancel_trip((select id from trips limit 1), 'Road closed at Zoji La') $$,
  'with a reason, the driver can');

select * from finish();
rollback;
