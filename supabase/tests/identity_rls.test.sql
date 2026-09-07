-- pgTAP: the privacy model (spec 03.4, 06.10, risk #4).
--
-- Every policy family gets BOTH an allow and a deny assertion. The deny half is the
-- point — a policy that grants correctly but fails to refuse is the failure mode that
-- leaks a village's phone book, and it is invisible to manual testing.
--
-- Run: npm run db:test   (requires the local stack, i.e. Docker)
-- CI runs this on every PR; see .github/workflows/ci.yml.

begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- ---------------------------------------------------------------------------
-- Fixture: two villages in one block, one member each, plus a panchayat admin
-- in village A. Villages are created here rather than taken from the seed, so the
-- test never depends on production geography.
-- ---------------------------------------------------------------------------
set search_path = public, extensions;

insert into geo_units (id, type, parent_id, slug, name_en)
select '00000000-0000-0000-0000-0000000000a0', 'village', b.id, 'testvillage_a', 'Test Village A'
  from geo_units b where b.path = 'ladakh.kargil.kargil'::ltree;

insert into geo_units (id, type, parent_id, slug, name_en)
select '00000000-0000-0000-0000-0000000000b0', 'village', b.id, 'testvillage_b', 'Test Village B'
  from geo_units b where b.path = 'ladakh.kargil.kargil'::ltree;

-- auth.users rows fire handle_new_user(), which creates profiles/privacy/private rows.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'alia@example.test', '{"full_name":"Alia"}'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'basit@example.test', '{"full_name":"Basit"}'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'zahra@example.test', '{"full_name":"Zahra"}');

update profiles set village_id = '00000000-0000-0000-0000-0000000000a0'
 where id in ('00000000-0000-0000-0000-0000000000a1',
              '00000000-0000-0000-0000-0000000000a2');
update profiles set village_id = '00000000-0000-0000-0000-0000000000b0'
 where id = '00000000-0000-0000-0000-0000000000b1';
update profiles set roles = '{member,panchayat_admin}'::user_role[],
                    panchayat_id = '00000000-0000-0000-0000-0000000000a0'
 where id = '00000000-0000-0000-0000-0000000000a2';

update profile_private set phone = '+919419000001', phone_verified = true
 where user_id = '00000000-0000-0000-0000-0000000000a1';

-- Helper: become a given user for the statements that follow.
create or replace function tests_become(uid uuid) returns void
language plpgsql as $$
begin
  execute format('set local role authenticated');
  execute format('set local request.jwt.claims = %L', json_build_object('sub', uid, 'role', 'authenticated')::text);
end $$;

-- ---------------------------------------------------------------------------
-- geo_units: reference data, readable by any signed-in user, writable by none
-- ---------------------------------------------------------------------------
select tests_become('00000000-0000-0000-0000-0000000000a1');

select isnt_empty(
  $$ select 1 from geo_units where slug = 'testvillage_b' $$,
  'a member can read geography outside their own village (the picker needs the whole tree)');

select throws_ok(
  $$ insert into geo_units (type, parent_id, slug, name_en)
     select 'village', id, 'invented', 'Invented' from geo_units where slug = 'kargil' limit 1 $$,
  '42501',
  null,
  'a member cannot create a geo_unit — a missing village is a support request');

-- ---------------------------------------------------------------------------
-- profiles: self and co-villagers only
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  1, 'a member can read their own profile');

select is(
  (select count(*)::int from profiles where id = '00000000-0000-0000-0000-0000000000a2'),
  1, 'a member can read a co-villager profile');

select is(
  (select count(*)::int from profiles where id = '00000000-0000-0000-0000-0000000000b1'),
  0, 'a member CANNOT read a profile from another village');

select is(
  (select count(*)::int from directory_members where village_id = '00000000-0000-0000-0000-0000000000b0'),
  0, 'the directory view does not leak another village');

-- ---------------------------------------------------------------------------
-- phone numbers: never reachable by select, from anyone but the owner
-- ---------------------------------------------------------------------------
select is(
  (select phone from profile_private where user_id = '00000000-0000-0000-0000-0000000000a1'),
  '+919419000001', 'the owner can read their own phone number');

select hasnt_column('public', 'directory_members', 'phone',
  'the directory view has no phone column at all');

select tests_become('00000000-0000-0000-0000-0000000000a2');

select is(
  (select count(*)::int from profile_private where user_id = '00000000-0000-0000-0000-0000000000a1'),
  0, 'a co-villager CANNOT select another member''s phone row');

select is(
  (select count(*)::int from profile_private where user_id = '00000000-0000-0000-0000-0000000000b1'),
  0, 'a panchayat admin CANNOT select a phone row from another village either');

select is(
  (select phone_available from directory_members where id = '00000000-0000-0000-0000-0000000000a1'),
  true, 'the directory advertises that a number exists without revealing it');

-- ---------------------------------------------------------------------------
-- admins_geo(): scoped to the admin's own subtree, not district-wide
-- ---------------------------------------------------------------------------
select ok(admins_geo('00000000-0000-0000-0000-0000000000a0'),
  'a panchayat admin administers their own village');

select ok(not admins_geo('00000000-0000-0000-0000-0000000000b0'),
  'a panchayat admin does NOT administer a neighbouring village');

-- ---------------------------------------------------------------------------
-- opting out of the directory
-- ---------------------------------------------------------------------------
select tests_become('00000000-0000-0000-0000-0000000000a1');
update privacy_settings set in_directory = false
 where user_id = '00000000-0000-0000-0000-0000000000a1';

select tests_become('00000000-0000-0000-0000-0000000000a2');
select is(
  (select count(*)::int from profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  0, 'opting out of the directory hides the profile from co-villagers');

select * from finish();
rollback;
