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
select plan(6);

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

-- Stated directly rather than through a district count, which is what this used to be.
-- "One district" was a proxy for "the tree has not doubled" and it stopped being true in
-- 2026, when Kargil was split into four — so the proxy failed while the property it
-- stood for held perfectly.
select is(
  (select count(*)::int from geo_units),
  (select count(distinct path)::int from geo_units),
  'every unit has exactly one path, so nothing can be reached through two parents');

-- The concrete tripwire. Four districts cover the area Bespa serves (Kargil, Drass,
-- Sankoo, Zanskar); a fifth appearing by itself means the seed has doubled something,
-- and a third means a re-parent half-applied.
select is(
  (select count(*)::int from geo_units where type = 'district'),
  4,
  'the four districts of the Kargil region, and no more');

-- The split itself, as counts rather than as fifteen separate assertions. These are the
-- numbers the district administration's own village list produces when its blocks are
-- grouped the way the 2026 notifications group them — so a re-parent that half-applies,
-- or a block that drifts to the wrong district, shows up here as an arithmetic failure
-- rather than as a villager being shown someone else's district.
select is(
  (select array_agg(d.name_en || ':' || c.blocks || '/' || c.places order by d.name_en)
     from geo_units d
     cross join lateral (
       select count(*) filter (where g.type = 'block') as blocks,
              count(*) filter (where g.type in ('village', 'town')) as places
         from geo_units g where g.path operator(extensions.<@) d.path and g.id <> d.id
     ) c
    where d.type = 'district'),
  array['Drass:2/19', 'Kargil:6/50', 'Sankoo:4/36', 'Zanskar:3/25'],
  'each district holds the blocks and places the source list gives it');

select * from finish();
rollback;
