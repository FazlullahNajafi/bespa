-- pgTAP: places and their moderation (spec 03.2).
--
-- Mostly the same shape as the gallery suite, because the moderation rules are the same
-- and the thing worth asserting is still what is NOT shown. Two things here are new and
-- carry most of the assertions.
--
-- **The 150 m duplicate rule.** Spec 03.2 says show "is this the same as X?" before
-- allowing a new entry — a warning, not a refusal. So the test has to prove both halves:
-- that the server stops a submission the submitter has not been warned about, and that it
-- accepts the very same submission once they say they know.
--
-- **The point is required and generated back as numbers.** A place with no coordinate
-- cannot answer "where is it", and a coordinate the client cannot read is no better.
--
-- Run: npm run db:test

begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Fixture: two villages, a contributor, a bystander and an admin in the first,
-- a member of the second.
-- ---------------------------------------------------------------------------

insert into geo_units (id, type, parent_id, slug, name_en)
select '00000000-0000-0000-0000-0000000b1100'::uuid, 'village', b.id, 'placevillage_one', 'Place Village One'
  from geo_units b where b.path = 'ladakh.kargil.kargil'::ltree;

insert into geo_units (id, type, parent_id, slug, name_en)
select '00000000-0000-0000-0000-0000000b2200'::uuid, 'village', b.id, 'placevillage_two', 'Place Village Two'
  from geo_units b where b.path = 'ladakh.kargil.kargil'::ltree;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000b1101', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'placer@example.test', '{"full_name":"Placer"}'),
  ('00000000-0000-0000-0000-0000000b1102', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'placeby@example.test', '{"full_name":"Bystander"}'),
  ('00000000-0000-0000-0000-0000000b1103', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'placeadmin@example.test', '{"full_name":"Place Admin"}'),
  ('00000000-0000-0000-0000-0000000b2201', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'placenext@example.test', '{"full_name":"Neighbour"}');

update profiles set village_id = '00000000-0000-0000-0000-0000000b1100'
 where id in ('00000000-0000-0000-0000-0000000b1101',
              '00000000-0000-0000-0000-0000000b1102',
              '00000000-0000-0000-0000-0000000b1103');
update profiles set village_id = '00000000-0000-0000-0000-0000000b2200'
 where id = '00000000-0000-0000-0000-0000000b2201';

insert into admin_grants (user_id, geo_unit_id, role)
values ('00000000-0000-0000-0000-0000000b1103',
        '00000000-0000-0000-0000-0000000b1100', 'panchayat_admin');

create or replace function tests_become(uid uuid) returns void
language plpgsql as $$
begin
  execute format('set local role authenticated');
  execute format('set local request.jwt.claims = %L', json_build_object('sub', uid, 'role', 'authenticated')::text);
end $$;

-- Kargil town, near enough. At this latitude 0.001° of latitude is about 111 m, which is
-- what makes the pairs below land either side of the 150 m line by a clear margin rather
-- than by a rounding error.
--   base          34.5539, 76.1349
--   ~111 m north  34.5549   -> inside 150 m
--   ~1.1 km north 34.5639   -> outside

-- ---------------------------------------------------------------------------
-- Submitting
-- ---------------------------------------------------------------------------
select tests_become('00000000-0000-0000-0000-0000000b1101');

select lives_ok(
  $$ select submit_place(
       '00000000-0000-0000-0000-0000000b1100', 'school', 'Government High School',
       34.5539, 76.1349,
       array['00000000-0000-0000-0000-0000000b1100/00000000-0000-0000-0000-0000000b1101/s1.jpg'],
       'The boys'' wing, rebuilt in 2019') $$,
  'a villager can add a place in their own village');

select is(
  (select status::text from places where name_en = 'Government High School'),
  'pending',
  'and it starts pending, because spec 03.2 moderates before showing');

select is(
  (select submitted_by from places where name_en = 'Government High School'),
  '00000000-0000-0000-0000-0000000b1101'::uuid,
  'credited to whoever sent it, not to whoever the client claimed');

-- Spec 03.2 reads the coordinate back as a number on every list row and detail screen.
select ok(
  (select abs(lat - 34.5539) < 0.0001 and abs(lon - 76.1349) < 0.0001
     from places where name_en = 'Government High School'),
  'the coordinate comes back as plain numbers, not as WKB hex to parse on the phone');

select throws_ok(
  $$ select submit_place(
       '00000000-0000-0000-0000-0000000b1100', 'school', 'No Photo School',
       34.5539, 76.1349, array[]::text[]) $$,
  '22023',
  null,
  'a place with no photo is refused — spec 03.2 makes the first one mandatory');

select throws_ok(
  $$ select submit_place(
       '00000000-0000-0000-0000-0000000b1100', 'school', 'Too Many',
       34.5539, 76.1349,
       array['00000000-0000-0000-0000-0000000b1100/00000000-0000-0000-0000-0000000b1101/1.jpg',
             '00000000-0000-0000-0000-0000000b1100/00000000-0000-0000-0000-0000000b1101/2.jpg',
             '00000000-0000-0000-0000-0000000b1100/00000000-0000-0000-0000-0000000b1101/3.jpg',
             '00000000-0000-0000-0000-0000000b1100/00000000-0000-0000-0000-0000000b1101/4.jpg',
             '00000000-0000-0000-0000-0000000b1100/00000000-0000-0000-0000-0000000b1101/5.jpg',
             '00000000-0000-0000-0000-0000000b1100/00000000-0000-0000-0000-0000000b1101/6.jpg']) $$,
  '22023',
  null,
  'and six is refused as well, so one submission cannot fill the bucket');

