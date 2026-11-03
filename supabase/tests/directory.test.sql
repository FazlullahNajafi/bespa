-- pgTAP: the directory and the one door a phone number may leave by (spec 03.4).
--
-- Everything here is a refusal. The directory's whole promise is that a number reaches
-- the people its owner chose and nobody else, that every reveal is written where the
-- *subject* can read it, and that a village's phone book cannot be harvested. A list that
-- fails to show someone is a bug; a number handed to the wrong village is the thing that
-- would end the app in a district this small.
--
-- Run: npm run db:test

begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Fixture: two villages, two members in the first, one in the second, and an
-- admin of the first.
-- ---------------------------------------------------------------------------

insert into geo_units (id, type, parent_id, slug, name_en)
select '00000000-0000-0000-0000-00000000d100', 'village', b.id, 'dirvillage_one', 'Dir Village One'
  from geo_units b where b.path = 'ladakh.kargil.kargil'::ltree;

insert into geo_units (id, type, parent_id, slug, name_en)
select '00000000-0000-0000-0000-00000000d200', 'village', b.id, 'dirvillage_two', 'Dir Village Two'
  from geo_units b where b.path = 'ladakh.kargil.kargil'::ltree;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  -- Zainab, who lists her number to villagers.
  ('00000000-0000-0000-0000-00000000d101', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'zainab@example.test', '{"full_name":"Zainab"}'),
  -- Hussain, same village, who looks people up.
  ('00000000-0000-0000-0000-00000000d102', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'hussain@example.test', '{"full_name":"Hussain"}'),
  -- Fatima, the NEXT village.
  ('00000000-0000-0000-0000-00000000d201', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'fatima@example.test', '{"full_name":"Fatima"}'),
  -- The sarpanch of village one.
  ('00000000-0000-0000-0000-00000000d103', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'sarpanch1@example.test', '{"full_name":"Sarpanch One"}');

update profiles set village_id = '00000000-0000-0000-0000-00000000d100'
 where id in ('00000000-0000-0000-0000-00000000d101',
              '00000000-0000-0000-0000-00000000d102',
              '00000000-0000-0000-0000-00000000d103');
update profiles set village_id = '00000000-0000-0000-0000-00000000d200'
 where id = '00000000-0000-0000-0000-00000000d201';

update profiles set roles = '{member,panchayat_admin}'::user_role[]
 where id = '00000000-0000-0000-0000-00000000d103';

-- Since 20261103090000 the scope is the GRANT, not the profile's village.
insert into admin_grants (user_id, geo_unit_id, role)
values ('00000000-0000-0000-0000-00000000d103',
        '00000000-0000-0000-0000-00000000d100', 'panchayat_admin');

update profile_private set phone = '+919419000001'
 where user_id = '00000000-0000-0000-0000-00000000d101';

create or replace function tests_become(uid uuid) returns void
language plpgsql as $$
begin
  execute format('set local role authenticated');
  execute format('set local request.jwt.claims = %L', json_build_object('sub', uid, 'role', 'authenticated')::text);
end $$;

-- ---------------------------------------------------------------------------
-- The list
-- ---------------------------------------------------------------------------
select tests_become('00000000-0000-0000-0000-00000000d102');

select is(
  (select count(*)::int from directory_members
    where village_id = '00000000-0000-0000-0000-00000000d100'),
  3,
  'a villager sees the members of their own village');

select is(
  (select count(*)::int from directory_members
    where village_id = '00000000-0000-0000-0000-00000000d200'),
  0,
  'and nobody from the next village, which is what "villagers" means');

select hasnt_column('public', 'directory_members', 'phone',
  'the directory projection has no phone column at all, so no list response can leak one');

-- Opting out removes the row entirely, not just its fields.
--
-- `reset role` before every fixture change below, and it is load-bearing: these updates
-- would otherwise run as whichever villager the last `tests_become` made us, where
-- `privacy_update_self` turns them into silent no-ops and the assertions that follow
-- quietly test nothing.
reset role;
update privacy_settings set in_directory = false
 where user_id = '00000000-0000-0000-0000-00000000d101';

select tests_become('00000000-0000-0000-0000-00000000d102');
select is(
  (select count(*)::int from directory_members
    where id = '00000000-0000-0000-0000-00000000d101'),
  0,
  'someone who opted out is not listed');

reset role;
update privacy_settings set in_directory = true
 where user_id = '00000000-0000-0000-0000-00000000d101';

-- Hiding the occupation blanks the field without hiding the person.
reset role;
update privacy_settings set show_occupation = 'nobody'
 where user_id = '00000000-0000-0000-0000-00000000d101';
reset role;
update profiles set occupation = 'teacher'
 where id = '00000000-0000-0000-0000-00000000d101';

select tests_become('00000000-0000-0000-0000-00000000d102');
select is(
  (select occupation from directory_members where id = '00000000-0000-0000-0000-00000000d101'),
  null,
  'an occupation set to nobody is blank in the list, while the person still appears');

select is(
  (select count(*)::int from directory_members where id = '00000000-0000-0000-0000-00000000d101'),
  1,
  'and they do still appear');

reset role;
update privacy_settings set show_occupation = 'villagers'
 where user_id = '00000000-0000-0000-0000-00000000d101';

-- ---------------------------------------------------------------------------
-- get_member_contact
-- ---------------------------------------------------------------------------
select tests_become('00000000-0000-0000-0000-00000000d102');

select is(
  (select phone from get_member_contact('00000000-0000-0000-0000-00000000d101')),
  '+919419000001',
  'a co-villager may fetch a number its owner shares with villagers');

reset role;
select is(
  (select count(*)::int from contact_access_log
    where viewer_id = '00000000-0000-0000-0000-00000000d102'
      and subject_id = '00000000-0000-0000-0000-00000000d101'),
  1,
  'and the reveal is logged against the pair who were involved');

