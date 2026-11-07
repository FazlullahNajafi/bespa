-- pgTAP: driver verification (spec 04.5, design `screens-driver-verify`).
--
-- Most of this file is about **who may look at a licence**. A commercial driving licence
-- carries a full name, an address, a date of birth and a licence number. The gallery
-- bucket is readable by a whole village, which is right for a photograph of a bridge and
-- catastrophic for this, so the assertions below are mostly refusals: not the village,
-- not a panchayat admin, not another driver.
--
-- The rest is the gate. Spec 04.5: "Unverified drivers may not create trips or go live."
-- A gate nobody tests is a gate someone removes.
--
-- Run: npm run db:test

begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

set search_path = public, extensions;

insert into geo_units (id, type, parent_id, slug, name_en)
select '00000000-0000-0000-0000-0000000f1100'::uuid, 'village', b.id, 'drvvillage_one', 'Driver Village'
  from geo_units b where b.path = 'ladakh.kargil.kargil'::ltree;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000f1101', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'applicant@example.test', '{"full_name":"Applicant"}'),
  ('00000000-0000-0000-0000-0000000f1102', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'nosy@example.test', '{"full_name":"Neighbour"}'),
  ('00000000-0000-0000-0000-0000000f1103', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'panchayat@example.test', '{"full_name":"Village Admin"}'),
  ('00000000-0000-0000-0000-0000000f1104', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'reviewer@example.test', '{"full_name":"District Admin"}');

update profiles set village_id = '00000000-0000-0000-0000-0000000f1100'
 where id in ('00000000-0000-0000-0000-0000000f1101',
              '00000000-0000-0000-0000-0000000f1102',
              '00000000-0000-0000-0000-0000000f1103',
              '00000000-0000-0000-0000-0000000f1104');

-- A panchayat admin of the applicant's own village: the most plausible wrong answer to
-- "who reviews this", and the one the policy has to refuse.
insert into admin_grants (user_id, geo_unit_id, role)
values ('00000000-0000-0000-0000-0000000f1103',
        '00000000-0000-0000-0000-0000000f1100', 'panchayat_admin');

update profiles set roles = array['member', 'district_admin']::user_role[]
 where id = '00000000-0000-0000-0000-0000000f1104';

create or replace function tests_become(uid uuid) returns void
language plpgsql as $$
begin
  execute format('set local role authenticated');
  execute format('set local request.jwt.claims = %L', json_build_object('sub', uid, 'role', 'authenticated')::text);
end $$;

-- ---------------------------------------------------------------------------
-- Submitting
-- ---------------------------------------------------------------------------
select tests_become('00000000-0000-0000-0000-0000000f1101');

select throws_ok(
  $$ select submit_driver_document('licence',
       '00000000-0000-0000-0000-0000000f1102/licence/stolen.jpg') $$,
  '22023',
  null,
  'a document cannot be filed against somebody else''s upload');

select lives_ok(
  $$ select submit_driver_document('licence',
       '00000000-0000-0000-0000-0000000f1101/licence/dl.jpg') $$,
  'a driver can submit their licence');

select is(
  (select status::text from driver_documents
    where user_id = '00000000-0000-0000-0000-0000000f1101' and kind = 'licence'),
  'pending',
  'and it waits for review rather than counting itself verified');

select is(
  is_verified_driver('00000000-0000-0000-0000-0000000f1101'),
  false,
  'uploading is not being verified');

-- ---------------------------------------------------------------------------
-- The gate (spec 04.5)
-- ---------------------------------------------------------------------------
select save_vehicle('xylo', 6::smallint, 'JK07 9999');

select throws_ok(
  $$ select create_trip((select id from vehicles limit 1), 'Kargil', 'Leh',
       (current_date + 2), 1200, 4::smallint) $$,
  'PT403',
  null,
  'an unverified driver cannot post a trip');

select throws_ok(
  $$ select go_live((select id from vehicles limit 1), 'Kargil', 'Baroo', 4::smallint) $$,
  'PT403',
  null,
  'nor go live');

-- ---------------------------------------------------------------------------
-- Who may read a licence
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from driver_documents),
  1,
  'the applicant reads their own documents');

select tests_become('00000000-0000-0000-0000-0000000f1102');
select is(
  (select count(*)::int from driver_documents),
  0,
  'a neighbour in the same village reads none — a licence carries a name, an address '
  'and a date of birth, and the village has no business with it');

select tests_become('00000000-0000-0000-0000-0000000f1103');
select is(
  (select count(*)::int from driver_documents),
  0,
  'and neither does the panchayat admin of that village: a driving licence is a '
  'district matter, not a village one');

select throws_ok(
  $$ select review_driver_document('00000000-0000-0000-0000-0000000f1101',
       'licence', true) $$,
  '42501',
  null,
  'nor can they approve it');

select tests_become('00000000-0000-0000-0000-0000000f1104');
select is(
  (select count(*)::int from driver_documents),
  1,
  'the district reviewer does');

select is(
  (select count(*)::int from driver_review_queue()),
  1,
  'and it is in their queue');

-- ---------------------------------------------------------------------------
-- Reviewing
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ select review_driver_document('00000000-0000-0000-0000-0000000f1101',
       'licence', false, '  ') $$,
  '22023',
  null,
  'a refusal needs a reason — the driver reads it and has to know what to send instead');

select lives_ok(
  $$ select review_driver_document('00000000-0000-0000-0000-0000000f1101',
       'licence', false, 'The photo is too dark to read') $$,
  'a district reviewer can refuse it');

select is(
  is_verified_driver('00000000-0000-0000-0000-0000000f1101'),
  false,
  'a refused licence does not verify anybody');

-- Re-uploading clears the old decision, which is the design's "Re-upload".
select tests_become('00000000-0000-0000-0000-0000000f1101');
select submit_driver_document('licence', '00000000-0000-0000-0000-0000000f1101/licence/dl2.jpg');

select is(
  (select reject_reason from driver_documents
    where user_id = '00000000-0000-0000-0000-0000000f1101' and kind = 'licence'),
  null,
  're-uploading clears the old reason, so a document in review does not still show why '
  'the last one was refused');

select tests_become('00000000-0000-0000-0000-0000000f1104');
select review_driver_document('00000000-0000-0000-0000-0000000f1101', 'licence', true);

select is(
  is_verified_driver('00000000-0000-0000-0000-0000000f1101'),
  true,
  'an approved licence verifies the driver');

select tests_become('00000000-0000-0000-0000-0000000f1101');
select lives_ok(
  $$ select create_trip((select id from vehicles limit 1), 'Kargil', 'Leh',
       (current_date + 2), 1200, 4::smallint) $$,
  'and the gate opens');

-- The badge is read live, so a withdrawn licence stops vouching for trips already
-- posted — a cached badge is the one that keeps vouching after the vouching stopped.
select tests_become('00000000-0000-0000-0000-0000000f1104');
select review_driver_document('00000000-0000-0000-0000-0000000f1101', 'licence',
  false, 'Withdrawn by the RTO');

select is(
  (select count(*)::int from verified_drivers(
     array['00000000-0000-0000-0000-0000000f1101']::uuid[])),
  0,
  'withdrawing the licence un-badges the trips they already posted');

select * from finish();
rollback;
