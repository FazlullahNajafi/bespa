-- pgTAP: the short-distance live board (spec 04.4).
--
-- Two claims carry this file.
--
-- **Expiry is the design.** Spec 04.4: "Auto-expiry is essential — a stale board is
-- worse than no board." A board that still shows a van which left an hour ago sends
-- somebody to an empty stand, and they do not come back. So the tests push a row past
-- its expiry and check the board drops it, with nothing having swept.
--
-- **A driver's personal number must not reach the board.** `live_board()` is security
-- definer and reads past RLS, which makes it exactly the kind of function that leaks a
-- phone number by accident. It returns the number typed when going live and never
-- `profile_private.phone`.
--
-- Run: npm run db:test

begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

set search_path = public, extensions;

insert into geo_units (id, type, parent_id, slug, name_en)
select '00000000-0000-0000-0000-0000000e1100'::uuid, 'village', b.id, 'livevillage_one', 'Live Village One'
  from geo_units b where b.path = 'ladakh.kargil.kargil'::ltree;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000e1101', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'vandriver@example.test', '{"full_name":"Van Driver"}'),
  ('00000000-0000-0000-0000-0000000e1102', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'walker@example.test', '{"full_name":"Walker"}'),
  ('00000000-0000-0000-0000-0000000e1103', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'bystander2@example.test', '{"full_name":"Bystander"}');

update profiles set village_id = '00000000-0000-0000-0000-0000000e1100'
 where id in ('00000000-0000-0000-0000-0000000e1101',
              '00000000-0000-0000-0000-0000000e1102',
              '00000000-0000-0000-0000-0000000e1103');

-- A personal number on the driver's private row. Nothing on the board may ever show it.
update profile_private set phone = '+919000000001'
 where user_id = '00000000-0000-0000-0000-0000000e1101';

create or replace function tests_become(uid uuid) returns void
language plpgsql as $$
begin
  execute format('set local role authenticated');
  execute format('set local request.jwt.claims = %L', json_build_object('sub', uid, 'role', 'authenticated')::text);
end $$;

-- ---------------------------------------------------------------------------
-- Going live
-- ---------------------------------------------------------------------------
select tests_become('00000000-0000-0000-0000-0000000e1101');

select save_vehicle('eeco', 6::smallint, 'JK07 5555');

select throws_ok(
  $$ select go_live((select id from vehicles limit 1), 'Kargil', 'Baroo', 4::smallint) $$,
  'PT403',
  null,
  'an unverified driver cannot go live either (spec 04.5)');

reset role;
insert into driver_documents (user_id, kind, storage_path, status, reviewed_by, reviewed_at)
values ('00000000-0000-0000-0000-0000000e1101', 'licence',
        '00000000-0000-0000-0000-0000000e1101/licence/a.jpg', 'approved',
        '00000000-0000-0000-0000-0000000e1101', now());
select tests_become('00000000-0000-0000-0000-0000000e1101');

select throws_ok(
  $$ select go_live((select id from vehicles limit 1), 'Kargil', 'Baroo', 9::smallint) $$,
  '22023',
  null,
  'a driver cannot offer more seats than the van has');

select throws_ok(
  $$ select go_live((select id from vehicles limit 1), 'Kargil', 'kargil', 4::smallint) $$,
  '23514',
  null,
  'nor a van going where it already is');

select lives_ok(
  $$ select go_live((select id from vehicles limit 1), 'Kargil', 'Baroo', 4::smallint,
       20, 'Main stand', '+919419111111') $$,
  'a driver can go live');

select is(
  (select count(*)::int from live_board()),
  1,
  'and appears on the board');

select is(
  (select seats_free from live_board()),
  4::smallint,
  'with the seats they said');

-- Going live again replaces rather than stacking.
select go_live((select id from vehicles limit 1), 'Kargil', 'Baroo', 3::smallint, 20, 'Main stand');

