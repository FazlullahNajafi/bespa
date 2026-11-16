-- pgTAP: who may bind a DigiLocker session to an identity (spec 04.7).
--
-- A session id is a key to someone's government documents. The dangerous mistake is not
-- a missing policy on the session table — it is `record_digilocker_licence` being
-- callable by a user, or accepting a session that belongs to somebody else, because
-- either one turns "I know a session id" into "this licence is mine". Both are asserted
-- here.
--
-- The function writes `approved` directly, which no user may do through any other route:
-- the whole manual path goes through `review_driver_document`, which checks
-- `reviews_drivers()` and refuses self-approval.
--
-- Run: npm run db:test

begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Fixture: two drivers in one village, each with a session of their own.
-- ---------------------------------------------------------------------------

insert into geo_units (id, type, parent_id, slug, name_en)
select '00000000-0000-0000-0000-0000000000d0', 'village', b.id, 'testvillage_d', 'Test Village D'
  from geo_units b where b.path = 'ladakh.kargil.kargil'::ltree;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'driver_one@example.test', '{"full_name":"Driver One"}'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'driver_two@example.test', '{"full_name":"Driver Two"}');

update profiles set village_id = '00000000-0000-0000-0000-0000000000d0'
 where id in ('00000000-0000-0000-0000-0000000000d1',
              '00000000-0000-0000-0000-0000000000d2');

insert into digilocker_sessions (session_id, user_id)
values ('sess-one', '00000000-0000-0000-0000-0000000000d1'),
       ('sess-two', '00000000-0000-0000-0000-0000000000d2');

-- ---------------------------------------------------------------------------
-- The function is not reachable from a client at all
-- ---------------------------------------------------------------------------

select ok(
  not has_function_privilege('authenticated',
    'record_digilocker_licence(uuid,text,text,jsonb)', 'execute'),
  'authenticated cannot execute record_digilocker_licence'
);

select ok(
  not has_function_privilege('anon',
    'record_digilocker_licence(uuid,text,text,jsonb)', 'execute'),
  'anon cannot execute record_digilocker_licence'
);

-- ---------------------------------------------------------------------------
-- A session belongs to exactly one person, and the function enforces it
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ select record_digilocker_licence(
       '00000000-0000-0000-0000-0000000000d2'::uuid,
       'sess-one',
       '00000000-0000-0000-0000-0000000000d2/licence/stolen.pdf',
       '{}'::jsonb) $$,
  '42501',
  'not_permitted',
  'a session cannot be redeemed by a different driver'
);

select throws_ok(
  $$ select record_digilocker_licence(
       '00000000-0000-0000-0000-0000000000d1'::uuid,
       'sess-does-not-exist',
       '00000000-0000-0000-0000-0000000000d1/licence/x.pdf',
       '{}'::jsonb) $$,
  '42501',
  'not_permitted',
  'an unknown session is refused'
);

-- The storage path carries the owner, and a mismatched one would file a verified licence
-- under the wrong driver's folder.
select throws_ok(
  $$ select record_digilocker_licence(
       '00000000-0000-0000-0000-0000000000d1'::uuid,
       'sess-one',
       '00000000-0000-0000-0000-0000000000d2/licence/x.pdf',
       '{}'::jsonb) $$,
  '22023',
  'document does not belong to this user',
  'the storage path must sit under the driver it is recorded against'
);

-- ---------------------------------------------------------------------------
-- The happy path, and what it records
-- ---------------------------------------------------------------------------

select lives_ok(
  $$ select record_digilocker_licence(
       '00000000-0000-0000-0000-0000000000d1'::uuid,
       'sess-one',
       '00000000-0000-0000-0000-0000000000d1/licence/digilocker-1.xml',
       '{"issuer":"Transport Department"}'::jsonb) $$,
  'a driver redeeming their own session records a licence'
);

select is(
  (select status::text || '/' || verified_via::text
     from driver_documents
    where user_id = '00000000-0000-0000-0000-0000000000d1' and kind = 'licence'),
  'approved/digilocker',
  'the licence is approved, and says the issuer verified it'
);

-- An issuer-signed document has no human reviewer. The constraint is what stops a future
-- change recording someone''s name against an approval they did not make.
select is(
  (select reviewed_by
     from driver_documents
    where user_id = '00000000-0000-0000-0000-0000000000d1' and kind = 'licence'),
  null,
  'a DigiLocker approval names no reviewer'
);

select is(
  (select status from digilocker_sessions where session_id = 'sess-one'),
  'succeeded',
  'redeeming the session closes it'
);

select * from finish();
rollback;
