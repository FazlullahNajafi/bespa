-- pgTAP: what a user may write about themselves (spec 03.4, 03.6).
--
-- The companion to identity_rls.test.sql. That file asks who can *read* what; this one
-- asks who can *write* what, because the two are enforced by different mechanisms —
-- rows by RLS, columns by GRANT — and a policy set that reads correctly can still hand
-- out `roles = '{super_admin}'`.
--
-- Every assertion here failed before 20261019120000_profile_privacy.sql.
--
-- Run: npm run db:test

begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Fixture: one village, two members in it. Own geography, not the seed's.
-- ---------------------------------------------------------------------------

insert into geo_units (id, type, parent_id, slug, name_en)
select '00000000-0000-0000-0000-0000000000c0', 'village', b.id, 'testvillage_c', 'Test Village C'
  from geo_units b where b.path = 'ladakh.kargil.kargil'::ltree;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'hadiya@example.test', '{"full_name":"Hadiya"}'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'tsering@example.test', '{"full_name":"Tsering"}');

update profiles set village_id = '00000000-0000-0000-0000-0000000000c0'
 where id in ('00000000-0000-0000-0000-0000000000c1',
              '00000000-0000-0000-0000-0000000000c2');

update profiles set occupation = 'teacher', avatar_path = 'avatars/hadiya.jpg'
 where id = '00000000-0000-0000-0000-0000000000c1';

update profile_private set phone = '+919419000011', phone_verified = true
 where user_id = '00000000-0000-0000-0000-0000000000c1';

create or replace function tests_become(uid uuid) returns void
language plpgsql as $$
begin
  execute format('set local role authenticated');
  execute format('set local request.jwt.claims = %L', json_build_object('sub', uid, 'role', 'authenticated')::text);
end $$;

-- ---------------------------------------------------------------------------
-- Column grants on profiles: the editable set, and nothing else
-- ---------------------------------------------------------------------------
select tests_become('00000000-0000-0000-0000-0000000000c1');

select lives_ok(
  $$ update profiles set full_name = 'Hadiya Bano', bio = 'Teaches at the middle school'
      where id = '00000000-0000-0000-0000-0000000000c1' $$,
  'a member can edit their own name and bio');

select throws_ok(
  $$ update profiles set roles = '{member,super_admin}'::user_role[]
      where id = '00000000-0000-0000-0000-0000000000c1' $$,
  '42501',
  null,
  'a member CANNOT grant themselves a role — the escalation the row policy alone allowed');

select throws_ok(
  $$ update profiles set village_id = '00000000-0000-0000-0000-0000000000c0'
      where id = '00000000-0000-0000-0000-0000000000c1' $$,
  '42501',
  null,
  'a member CANNOT write village_id directly, bypassing set_my_village''s limit and log');

select throws_ok(
  $$ update profiles set privacy_reviewed_at = now()
      where id = '00000000-0000-0000-0000-0000000000c1' $$,
  '42501',
  null,
  'a member CANNOT stamp the privacy step as reviewed themselves');

-- ---------------------------------------------------------------------------
-- Phone: writable, verification is not
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ update profile_private set phone_verified = true
      where user_id = '00000000-0000-0000-0000-0000000000c1' $$,
  '42501',
  null,
  'a member CANNOT mark their own number verified — is_phone_verified() gates posting');

select lives_ok(
  $$ update profile_private set phone = '+919419000012'
      where user_id = '00000000-0000-0000-0000-0000000000c1' $$,
  'a member can change their own number');

select is(
  (select phone_verified from profile_private where user_id = '00000000-0000-0000-0000-0000000000c1'),
  false,
  'changing the number drops the verified flag with it');

-- ---------------------------------------------------------------------------
-- set_my_privacy
-- ---------------------------------------------------------------------------

select lives_ok(
  $$ select set_my_privacy('officials', 'nobody', 'nobody', true) $$,
  'a member can set their own privacy flags');

select isnt(
  (select privacy_reviewed_at from profiles where id = '00000000-0000-0000-0000-0000000000c1'),
  null,
  'set_my_privacy stamps the step as done, in the same transaction as the flags');

select throws_ok(
  $$ select set_my_privacy('villagers', 'officials', 'villagers', true) $$,
  '22023',
  null,
  'officials-only is refused for the avatar — spec 03.4 offers it for the phone alone');

-- ---------------------------------------------------------------------------
-- The flags actually mask the directory (spec 03.4's table, as the view applies it)
-- ---------------------------------------------------------------------------
select tests_become('00000000-0000-0000-0000-0000000000c2');

select is(
  (select occupation from directory_members where id = '00000000-0000-0000-0000-0000000000c1'),
  null,
  'show_occupation = nobody hides the occupation from a co-villager');

select is(
  (select avatar_path from directory_members where id = '00000000-0000-0000-0000-0000000000c1'),
  null,
  'show_avatar = nobody falls back to initials rather than leaking the path');

-- 'officials' is not 'nobody': the row still advertises that a number exists, and
-- get_member_contact (Phase 1) is what decides whether this caller may see it.
select is(
  (select phone_available from directory_members where id = '00000000-0000-0000-0000-0000000000c1'),
  true,
  'show_phone = officials still advertises a reachable number');

select * from finish();
rollback;
