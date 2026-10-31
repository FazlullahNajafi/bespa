-- pgTAP: who gets told about a notice (spec 03.5, 06.9).
--
-- The queue hands out **push tokens**, so the risk here is not that someone misses a
-- notification — it is that a token leaks, or that a village is woken for another
-- village's notice. Both are asymmetric: a missed push is an inconvenience, a push to the
-- wrong village is the credibility failure the whole module is built to avoid.
--
-- Run: npm run db:test

begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Fixture: two villages under Kargil block, one member each, a phone each.
-- ---------------------------------------------------------------------------

insert into geo_units (id, type, parent_id, slug, name_en)
select '00000000-0000-0000-0000-0000000000a0', 'village', b.id, 'pushvillage_a', 'Push Village A'
  from geo_units b where b.path = 'ladakh.kargil.kargil'::ltree;

insert into geo_units (id, type, parent_id, slug, name_en)
select '00000000-0000-0000-0000-0000000000b0', 'village', b.id, 'pushvillage_b', 'Push Village B'
  from geo_units b where b.path = 'ladakh.kargil.kargil'::ltree;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'amina@example.test', '{"full_name":"Amina"}'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'bashir@example.test', '{"full_name":"Bashir"}');

update profiles set village_id = '00000000-0000-0000-0000-0000000000a0'
 where id = '00000000-0000-0000-0000-0000000000a1';
update profiles set village_id = '00000000-0000-0000-0000-0000000000b0'
 where id = '00000000-0000-0000-0000-0000000000b1';

insert into devices (user_id, expo_token, platform)
values
  ('00000000-0000-0000-0000-0000000000a1', 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]', 'android'),
  ('00000000-0000-0000-0000-0000000000b1', 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]', 'android');

-- A notice for village A only, and one for the whole district.
insert into notices (id, geo_unit_id, title, body, category, published_by, source)
values ('00000000-0000-0000-0000-0000000000c0',
        '00000000-0000-0000-0000-0000000000a0',
        'Water supply cut on Friday', 'Between 9am and 2pm.', 'general',
        '00000000-0000-0000-0000-0000000000a1', 'local');

insert into notices (id, geo_unit_id, title, body, category, source, source_url, source_ref)
select '00000000-0000-0000-0000-0000000000d0', d.id,
       'FORM VII - Village Shilikchay', '', 'general',
       'district_kargil', 'https://kargil.nic.in/x.pdf', 'https://kargil.nic.in/x.pdf'
  from geo_units d where d.path = 'ladakh.kargil'::ltree;

-- ---------------------------------------------------------------------------
-- Scope
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from notice_push_queue()
    where notice_id = '00000000-0000-0000-0000-0000000000c0'),
  1,
  'a village notice reaches exactly one device');

select is(
  (select user_id from notice_push_queue()
    where notice_id = '00000000-0000-0000-0000-0000000000c0'),
  '00000000-0000-0000-0000-0000000000a1'::uuid,
  'and it is the member of that village, not the one next door');

select is(
  (select count(*)::int from notice_push_queue()
    where notice_id = '00000000-0000-0000-0000-0000000000d0'),
  2,
  'a district notice reaches every village beneath it');

-- ---------------------------------------------------------------------------
-- Not announcing things twice, or late
-- ---------------------------------------------------------------------------

select is(
  record_notice_push('00000000-0000-0000-0000-0000000000c0'),
  1,
  'recording the push answers with the number of villagers told');

select is(
  (select count(*)::int from notifications
    where user_id = '00000000-0000-0000-0000-0000000000a1'
      and kind = 'notice.published'),
  1,
  'and writes the in-app notification that backs the unread badge');

select is(
  (select count(*)::int from notice_push_queue()
    where notice_id = '00000000-0000-0000-0000-0000000000c0'),
  0,
  'an announced notice leaves the queue, so nobody is told twice');

update notices set published_at = now() - interval '10 days'
 where id = '00000000-0000-0000-0000-0000000000d0';

select is(
  (select count(*)::int from notice_push_queue()
    where notice_id = '00000000-0000-0000-0000-0000000000d0'),
  0,
  'a notice older than the window is never announced, however long the job was down');

-- The kill switch in spec 09.4 #2 has to govern sending as well as showing: a source
-- switched off must not still be buzzing phones.
update notices set published_at = now() where id = '00000000-0000-0000-0000-0000000000d0';
update notice_sources set enabled = false where key = 'district_kargil';

select is(
  (select count(*)::int from notice_push_queue()
    where notice_id = '00000000-0000-0000-0000-0000000000d0'),
  0,
  'switching a source off stops its notices being announced, not just shown');

update notice_sources set enabled = true where key = 'district_kargil';

-- ---------------------------------------------------------------------------
-- Dead tokens
-- ---------------------------------------------------------------------------

select forget_device_token('ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]');

select is(
  (select count(*)::int from devices where user_id = '00000000-0000-0000-0000-0000000000a1'),
  0,
  'a token Expo has rejected is dropped rather than pushed into forever');

select * from finish();
rollback;
