-- Find the caller's place from a coordinate (spec 02.2, design `screens-location.jsx`).
--
-- The picker's cascade is four taps deep and the design puts an "Use my location /
-- Detect my location" card above it as the primary shortcut. This is the server half:
-- given a point, return the chain of geo units from the root down to the best match, so
-- the client can jump the whole walk in one round trip rather than four.
--
-- Two deliberate choices, both about being wrong honestly.
--
-- **A village is only accepted when it is close.** `geocode-villages.py` resolved 79 of
-- 129 village centroids — geocoders cover small Ladakhi hamlets badly — so the nearest
-- village *with a centroid* can easily be the wrong side of a ridge. Inside
-- `village_km` it is a plausible "you are here"; beyond it, the nearest **block** is the
-- better answer, because it narrows the list to a handful of villages and lets the
-- resident name their own. A wrong village silently chosen is a wrong tenancy, and
-- tenancy decides what someone can see.
--
-- **The match is a proposal, never a write.** This function only reads; `set_my_village`
-- still runs behind the user's confirmation, with its 30-day limit and its audit log.

set search_path = public, extensions;

create or replace function geo_nearest(
  lat double precision,
  lon double precision,
  village_km double precision default 6,
  max_km double precision default 30
)
returns table (
  id       uuid,
  type     geo_type,
  name_en  text,
  name_ur  text,
  name_bft text,
  slug     text,
  has_children boolean,
  -- Metres to the caller, on the matched row only. Null on an ancestor, which is not
  -- the thing that was matched and whose own centroid may be hundreds of kilometres off
  -- (the UT's is the middle of a cold desert).
  distance_m double precision
)
language sql
stable
security invoker           -- deliberately invoker: geo_units RLS is the access rule
set search_path = public, extensions
as $$
  with here as (
    select extensions.st_setsrid(
             extensions.st_makepoint(lon, lat), 4326
           )::extensions.geography as p
  ),
  candidate as (
    select g.id,
           g.path,
           extensions.st_distance(g.centroid, h.p) as distance_m,
           case
             when g.type in ('village', 'town')
              and extensions.st_distance(g.centroid, h.p) <= village_km * 1000
             then 0
             else 1
           end as rank
      from geo_units g
      cross join here h
     where g.centroid is not null
       and g.type in ('village', 'town', 'block')
       -- st_dwithin, not an ORDER BY on the whole table: it is the form the GIST index
       -- on `centroid` can answer.
       and extensions.st_dwithin(g.centroid, h.p, max_km * 1000)
     order by rank, distance_m
     limit 1
  )
  select g.id, g.type, g.name_en, g.name_ur, g.name_bft, g.slug,
         exists (select 1 from geo_units c where c.parent_id = g.id) as has_children,
         case when g.id = m.id then m.distance_m end as distance_m
    from candidate m
    join geo_units g on g.path operator(extensions.@>) m.path
   order by extensions.nlevel(g.path);
$$;

comment on function geo_nearest is
  'Root-to-match chain of geo units for a coordinate, for the picker''s "use my location" '
  'shortcut. Matches a village/town only within village_km, else the nearest block; '
  'distance_m is set on the matched row alone. Reads only — the user still confirms.';

revoke execute on function geo_nearest(double precision, double precision, double precision, double precision) from public;
grant execute on function geo_nearest(double precision, double precision, double precision, double precision) to authenticated;
