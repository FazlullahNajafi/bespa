-- pgTAP: the onboarding shortcuts — finding a village from a coordinate, and the
-- occupation step (spec 02.2, 03.6).
--
-- Both are about not being confidently wrong. `geo_nearest` proposes a tenancy, and
-- tenancy decides what a user can see, so the thing worth asserting is not that it finds
-- a village but that it REFUSES to when the nearest one it knows about is too far to be
-- believable. `set_my_occupation` must record that the question was asked without ever
-- destroying an answer already given.
--
-- Run: npm run db:test

begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Fixture. Gongma Minjee and the Kargil block carry real seeded centroids, so the
-- coordinates below are the ones a phone standing there would actually report.
-- ---------------------------------------------------------------------------

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'zahra@example.test', '{"full_name":"Zahra"}');

create or replace function tests_become(uid uuid) returns void
language plpgsql as $$
begin
  execute format('set local role authenticated');
  execute format('set local request.jwt.claims = %L', json_build_object('sub', uid, 'role', 'authenticated')::text);
end $$;

-- ---------------------------------------------------------------------------
-- geo_nearest
-- ---------------------------------------------------------------------------
select tests_become('00000000-0000-0000-0000-0000000000c1');

-- 30 m from the seeded centroid: a phone in the village.
select is(
  (select name_en from geo_nearest(34.4826, 76.0863) where type = 'village'),
  'Gongma Minjee',
  'standing in Gongma Minjee resolves to Gongma Minjee');

select is(
  (select count(*)::int from geo_nearest(34.4826, 76.0863)),
  4,
  'the whole chain comes back in one call: UT, district, block, village');

select is(
  -- No ORDER BY: array_agg over a function scan aggregates in the order the function
  -- emitted, which is exactly the contract being asserted.
  (select array_agg(type::text) from geo_nearest(34.4826, 76.0863)),
  array['ut', 'district', 'block', 'village'],
  'and it comes back root-first, which is the order the picker walks');

select ok(
  (select distance_m from geo_nearest(34.4826, 76.0863) where type = 'village') < 100,
  'the matched row carries its distance in metres');

select is(
  (select count(*)::int from geo_nearest(34.4826, 76.0863) where distance_m is not null),
  1,
  'and only the matched row does — an ancestor centroid describes nothing useful');

-- Delhi. Nothing within 30 km, so the honest answer is nothing at all rather than the
-- least-distant village in the district.
select is(
  (select count(*)::int from geo_nearest(28.6139, 77.2090)),
  0,
  'a coordinate outside the district resolves to nothing');

-- A point near Kargil with the locality radius forced to a metre, so nothing can
-- satisfy it: the nearest block is still a useful answer, because it narrows the walk to
-- a handful of villages instead of naming one.
select is(
  (select (array_agg(type::text))[array_length(array_agg(type::text), 1)]
     from geo_nearest(34.5600, 76.1400, 0.001)),
  'block',
  'with no village close enough, the nearest block is returned instead of a wrong village');

-- The point of the fallback. Akchamal is 2.2 km from here and Kargil town is 0.8 km, and
-- neither may be proposed once they are outside the believable radius: the picker
-- pre-selects whatever comes back, so a far-off match is a confident wrong answer.
select ok(
  (select bool_and(type not in ('village', 'town')) from geo_nearest(34.5600, 76.1400, 0.001)),
  'and no village or town is proposed in that case, so nobody is given a wrong tenancy');

-- Kargil town. It was missing from the geography until migration 20261021200000, and
-- the symptom was this: standing in the district headquarters, the shortcut proposed
-- Akchamal, a village 2.2 km away in another block, because that was the nearest thing
-- the table held. A regression here is a user given the wrong tenancy on their first
-- screen.
select is(
  (select name_en from geo_nearest(34.5539, 76.1349) where type = 'town'),
  'Kargil',
  'standing in Kargil town resolves to Kargil town, not to the nearest village');

select is(
  (select count(*)::int from geo_nearest(34.5539, 76.1349) where type = 'village'),
  0,
  'and no village is proposed over it');

-- ---------------------------------------------------------------------------
-- set_my_occupation
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ select set_my_occupation('farmer') $$,
  'a user can record their own occupation');

select is(
  (select occupation from profiles where id = '00000000-0000-0000-0000-0000000000c1'),
  'farmer',
  'which is stored as given');

select ok(
  (select occupation_asked_at is not null from profiles
    where id = '00000000-0000-0000-0000-0000000000c1'),
  'and the step is marked as asked, so it is not asked again');

-- Skipping must not be a way to lose an answer: the step is reachable by someone who
-- already filled it in from profile edit.
select lives_ok(
  $$ select set_my_occupation(null) $$,
  'skipping the step is allowed');

select is(
  (select occupation from profiles where id = '00000000-0000-0000-0000-0000000000c1'),
  'farmer',
  'and leaves an occupation already given untouched');

select * from finish();
rollback;