-- The subject's own read of that log is the point of keeping it.
select tests_become('00000000-0000-0000-0000-00000000d101');
select is(
  (select count(*)::int from contact_access_log where subject_id = '00000000-0000-0000-0000-00000000d101'),
  1,
  'the subject can read who looked them up');

select tests_become('00000000-0000-0000-0000-00000000d102');
select is(
  (select count(*)::int from contact_access_log where subject_id = '00000000-0000-0000-0000-00000000d102'),
  0,
  'and a viewer cannot read anyone else''s log');

-- The next village over.
select tests_become('00000000-0000-0000-0000-00000000d201');
select throws_ok(
  $$ select get_member_contact('00000000-0000-0000-0000-00000000d101') $$,
  '42501',
  null,
  'a member of another village is refused the number outright');

-- 'officials' means officials.
reset role;
update privacy_settings set show_phone = 'officials'
 where user_id = '00000000-0000-0000-0000-00000000d101';

select tests_become('00000000-0000-0000-0000-00000000d102');
select throws_ok(
  $$ select get_member_contact('00000000-0000-0000-0000-00000000d101') $$,
  '42501',
  null,
  'a plain co-villager is refused a number set to officials only');

select tests_become('00000000-0000-0000-0000-00000000d103');
select is(
  (select phone from get_member_contact('00000000-0000-0000-0000-00000000d101')),
  '+919419000001',
  'while the sarpanch, who is an official, may have it');

reset role;
update privacy_settings set show_phone = 'nobody'
 where user_id = '00000000-0000-0000-0000-00000000d101';

select tests_become('00000000-0000-0000-0000-00000000d103');
select throws_ok(
  $$ select get_member_contact('00000000-0000-0000-0000-00000000d101') $$,
  '42501',
  null,
  'nobody means nobody, including an official');

reset role;
update privacy_settings set show_phone = 'villagers'
 where user_id = '00000000-0000-0000-0000-00000000d101';

-- ---------------------------------------------------------------------------
-- The rate limit — what makes harvesting impractical rather than discouraged
-- ---------------------------------------------------------------------------
reset role;
insert into contact_access_log (viewer_id, subject_id, accessed_at)
select '00000000-0000-0000-0000-00000000d102', '00000000-0000-0000-0000-00000000d101',
       now() - interval '1 hour'
  from generate_series(1, 29);

select tests_become('00000000-0000-0000-0000-00000000d102');
select throws_ok(
  $$ select get_member_contact('00000000-0000-0000-0000-00000000d101') $$,
  'PT429',
  null,
  'the 31st lookup in 24 hours is refused');

-- Yesterday's lookups do not count, or the limit would be a lifetime cap.
reset role;
update contact_access_log set accessed_at = now() - interval '30 hours'
 where viewer_id = '00000000-0000-0000-0000-00000000d102';

select tests_become('00000000-0000-0000-0000-00000000d102');
select is(
  (select phone from get_member_contact('00000000-0000-0000-0000-00000000d101')),
  '+919419000001',
  'and the window rolls, so yesterday''s lookups do not count against today');

-- ---------------------------------------------------------------------------
-- The panchayat cards: an office's number, and who may change it
-- ---------------------------------------------------------------------------
-- These carry their phone in the row, unlike a villager's, because spec 03.4 calls them
-- public by definition of the office. That makes "who may write one" the whole of their
-- security, so every refusal below is the point.

reset role;

select tests_become('00000000-0000-0000-0000-00000000d103');

select lives_ok(
  $$ select publish_village_contact('00000000-0000-0000-0000-00000000d100',
       'Mohammad Ali', 'Sarpanch', '+919419000111', 0) $$,
  'an admin can publish a contact card for their own village');

select is(
  (select phone from village_contacts where name = 'Mohammad Ali'),
  '+919419000111',
  'and the number is in the row, because the office is public within the village');

-- The next village over is not theirs, and the server must say so rather than relying on
-- a screen that only shows them their own.
select throws_ok(
  $$ select publish_village_contact('00000000-0000-0000-0000-00000000d200',
       'Someone Else', 'Sarpanch', '+919419000222', 0) $$,
  '42501',
  null,
  'and cannot publish one for a village they do not administer');

-- A plain villager, with no role at all.
select tests_become('00000000-0000-0000-0000-00000000d102');

select throws_ok(
  $$ select publish_village_contact('00000000-0000-0000-0000-00000000d100',
       'Impostor', 'Sarpanch', '+919419000333', 0) $$,
  '42501',
  null,
  'a villager with no role cannot publish a contact card');

select throws_ok(
  $$ select update_village_contact(
       (select id from village_contacts where name = 'Mohammad Ali'),
       'Impostor', 'Sarpanch', '+919419000333', 0) $$,
  '42501',
  null,
  'nor edit one — the number people ring is not editable by whoever is signed in');

select throws_ok(
  $$ select delete_village_contact(
       (select id from village_contacts where name = 'Mohammad Ali')) $$,
  '42501',
  null,
  'nor remove one');

-- Correcting it is the case the whole migration exists for: an office changes hands, and
-- a card still showing the last holder's number is worse than no card.
select tests_become('00000000-0000-0000-0000-00000000d103');

select lives_ok(
  $$ select update_village_contact(
       (select id from village_contacts where name = 'Mohammad Ali'),
       'Ibrahim Khan', 'Sarpanch', '+919419000444', 0) $$,
  'the admin can correct a card when the office changes hands');

select is(
  (select phone from village_contacts where name = 'Ibrahim Khan'),
  '+919419000444',
  'and the new holder''s number replaces the old one');

select * from finish();
rollback;
