-- Kargil town (spec 02.2).
--
-- Spec 02.2 draws Town as a sibling of Village under the block:
--
--     Block (Kargil)
--     ├── Village (Minjee, Trespone, Baroo …)
--     └── Town (Kargil)
--
-- Only the rural half was ever seeded. `gen-geo-seed.py` reads the district's revenue
-- village spreadsheet, and the district headquarters is not a revenue village — so the
-- largest settlement in Kargil had no row at all, and a resident of the town had nothing
-- correct to pick. The picker *is* a user's tenancy, so "nothing correct to pick" means
-- "cannot use the app honestly".
--
-- It surfaced through "use my location": standing in Kargil town, `geo_nearest` proposed
-- **Akchamal**, a village 2.2 km away in another block, because that was the nearest
-- thing the table held.
--
-- `004` and not part of `001`, where the blocks are, because of the centroid below: this
-- has to run after `003`, which is what puts centroids on anything at all.

-- The centroid is copied from the block rather than typed in here. `geocode-villages.py`
-- resolved that block by asking a geocoder for "Kargil", and a geocoder asked for Kargil
-- answers with the town — so the point has always been the town's, sitting on a rural
-- block that spans tens of kilometres. Copying it is an honest reading of data already
-- held, rather than a coordinate invented in a seed file. The block keeps its copy,
-- which `my_weather_point()` falls back to for the villages that have none.
--
-- Migration `20261021200000` carries the same INSERT, for projects seeded before this
-- file existed: `supabase db push` skips seeds once the migration history is current, so
-- neither copy alone reaches both a fresh database and an existing one. Both are
-- `on conflict do nothing`, so whichever runs second is a no-op.
insert into geo_units (type, parent_id, slug, name_en, name_ur, centroid)
select 'town', b.id, 'kargil_town', 'Kargil', 'کرگل', b.centroid
  from geo_units b
 where b.path = 'ladakh.kargil.kargil'::extensions.ltree
on conflict (parent_id, slug) do nothing;

-- Deliberately only Kargil. Other settlements may also warrant a town row — Drass is the
-- obvious candidate — but spec 02.2 names Kargil and names no other, and the tenancy
-- spine is the one table where an invented row is most expensive to unpick later (see
-- the honesty rule in `001_geo_kargil.sql`). They arrive with the LGD import.
