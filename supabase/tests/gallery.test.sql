-- pgTAP: the village gallery and its moderation (spec 03.3).
--
-- This is the first table in the app where a stranger's content reaches other people's
-- screens, so the assertions that matter are about what is NOT shown: a pending photo to
-- the village, a rejected one to anyone but its uploader, and anything at all to the
-- village next door. Pre-moderation that leaks is worse than none, because it is trusted.
--
-- Run: npm run db:test

begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Fixture: two villages, a contributor and a bystander in the first, a member
-- of the second, and an admin of the first.
-- ---------------------------------------------------------------------------

insert into geo_units (id, type, parent_id, slug, name_en)
select '00000000-0000-0000-0000-0000000a1100'::uuid, 'village', b.id, 'galvillage_one', 'Gallery Village One'
  from geo_units b where b.path = 'ladakh.kargil.kargil'::ltree;

insert into geo_units (id, type, parent_id, slug, name_en)
select '00000000-0000-0000-0000-0000000a2200'::uuid, 'village', b.id, 'galvillage_two', 'Gallery Village Two'
  from geo_units b where b.path = 'ladakh.kargil.kargil'::ltree;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000a1101', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'contributor@example.test', '{"full_name":"Contributor"}'),
  ('00000000-0000-0000-0000-0000000a1102', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'bystander@example.test', '{"full_name":"Bystander"}'),
  ('00000000-0000-0000-0000-0000000a1103', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'galadmin@example.test', '{"full_name":"Gallery Admin"}'),
  ('00000000-0000-0000-0000-0000000a2201', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'neighbour@example.test', '{"full_name":"Neighbour"}');

update profiles set village_id = '00000000-0000-0000-0000-0000000a1100'
 where id in ('00000000-0000-0000-0000-0000000a1101',
              '00000000-0000-0000-0000-0000000a1102',
              '00000000-0000-0000-0000-0000000a1103');
update profiles set village_id = '00000000-0000-0000-0000-0000000a2200'
 where id = '00000000-0000-0000-0000-0000000a2201';

insert into admin_grants (user_id, geo_unit_id, role)
values ('00000000-0000-0000-0000-0000000a1103',
        '00000000-0000-0000-0000-0000000a1100', 'panchayat_admin');

create or replace function tests_become(uid uuid) returns void
language plpgsql as $$
begin
  execute format('set local role authenticated');
  execute format('set local request.jwt.claims = %L', json_build_object('sub', uid, 'role', 'authenticated')::text);
end $$;

-- ---------------------------------------------------------------------------
-- Submitting
-- ---------------------------------------------------------------------------
select tests_become('00000000-0000-0000-0000-0000000a1101');

select lives_ok(
  $$ select submit_gallery_image(
       '00000000-0000-0000-0000-0000000a1100',
       '00000000-0000-0000-0000-0000000a1100/00000000-0000-0000-0000-0000000a1101/a.jpg',
       'The bridge in spring') $$,
  'a villager can contribute a photo of their own village');

select is(
  (select status::text from gallery_images where caption = 'The bridge in spring'),
  'pending',
  'and it starts pending, because spec 03.3 moderates before showing');

select is(
  (select uploaded_by from gallery_images where caption = 'The bridge in spring'),
  '00000000-0000-0000-0000-0000000a1101'::uuid,
  'attributed to whoever sent it, not to whoever the client claimed');

-- The storage path carries the village and the uploader, and the policy that wrote the
-- object enforced both. Checking it again here stops a row being attached to someone
-- else's object.
select throws_ok(
  $$ select submit_gallery_image(
       '00000000-0000-0000-0000-0000000a1100',
       '00000000-0000-0000-0000-0000000a1100/00000000-0000-0000-0000-0000000a1102/stolen.jpg',
       'Not mine') $$,
  '22023',
  null,
  'a row cannot be attached to an object belonging to someone else');

select throws_ok(
  $$ select submit_gallery_image(
       '00000000-0000-0000-0000-0000000a2200',
       '00000000-0000-0000-0000-0000000a2200/00000000-0000-0000-0000-0000000a1101/b.jpg',
       'Someone else''s village') $$,
  '42501',
  null,
  'and a villager cannot contribute to a village they do not live in');

