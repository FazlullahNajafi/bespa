-- Kargil's four districts, for a project seeded before `seed/005` existed (spec 02.2).
--
-- Ladakh was reorganised twice in 2026 — five districts on 27 April (S.O. 180) and Sankoo
-- on 16 October (S.O. 284) — and four of them cover the area Bespa serves. Until this ran,
-- all fifteen blocks hung off Kargil, so a resident of Padum or Drass was shown a district
-- that stopped being theirs in April.
--
-- `seed/005_geo_district_split.sql` is the primary copy and carries the full reasoning,
-- including the check against the Ladakh Gazette (Extraordinary, 22 October 2026,
-- Notification 407-DRD (UTL) of 2026), which confirms all fifteen blocks block for block.
-- Read it before changing either.
--
-- Declared twice for the reason migration 20261021200000 explains: migrations run before
-- seeds, so on a fresh database the blocks this re-parents do not exist yet and these
-- statements do nothing, while on a project seeded months ago the seeds never run again
-- and this is the only thing that reaches it. Both are idempotent.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- First, a latent bug in the trigger this whole migration depends on.
-- ---------------------------------------------------------------------------
-- `geo_units_repath_descendants` was declared `after update OF path`, and that column
-- list means "the columns named in the UPDATE statement" — not "the columns that ended up
-- changing". Re-parenting names `parent_id`; `path` is rewritten underneath it by the
-- BEFORE trigger. So the cascade never fired for the one operation it exists for.
--
-- Found the only way it could be: the blocks moved to their new districts and every
-- village stayed at `ladakh.kargil.drass.matayan`, pointing at a district the block had
-- already left. Dropping the column list fixes it for every future boundary change too,
-- and the WHEN clause still keeps it from running when a path is untouched.
drop trigger if exists geo_units_repath_descendants on geo_units;

create trigger geo_units_repath_descendants
  after update on geo_units
  for each row when (old.path is distinct from new.path)
  execute function geo_units_repath_descendants();

-- The three new districts. Each takes the centroid of its namesake block, which is the
-- settlement the district is named for and administered from — the honest reading of a
-- coordinate already hand-checked, rather than one invented here. The blocks keep theirs.
insert into geo_units (type, parent_id, slug, name_en, name_ur, centroid)
select 'district', l.id, b.slug, b.name_en, b.name_ur, b.centroid
  from geo_units l
  join geo_units b on b.path = ('ladakh.kargil.' || b.slug)::extensions.ltree
 where l.path = 'ladakh'::extensions.ltree
   and b.type = 'block'
   and b.slug in ('sankoo', 'drass', 'zanskar')
on conflict (parent_id, slug) do nothing;

-- Re-parent the nine blocks. `geo_units_set_path` recomputes each block's own path and
-- `geo_units_repath_descendants` rewrites every village beneath it in one statement, so
-- nothing below needs naming here.
update geo_units b
   set parent_id = d.id
  from geo_units d
 where d.type = 'district'
   and d.parent_id = (select id from geo_units where path = 'ladakh'::extensions.ltree)
   and b.type = 'block'
   and b.parent_id = (select id from geo_units where path = 'ladakh.kargil'::extensions.ltree)
   and (
        (d.slug = 'drass'   and b.slug in ('drass', 'bhimbat'))
     or (d.slug = 'sankoo'  and b.slug in ('sankoo', 'tsg', 'barsoo', 'taisuru'))
     or (d.slug = 'zanskar' and b.slug in ('karsha', 'zanskar', 'lungnak'))
   );

-- `notices.geo_path` and `village_contacts.geo_path` are denormalised copies, maintained
-- by a trigger that fires on *their* geo_unit_id changing — not on the unit's path
-- changing underneath them. Nothing else refreshes them, and a stale copy is a notice
-- delivered to the wrong set of villages.
update notices n
   set geo_path = g.path
  from geo_units g
 where g.id = n.geo_unit_id
   and n.geo_path is distinct from g.path;

update village_contacts c
   set geo_path = g.path
  from geo_units g
 where g.id = c.geo_unit_id
   and c.geo_path is distinct from g.path;
