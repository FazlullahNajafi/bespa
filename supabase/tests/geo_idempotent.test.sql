-- pgTAP: the geography seed is idempotent, root included (spec 02.2).
--
-- Tenancy is `profiles.village_id`, so a duplicated geo row is the most expensive kind
-- of bad data in this schema: two rows for one real village means two village_ids, and
-- two neighbours who both picked "Gongma Minjee" end up in different tenancies, each
-- invisible to the other's directory.
--
-- The seed guards every level with `on conflict (parent_id, slug) do nothing`, which
-- reads as watertight and was not: a unique constraint treats NULLs as distinct, and the
-- root is the one row with `parent_id is null`. Running the seed twice against the hosted
-- project inserted a second Ladakh and doubled the entire tree beneath it.
--
-- Run: npm run db:test

begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- The root is the case that broke. Assert it directly rather than through the
-- seed, so a failure names the cause instead of a row count.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ insert into geo_units (type, parent_id, slug, name_en)
     values ('ut', null, 'ladakh', 'Ladakh duplicate') $$,
  '23505',
  null,
  'a second parentless root with the same slug is refused');

-- `do nothing` must swallow that refusal rather than raise, or the seed aborts midway
-- and leaves a half-applied tree -- which is worse than either outcome.
select lives_ok(
  $$ insert into geo_units (type, parent_id, slug, name_en)
     values ('ut', null, 'ladakh', 'Ladakh duplicate')
     on conflict (parent_id, slug) do nothing $$,
  'the seed''s own on-conflict clause covers the root, so a re-run is a no-op');

select is(
  (select count(*)::int from geo_units where parent_id is null),
  1,
  'exactly one root survives both attempts');

-- ---------------------------------------------------------------------------
-- And the level below, which is what multiplied. Two roots is one bad row; two
-- districts under one root is the multiplication starting.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from geo_units where type = 'district'),
  1,
  'one district, so nothing below it can be reached through two parents');

select * from finish();
rollback;