-- ---------------------------------------------------------------------------
-- Who can see a pending photo
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from gallery_images where caption = 'The bridge in spring'),
  1,
  'the uploader sees their own pending photo, so "did it send?" has an answer');

select tests_become('00000000-0000-0000-0000-0000000a1102');
select is(
  (select count(*)::int from gallery_images where caption = 'The bridge in spring'),
  0,
  'another villager does not — pending means not shown');

select tests_become('00000000-0000-0000-0000-0000000a1103');
select is(
  (select count(*)::int from gallery_images where caption = 'The bridge in spring'),
  1,
  'the village admin does, or there is nothing to moderate');

select tests_become('00000000-0000-0000-0000-0000000a2201');
select is(
  (select count(*)::int from gallery_images where caption = 'The bridge in spring'),
  0,
  'and the next village over sees nothing at any stage');

-- ---------------------------------------------------------------------------
-- Reviewing
-- ---------------------------------------------------------------------------
select tests_become('00000000-0000-0000-0000-0000000a1102');
select throws_ok(
  $$ select review_gallery_image(
       (select id from gallery_images where storage_path like '%/a.jpg'), true) $$,
  '42501',
  null,
  'a villager with no grant cannot approve a photo');

select tests_become('00000000-0000-0000-0000-0000000a2201');
select throws_ok(
  $$ select review_gallery_image(
       (select id from gallery_images where storage_path like '%/a.jpg'), true) $$,
  '42501',
  null,
  'nor can an outsider, who cannot even see it');

select tests_become('00000000-0000-0000-0000-0000000a1103');

select throws_ok(
  $$ select review_gallery_image(
       (select id from gallery_images where storage_path like '%/a.jpg'), false, '') $$,
  '22023',
  null,
  'a rejection with no reason is refused — an unexplained one is a grievance');

select lives_ok(
  $$ select review_gallery_image(
       (select id from gallery_images where storage_path like '%/a.jpg'), true) $$,
  'the village admin can approve it');

select tests_become('00000000-0000-0000-0000-0000000a1102');
select is(
  (select count(*)::int from gallery_images where caption = 'The bridge in spring'),
  1,
  'and once approved the village can see it');

-- A rejection, and what its uploader is told.
select tests_become('00000000-0000-0000-0000-0000000a1101');
select submit_gallery_image(
  '00000000-0000-0000-0000-0000000a1100',
  '00000000-0000-0000-0000-0000000a1100/00000000-0000-0000-0000-0000000a1101/c.jpg',
  'Blurry one');

select tests_become('00000000-0000-0000-0000-0000000a1103');
select review_gallery_image(
  (select id from gallery_images where caption = 'Blurry one'), false, 'Too blurry to see');

select tests_become('00000000-0000-0000-0000-0000000a1101');
select is(
  (select reject_reason from gallery_images where caption = 'Blurry one'),
  'Too blurry to see',
  'a rejected photo reaches its uploader with the reason');

select tests_become('00000000-0000-0000-0000-0000000a1102');
select is(
  (select count(*)::int from gallery_images where caption = 'Blurry one'),
  0,
  'and reaches nobody else');

-- ---------------------------------------------------------------------------
-- Withdrawing
-- ---------------------------------------------------------------------------
select tests_become('00000000-0000-0000-0000-0000000a1102');
select throws_ok(
  $$ select withdraw_gallery_image(
       (select id from gallery_images where storage_path like '%/a.jpg')) $$,
  '42501',
  null,
  'a bystander cannot withdraw someone else''s photo');

select tests_become('00000000-0000-0000-0000-0000000a1101');
select is(
  withdraw_gallery_image((select id from gallery_images where storage_path like '%/a.jpg')),
  '00000000-0000-0000-0000-0000000a1100/00000000-0000-0000-0000-0000000a1101/a.jpg',
  'its uploader can, and gets the storage path back so the bytes can go too');

select * from finish();
rollback;
