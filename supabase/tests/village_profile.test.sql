-- pgTAP: the village page and its statistics (spec 03.1 §3, §5).
--
-- The assertions that earn their place here are about the two rules that the UI would
-- otherwise have to remember.
--
-- **A figure cannot be published without a source.** Spec 03.1 says unsourced figures are
-- not shown; refusing the write is the only place that rule holds for every reader.
--
-- **The year is part of the key.** This is the design the 2026 census needs: adding a new
-- census year must sit *beside* the 2011 figure, not on top of it, so the screen can move
-- forward while the old number stays readable. A test that only ever writes one year
-- would pass against a schema that quietly overwrites, which is the whole thing being
-- guarded against.
--
-- Run: npm run db:test

begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Fixture: two villages, a villager and an admin in the first, a neighbour
-- ---------------------------------------------------------------------------

insert into geo_units (id, type, parent_id, slug, name_en)
select '00000000-0000-0000-0000-0000000c1100'::uuid, 'village', b.id, 'statvillage_one', 'Stat Village One'
  from geo_units b where b.path = 'ladakh.kargil.kargil'::ltree;

insert into geo_units (id, type, parent_id, slug, name_en)
select '00000000-0000-0000-0000-0000000c2200'::uuid, 'village', b.id, 'statvillage_two', 'Stat Village Two'
  from geo_units b where b.path = 'ladakh.kargil.kargil'::ltree;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000c1101', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'statvillager@example.test', '{"full_name":"Villager"}'),
  ('00000000-0000-0000-0000-0000000c1102', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'statadmin@example.test', '{"full_name":"Stat Admin"}'),
  ('00000000-0000-0000-0000-0000000c2201', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'statnext@example.test', '{"full_name":"Neighbour"}');

update profiles set village_id = '00000000-0000-0000-0000-0000000c1100'
 where id in ('00000000-0000-0000-0000-0000000c1101',
              '00000000-0000-0000-0000-0000000c1102');
update profiles set village_id = '00000000-0000-0000-0000-0000000c2200'
 where id = '00000000-0000-0000-0000-0000000c2201';

insert into admin_grants (user_id, geo_unit_id, role)
values ('00000000-0000-0000-0000-0000000c1102',
        '00000000-0000-0000-0000-0000000c1100', 'panchayat_admin');

create or replace function tests_become(uid uuid) returns void
language plpgsql as $$
begin
  execute format('set local role authenticated');
  execute format('set local request.jwt.claims = %L', json_build_object('sub', uid, 'role', 'authenticated')::text);
end $$;

-- ---------------------------------------------------------------------------
-- The profile: who may write it
-- ---------------------------------------------------------------------------
select tests_become('00000000-0000-0000-0000-0000000c1101');

select throws_ok(
  $$ select set_village_profile('00000000-0000-0000-0000-0000000c1100',
       'I live here so I will describe it') $$,
  '42501',
  null,
  'living in a village does not let you write its description');

select tests_become('00000000-0000-0000-0000-0000000c2201');
select throws_ok(
  $$ select set_village_profile('00000000-0000-0000-0000-0000000c1100', 'Not my village') $$,
  '42501',
  null,
  'nor does living somewhere else');

select tests_become('00000000-0000-0000-0000-0000000c1102');

select lives_ok(
  $$ select set_village_profile('00000000-0000-0000-0000-0000000c1100',
       'A village on the Suru, about four hundred households.',
       'Settled around the old mosque; the bridge dates from 1974.') $$,
  'the village admin can');

select is(
  (select description from village_profiles
    where geo_unit_id = '00000000-0000-0000-0000-0000000c1100'),
  'A village on the Suru, about four hundred households.',
  'and it is stored as written');

select is(
  (select updated_by from village_profiles
    where geo_unit_id = '00000000-0000-0000-0000-0000000c1100'),
  '00000000-0000-0000-0000-0000000c1102'::uuid,
  'stamped with whoever wrote it, not with whoever the client claimed');

select throws_ok(
  $$ select set_village_profile('00000000-0000-0000-0000-0000000c1100', 'x', null,
       '00000000-0000-0000-0000-0000000c1100/00000000-0000-0000-0000-0000000c1101/stolen.jpg') $$,
  '22023',
  null,
  'a cover photo cannot be someone else''s object');

-- A second save with no photo must not wipe the one already there: the edit screen sends
-- the text on every save and the photo only when it changed.
select set_village_profile('00000000-0000-0000-0000-0000000c1100', 'First text', null,
  '00000000-0000-0000-0000-0000000c1100/00000000-0000-0000-0000-0000000c1102/cover.jpg');
select set_village_profile('00000000-0000-0000-0000-0000000c1100', 'Second text');

select is(
  (select cover_path from village_profiles
    where geo_unit_id = '00000000-0000-0000-0000-0000000c1100'),
  '00000000-0000-0000-0000-0000000c1100/00000000-0000-0000-0000-0000000c1102/cover.jpg',
  'saving the text again leaves the cover photo alone');

