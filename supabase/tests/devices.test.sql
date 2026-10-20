-- pgTAP: push tokens are a capability, not data (spec 06.9, 02.4).
--
-- A push token lets whoever holds it deliver notifications to a specific handset. The
-- cases that matter are the ones where a handset changes hands — common here, where
-- phones are shared — and where one user tries to read or claim another's token.
--
-- Run: npm run db:test

begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

set search_path = public, extensions;

insert into geo_units (id, type, parent_id, slug, name_en)
select '00000000-0000-0000-0000-0000000000d0', 'village', b.id, 'testvillage_d', 'Test Village D'
  from geo_units b where b.path = 'ladakh.kargil.kargil'::ltree;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'zainab@example.test', '{"full_name":"Zainab"}'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'yusuf@example.test', '{"full_name":"Yusuf"}');

update profiles set village_id = '00000000-0000-0000-0000-0000000000d0'
 where id in ('00000000-0000-0000-0000-0000000000d1',
              '00000000-0000-0000-0000-0000000000d2');

create or replace function tests_become(uid uuid) returns void
language plpgsql as $$
begin
  execute format('set local role authenticated');
  execute format('set local request.jwt.claims = %L', json_build_object('sub', uid, 'role', 'authenticated')::text);
end $$;

-- ---------------------------------------------------------------------------
-- Registration
-- ---------------------------------------------------------------------------
select tests_become('00000000-0000-0000-0000-0000000000d1');

select lives_ok(
  $$ select register_my_device('ExponentPushToken[aaaa]', 'android', 'en') $$,
  'a member can register their handset');

select is(
  (select count(*)::int from devices where expo_token = 'ExponentPushToken[aaaa]'),
  1, 'the token is stored once');

-- Re-registering the same token on every cold start must not pile up rows.
select lives_ok(
  $$ select register_my_device('ExponentPushToken[aaaa]', 'android', 'en') $$,
  'registering the same token again is idempotent');

select is(
  (select count(*)::int from devices),
  1, 'still one row after a second registration');

-- ---------------------------------------------------------------------------
-- The shared handset — the case this RPC exists for
-- ---------------------------------------------------------------------------
select tests_become('00000000-0000-0000-0000-0000000000d2');
select register_my_device('ExponentPushToken[aaaa]', 'android', 'en');

select is(
  (select user_id from devices where expo_token = 'ExponentPushToken[aaaa]'),
  '00000000-0000-0000-0000-0000000000d2'::uuid,
  'a second user on the same handset takes the token over, so notices follow the holder');

select is(
  (select count(*)::int from devices where user_id = '00000000-0000-0000-0000-0000000000d1'),
  0, 'and the previous owner keeps no claim on that handset');

-- ---------------------------------------------------------------------------
-- Nobody reads anybody else's token
-- ---------------------------------------------------------------------------
select tests_become('00000000-0000-0000-0000-0000000000d1');

select is(
  (select count(*)::int from devices),
  0, 'a member cannot see a token now registered to someone else');

-- ---------------------------------------------------------------------------
-- Sign-out
-- ---------------------------------------------------------------------------
select tests_become('00000000-0000-0000-0000-0000000000d2');
select forget_my_devices();

select is(
  (select count(*)::int from devices),
  0, 'signing out drops the token, so the next notice does not reach a handed-on phone');

select * from finish();
rollback;
