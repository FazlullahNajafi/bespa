-- pgTAP: notices — who sees them, who may write them, and which kind is which
-- (spec 03.5, 09.3 risk 1b, 09.4 #2).
--
-- The two risks worth testing are asymmetric. A notice that fails to reach a village is
-- an inconvenience. A notice that reaches the WRONG village, or a village notice dressed
-- up as a government one, is a credibility failure Bespa would not recover from in a
-- district this small.
--
-- Run: npm run db:test

begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Fixture: two villages under the Kargil block, a member in each, and an admin
-- of the first village only.
-- ---------------------------------------------------------------------------

insert into geo_units (id, type, parent_id, slug, name_en)
select '00000000-0000-0000-0000-0000000000e0', 'village', b.id, 'testvillage_e', 'Test Village E'
  from geo_units b where b.path = 'ladakh.kargil.kargil'::ltree;

insert into geo_units (id, type, parent_id, slug, name_en)
select '00000000-0000-0000-0000-0000000000f0', 'village', b.id, 'testvillage_f', 'Test Village F'
  from geo_units b where b.path = 'ladakh.kargil.kargil'::ltree;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rukhsana@example.test', '{"full_name":"Rukhsana"}'),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'mehdi@example.test', '{"full_name":"Mehdi"}'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'sarpanch@example.test', '{"full_name":"Sarpanch E"}');

update profiles set village_id = '00000000-0000-0000-0000-0000000000e0'
 where id in ('00000000-0000-0000-0000-0000000000e1',
              '00000000-0000-0000-0000-0000000000e2');
update profiles set village_id = '00000000-0000-0000-0000-0000000000f0'
 where id = '00000000-0000-0000-0000-0000000000f1';

-- The admin of village E. Note `panchayat_admin` is a role, not the office of sarpanch —
-- spec 09.3 risk 1b expects it granted to whoever actually writes.
update profiles set roles = '{member,panchayat_admin}'::user_role[],
                    panchayat_id = '00000000-0000-0000-0000-0000000000e0'
 where id = '00000000-0000-0000-0000-0000000000e2';

create or replace function tests_become(uid uuid) returns void
language plpgsql as $$
begin
  execute format('set local role authenticated');
  execute format('set local request.jwt.claims = %L', json_build_object('sub', uid, 'role', 'authenticated')::text);
end $$;

-- ---------------------------------------------------------------------------
-- Publishing
-- ---------------------------------------------------------------------------
select tests_become('00000000-0000-0000-0000-0000000000e2');

select lives_ok(
  $$ select publish_notice('00000000-0000-0000-0000-0000000000e0',
                           'Water supply cut on Friday',
                           'The main line is being repaired between 9am and 2pm.') $$,
  'a village admin can publish to their own village');

select is(
  (select published_by from notices where title = 'Water supply cut on Friday'),
  '00000000-0000-0000-0000-0000000000e2'::uuid,
  'the notice is attributed to whoever published it, not to whoever the client claimed');

select is(
  (select source from notices where title = 'Water supply cut on Friday'),
  'local', 'and it is a local notice — the app cannot publish as an official source');

select is(
  (select geo_path::text from notices where title = 'Water supply cut on Friday'),
  'ladakh.kargil.kargil.testvillage_e',
  'geo_path is derived from the geo unit, never supplied');

-- The containment rule cuts both ways: an admin may reach their own subtree and nothing
-- above it. Publishing to the block would reach every village in it.
select throws_ok(
  $$ select publish_notice((select id from geo_units where path = 'ladakh.kargil.kargil'::ltree),
                           'Everyone in the block', 'Should be refused.') $$,
  '42501', null,
  'a village admin CANNOT publish to the block above them');

select tests_become('00000000-0000-0000-0000-0000000000e1');

select throws_ok(
  $$ select publish_notice('00000000-0000-0000-0000-0000000000e0',
                           'From an ordinary member', 'Should be refused.') $$,
  '42501', null,
  'an ordinary member cannot publish at all');

select throws_ok(
  $$ select import_official_notice('lahdc', 'ref-1', 'https://kargil.nic.in/x.pdf',
       '00000000-0000-0000-0000-0000000000e0', 'Fake official notice') $$,
  '42501', null,
  'and cannot reach the importer — only service_role may write an official notice');

-- ---------------------------------------------------------------------------
-- Who sees what
-- ---------------------------------------------------------------------------
-- Becoming the other member first is the whole point of this pair, and leaving it out
-- made the assertion pass against the publisher's own village — a test that proved
-- nothing while looking like it proved the most important thing here.
select tests_become('00000000-0000-0000-0000-0000000000f1');
select is(
  (select count(*)::int from notices where title = 'Water supply cut on Friday'),
  0, 'a member of ANOTHER village does not see a village notice');

select tests_become('00000000-0000-0000-0000-0000000000e1');
select is(
  (select count(*)::int from notices where title = 'Water supply cut on Friday'),
  1, 'a member of the same village does see it');

-- ---------------------------------------------------------------------------
-- The mirror: district scope reaches every village beneath it
-- ---------------------------------------------------------------------------
reset role;
select import_official_notice(
  'lahdc', 'https://kargil.nic.in/notice/sangrah.pdf',
  'https://kargil.nic.in/notice/sangrah.pdf',
  (select id from geo_units where path = 'ladakh.kargil'::ltree),
  'PRELIMINARY NOTIFICATION - Sangrah village Sankoo Tehsil Kargil');

select tests_become('00000000-0000-0000-0000-0000000000f1');
select is(
  (select count(*)::int from notices where source = 'lahdc'),
  1, 'a district notice reaches a village several levels beneath it');

select is(
  (select body from notices where source = 'lahdc'),
  '', 'a mirrored notice carries no body — the words stay in the linked original');

-- Re-running the scraper must refresh, never duplicate.
reset role;
select import_official_notice(
  'lahdc', 'https://kargil.nic.in/notice/sangrah.pdf',
  'https://kargil.nic.in/notice/sangrah.pdf',
  (select id from geo_units where path = 'ladakh.kargil'::ltree),
  'PRELIMINARY NOTIFICATION - Sangrah village Sankoo Tehsil Kargil (corrected)');

select is(
  (select count(*)::int from notices where source = 'lahdc'),
  1, 'importing the same notice again updates it in place rather than duplicating');

select is(
  (select title from notices where source = 'lahdc'),
  'PRELIMINARY NOTIFICATION - Sangrah village Sankoo Tehsil Kargil (corrected)',
  'and the refreshed title wins');

-- ---------------------------------------------------------------------------
-- The kill switch (spec 09.4 #2)
-- ---------------------------------------------------------------------------
update notice_sources set enabled = false where key = 'lahdc';

select tests_become('00000000-0000-0000-0000-0000000000f1');
select is(
  (select count(*)::int from notices where source = 'lahdc'),
  0, 'disabling a source hides its notices at once, with no release');

reset role;
update notice_sources set enabled = true where key = 'lahdc';

-- ---------------------------------------------------------------------------
-- An admin may correct their own notice, and may not forge an official one
-- ---------------------------------------------------------------------------
select tests_become('00000000-0000-0000-0000-0000000000e2');

select lives_ok(
  $$ update notices set body = 'Corrected: 10am to 3pm.'
      where title = 'Water supply cut on Friday' $$,
  'the publishing office can correct its own notice');

select throws_ok(
  $$ update notices set source = 'lahdc'
      where title = 'Water supply cut on Friday' $$,
  '42501', null,
  'but CANNOT restamp it as official — a column grant, not a policy, is what stops this');

select throws_ok(
  $$ update notices set geo_unit_id = (select id from geo_units where path = 'ladakh.kargil'::ltree)
      where title = 'Water supply cut on Friday' $$,
  '42501', null,
  'nor move it up to the district, which would reach every village in Kargil');

select * from finish();
rollback;