select is(
  (select description from village_profiles
    where geo_unit_id = '00000000-0000-0000-0000-0000000c1100'),
  'Second text',
  'while the text itself is replaced');

-- ---------------------------------------------------------------------------
-- The profile: who may read it
-- ---------------------------------------------------------------------------
select tests_become('00000000-0000-0000-0000-0000000c1101');
select is(
  (select count(*)::int from village_profiles
    where geo_unit_id = '00000000-0000-0000-0000-0000000c1100'),
  1,
  'anyone in the village reads it');

select tests_become('00000000-0000-0000-0000-0000000c2201');
select is(
  (select count(*)::int from village_profiles
    where geo_unit_id = '00000000-0000-0000-0000-0000000c1100'),
  0,
  'and the next village over does not');

-- ---------------------------------------------------------------------------
-- Stats: the source rule
-- ---------------------------------------------------------------------------
select tests_become('00000000-0000-0000-0000-0000000c1102');

select throws_ok(
  $$ select set_village_stat('00000000-0000-0000-0000-0000000c1100',
       'population_total', 2140, 2011::smallint, '   ') $$,
  '22023',
  null,
  'a figure with no source is refused — spec 03.1 will not show one');

select lives_ok(
  $$ select set_village_stat('00000000-0000-0000-0000-0000000c1100',
       'population_total', 2140, 2011::smallint, 'Census of India 2011') $$,
  'with a source it goes in');

select throws_ok(
  $$ select set_village_stat('00000000-0000-0000-0000-0000000c1100',
       'Population Total', 2140, 2011::smallint, 'Census of India 2011') $$,
  '23514',
  null,
  'and a second spelling of the same metric is refused, so one figure cannot become two');

-- ---------------------------------------------------------------------------
-- Stats: the year is part of the key — the 2026 census case
-- ---------------------------------------------------------------------------
select set_village_stat('00000000-0000-0000-0000-0000000c1100',
  'population_total', 2410, 2026::smallint, 'Census of India 2026');

select is(
  (select count(*)::int from village_stats
    where geo_unit_id = '00000000-0000-0000-0000-0000000c1100'
      and metric_key = 'population_total'),
  2,
  'a new census year sits beside the old figure rather than on top of it');

select is(
  (select value from village_stats
    where geo_unit_id = '00000000-0000-0000-0000-0000000c1100'
      and metric_key = 'population_total' and year = 2011),
  2140::numeric,
  'the 2011 figure is still readable afterwards');

select is(
  (select year from village_stats
    where geo_unit_id = '00000000-0000-0000-0000-0000000c1100'
      and metric_key = 'population_total'
    order by year desc limit 1),
  2026::smallint,
  'and "the current figure" is just the newest year');

-- Correcting a figure already published for a year replaces it, which is the other half:
-- a typo must be fixable without inventing a year.
select set_village_stat('00000000-0000-0000-0000-0000000c1100',
  'population_total', 2415, 2026::smallint, 'Census of India 2026');

select is(
  (select value from village_stats
    where geo_unit_id = '00000000-0000-0000-0000-0000000c1100'
      and metric_key = 'population_total' and year = 2026),
  2415::numeric,
  'and re-publishing the same metric and year corrects it in place');

select is(
  (select count(*)::int from village_stats
    where geo_unit_id = '00000000-0000-0000-0000-0000000c1100'
      and metric_key = 'population_total'),
  2,
  'without adding a third row');

-- ---------------------------------------------------------------------------
-- Stats: permission and visibility
-- ---------------------------------------------------------------------------
select tests_become('00000000-0000-0000-0000-0000000c1101');

select throws_ok(
  $$ select set_village_stat('00000000-0000-0000-0000-0000000c1100',
       'households', 400, 2011::smallint, 'My own estimate') $$,
  '42501',
  null,
  'a villager cannot publish a figure about their village');

select is(
  (select count(*)::int from village_stats
    where geo_unit_id = '00000000-0000-0000-0000-0000000c1100'),
  2,
  'but they can read the ones that were published');

select tests_become('00000000-0000-0000-0000-0000000c2201');
select is(
  (select count(*)::int from village_stats
    where geo_unit_id = '00000000-0000-0000-0000-0000000c1100'),
  0,
  'and the next village over sees none of them');

select throws_ok(
  $$ select delete_village_stat('00000000-0000-0000-0000-0000000c1100',
       'population_total', 2011::smallint) $$,
  '42501',
  null,
  'nor can an outsider delete one');

select tests_become('00000000-0000-0000-0000-0000000c1102');
select lives_ok(
  $$ select delete_village_stat('00000000-0000-0000-0000-0000000c1100',
       'population_total', 2011::smallint) $$,
  'while the admin can withdraw a figure they published');

select * from finish();
rollback;
