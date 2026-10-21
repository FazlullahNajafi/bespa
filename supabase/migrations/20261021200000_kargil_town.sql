-- Kargil town, which was missing from the geography entirely (spec 02.2).
--
-- The spine in spec 02.2 draws Town as a sibling of Village under the block:
--
--     Block (Kargil)
--     ├── Village (Minjee, Trespone, Baroo …)
--     └── Town (Kargil)
--
-- Only the rural half was ever seeded. `gen-geo-seed.py` reads the district's revenue
-- village spreadsheet, and the district headquarters is not a revenue village — so the
-- largest settlement in Kargil had no row, and a resident of the town had nothing
-- correct to pick. The picker is the whole of a user's tenancy, so "nothing correct to
-- pick" means "cannot use the app honestly".
--
-- It surfaced through "use my location": standing in Kargil town, `geo_nearest` returned
-- **Akchamal**, 2.2 km away in Soudh block — the nearest thing it knew about. That is the
-- failure mode the distance cap was written for, and it still could not help, because the
-- right answer did not exist in the table.
--
-- This row is declared TWICE, here and in `seed/001_geo_kargil.sql`, and neither copy is
-- redundant. Migrations run before seeds, so on a fresh database the block this hangs
-- off does not exist yet and the statement below inserts nothing — the seed does the
-- work. On a project that was seeded months ago, the seed never runs again (`db push`
-- skips seeds once the migration history is current) and this is the only thing that
-- reaches it. Both are `on conflict do nothing`, so whichever runs second is a no-op.

set search_path = public, extensions;

-- The centroid is taken from the block rather than typed in. `geocode-villages.py`
-- resolved the block by asking a geocoder for "Kargil", and a geocoder asked for Kargil
-- answers with the town — so that point has always been the town's, sitting on the row
-- for a rural block that spans tens of kilometres. Copying it is the honest reading of
-- data we already have, rather than a coordinate invented here.
--
-- The block keeps its copy: `my_weather_point()` falls back to it for the 50 villages
-- that have no centroid of their own.
insert into geo_units (type, parent_id, slug, name_en, name_ur, centroid)
select 'town', b.id, 'kargil_town', 'Kargil', 'کرگل', b.centroid
  from geo_units b
 where b.path = 'ladakh.kargil.kargil'::extensions.ltree
on conflict (parent_id, slug) do nothing;

-- Deliberately only Kargil. Other settlements in the district may also warrant a town
-- row — Drass is the obvious candidate — but spec 02.2 names Kargil and nothing names
-- the others, and the tenancy spine is the one table where an invented row is most
-- expensive to unpick later (see the honesty rule in `seed/001_geo_kargil.sql`). They
-- arrive with the LGD import, with `lgd_code` populated and parentage hand-checked.