select throws_ok(
  $$ select submit_place(
       '00000000-0000-0000-0000-0000000b1100', 'school', 'Stolen Photo',
       34.5539, 76.1349,
       array['00000000-0000-0000-0000-0000000b1100/00000000-0000-0000-0000-0000000b1102/x.jpg']) $$,
  '22023',
  null,
  'a place cannot be attached to someone else''s photo');

select throws_ok(
  $$ select submit_place(
       '00000000-0000-0000-0000-0000000b2200', 'school', 'Next Village School',
       34.5539, 76.1349,
       array['00000000-0000-0000-0000-0000000b2200/00000000-0000-0000-0000-0000000b1101/y.jpg']) $$,
  '42501',
  null,
  'and a villager cannot add a place to a village they do not live in');

-- ---------------------------------------------------------------------------
-- Who can see a pending place
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from places where name_en = 'Government High School'),
  1,
  'the submitter sees their own pending place, so "did it send?" has an answer');

select tests_become('00000000-0000-0000-0000-0000000b1102');
select is(
  (select count(*)::int from places where name_en = 'Government High School'),
  0,
  'another villager does not — pending means not shown');

select tests_become('00000000-0000-0000-0000-0000000b1103');
select is(
  (select count(*)::int from places where name_en = 'Government High School'),
  1,
  'the village admin does, or there is nothing to moderate');

select tests_become('00000000-0000-0000-0000-0000000b2201');
select is(
  (select count(*)::int from places where name_en = 'Government High School'),
  0,
  'and the next village over sees nothing at any stage');

-- ---------------------------------------------------------------------------
-- Reviewing
-- ---------------------------------------------------------------------------
select tests_become('00000000-0000-0000-0000-0000000b1102');
select throws_ok(
  $$ select review_place(
       (select id from places where name_en = 'Government High School'), true) $$,
  '42501',
  null,
  'a villager with no grant cannot approve a place');

select tests_become('00000000-0000-0000-0000-0000000b1103');

select throws_ok(
  $$ select review_place(
       (select id from places where name_en = 'Government High School'), false, '  ') $$,
  '22023',
  null,
  'a rejection with no reason is refused — an unexplained one is a grievance');

select lives_ok(
  $$ select review_place(
       (select id from places where name_en = 'Government High School'), true) $$,
  'the village admin can approve it');

select tests_become('00000000-0000-0000-0000-0000000b1102');
select is(
  (select count(*)::int from places where name_en = 'Government High School'),
  1,
  'and once approved the village can see it');

-- ---------------------------------------------------------------------------
-- The 150 m same-category duplicate rule (spec 03.2)
-- ---------------------------------------------------------------------------
select tests_become('00000000-0000-0000-0000-0000000b1101');

select throws_ok(
  $$ select submit_place(
       '00000000-0000-0000-0000-0000000b1100', 'school', 'GHS Kargil',
       34.5549, 76.1349,
       array['00000000-0000-0000-0000-0000000b1100/00000000-0000-0000-0000-0000000b1101/s2.jpg']) $$,
  'PT409',
  null,
  'a second school 111 m from the first stops, so the submitter is shown what is there');

select is(
  (select count(*)::int from places where name_en = 'GHS Kargil'),
  0,
  'and nothing was written while the question was being asked');

-- Same submission, now with the submitter saying they have seen the other one. This is
-- the half that is easy to leave out, and without it the rule is a refusal rather than
-- the warning the spec asks for.
select lives_ok(
  $$ select submit_place(
       '00000000-0000-0000-0000-0000000b1100', 'school', 'GHS Kargil',
       34.5549, 76.1349,
       array['00000000-0000-0000-0000-0000000b1100/00000000-0000-0000-0000-0000000b1101/s2.jpg'],
       null, null, null, null, true) $$,
  'and goes through once they say it is a different school');

select lives_ok(
  $$ select submit_place(
       '00000000-0000-0000-0000-0000000b1100', 'mosque', 'Jamia Masjid',
       34.5539, 76.1349,
       array['00000000-0000-0000-0000-0000000b1100/00000000-0000-0000-0000-0000000b1101/m1.jpg']) $$,
  'a mosque at the school''s exact coordinate is not a duplicate — the rule is per category');

select lives_ok(
  $$ select submit_place(
       '00000000-0000-0000-0000-0000000b1100', 'school', 'Primary School Lower',
       34.5639, 76.1349,
       array['00000000-0000-0000-0000-0000000b1100/00000000-0000-0000-0000-0000000b1101/s3.jpg']) $$,
  'and a school 1.1 km away is never asked about');

-- A pending place is not what the prompt is built from: it has not been shown to anyone,
-- so naming it would leak an unreviewed submission into someone else's warning.
select is(
  (select count(*)::int
     from places_near('school', 34.5549, 76.1349)),
  1,
  'places_near names only approved places, not whatever is sitting in the queue');

-- ---------------------------------------------------------------------------
-- Withdrawing
-- ---------------------------------------------------------------------------
select tests_become('00000000-0000-0000-0000-0000000b1102');
select throws_ok(
  $$ select withdraw_place(
       (select id from places where name_en = 'Government High School')) $$,
  '42501',
  null,
  'a bystander cannot withdraw someone else''s place');

select tests_become('00000000-0000-0000-0000-0000000b1101');
select is(
  withdraw_place((select id from places where name_en = 'Government High School')),
  array['00000000-0000-0000-0000-0000000b1100/00000000-0000-0000-0000-0000000b1101/s1.jpg'],
  'its submitter can, and gets the photo paths back so the bytes can go too');

select * from finish();
rollback;