select is(
  (select count(*)::int from live_board()),
  1,
  'tapping Go live twice corrects the first entry rather than putting two vans on the '
  'board that do not exist');

select is(
  (select seats_free from live_board()),
  3::smallint,
  'and the newer count is the one shown');

-- ---------------------------------------------------------------------------
-- Changing the count while live
--
-- `go_live` refuses more seats than the van has, so `set_live_seats` must too — it is
-- the only way the number changes afterwards, and a rule that holds until the first
-- adjustment does not hold. Both ends clamp rather than raise: the caller is a stepper,
-- and there is no wrong number to report back to one, only a limit to stop at.
-- ---------------------------------------------------------------------------

select set_live_seats((select id from live_board()), 9::smallint);
select is(
  (select seats_free from live_board()),
  6::smallint,
  'a count above the van capacity is clamped to it, not published');

select set_live_seats((select id from live_board()), (-2)::smallint);
select is(
  (select seats_free from live_board()),
  0::smallint,
  'and below zero is clamped to zero — a full van, which the board shows as full');

select tests_become('00000000-0000-0000-0000-0000000e1103');
select throws_ok(
  $$ select set_live_seats((select id from live_board()), 4::smallint) $$,
  '42501',
  null,
  'a stranger cannot change the seats showing on someone else''s van');

-- Back to where the rest of this file expects it.
select tests_become('00000000-0000-0000-0000-0000000e1101');
select set_live_seats((select id from live_board()), 3::smallint);

-- ---------------------------------------------------------------------------
-- The number on the board is the published one, never the profile's
-- ---------------------------------------------------------------------------
select tests_become('00000000-0000-0000-0000-0000000e1102');

select is(
  (select contact from live_board()),
  null,
  'a driver who typed no number publishes none — the board does not fall back to the '
  'personal number on their profile');

select tests_become('00000000-0000-0000-0000-0000000e1101');
select go_live((select id from vehicles limit 1), 'Kargil', 'Baroo', 3::smallint,
  20, 'Main stand', '+919419111111');

select tests_become('00000000-0000-0000-0000-0000000e1102');
select is(
  (select contact from live_board()),
  '+919419111111',
  'and the number they did type is the one shown');

-- ---------------------------------------------------------------------------
-- Claiming — a courtesy, not a booking
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ select claim_live_seat((select id from live_board()), 'By the bridge') $$,
  'a passenger can say they are coming');

select is(
  (select claimed from live_board()),
  1,
  'the board subtracts it from what is showing');

select is(
  (select seats_free from live_board()),
  3::smallint,
  'while the number the driver typed is left alone — a claim is not a booking');

select lives_ok(
  $$ select claim_live_seat((select id from live_board()), 'By the shop') $$,
  'tapping again extends rather than failing — someone still walking is still coming');

select is(
  (select claimed from live_board()),
  1,
  'and does not count twice');

-- An expired claim stops counting, with nothing having swept.
reset role;
update live_claims set expires_at = now() - interval '1 minute';

select tests_become('00000000-0000-0000-0000-0000000e1102');
select is(
  (select claimed from live_board()),
  0,
  'a claim that ran out stops being subtracted, evaluated on read so no sweeper is '
  'needed');

-- ---------------------------------------------------------------------------
-- Expiry, and who may end a ride
-- ---------------------------------------------------------------------------
select tests_become('00000000-0000-0000-0000-0000000e1103');
select throws_ok(
  $$ select end_live((select id from live_board()), 'departed') $$,
  '42501',
  null,
  'a stranger cannot take a van off the board');

reset role;
update live_rides set expires_at = now() - interval '1 minute';

select tests_become('00000000-0000-0000-0000-0000000e1102');
select is(
  (select count(*)::int from live_board()),
  0,
  'and after 45 minutes the van drops off by itself — a stale board is worse than no '
  'board (spec 04.4)');

select * from finish();
rollback;
