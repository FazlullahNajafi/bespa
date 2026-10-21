-- `geo_nearest`: when no village is close enough, fall back to a block and *only* a block.
--
-- The first version ranked a nearby village above everything else and then ordered the
-- rest by distance — which meant that with no village within `village_km`, a village 9 km
-- away could still win over the block the caller is standing in. That is precisely the
-- case the distance cap exists to prevent: the picker pre-selects whatever comes back and
-- offers "Continue as a member of X", so a far-off village is a confident wrong answer
-- rather than the narrowed list the comment promised.
--
-- Two candidates, picked in order instead: the nearest village or town *within*
-- `village_km`, else the nearest block. A block proposes nobody's tenancy — it just
-- shortens the walk to a handful of villages and lets the resident name their own.
--
-- Found by a test that was asserting the intended behaviour rather than the shipped one,
-- after Kargil town was added and moved the goalposts on the fixture.

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
  distance_m double precision
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with here as (
    select extensions.st_setsrid(
             extensions.st_makepoint(lon, lat), 4326
           )::extensions.geography as p
  ),
  -- A place someone can actually be a member of, close enough to believe.
  close_locality as (
    select g.id, g.path, extensions.st_distance(g.centroid, h.p) as distance_m, 0 as rank
      from geo_units g
      cross join here h
     where g.centroid is not null
       and g.type in ('village', 'town')
       -- st_dwithin, not an ORDER BY over the table: it is the form the GIST index on
       -- `centroid` can answer.
       and extensions.st_dwithin(g.centroid, h.p, village_km * 1000)
     order by distance_m
     limit 1
  ),
  -- The consolation. 50 of 129 villages have no centroid at all, so "no village nearby"
  -- usually means "we cannot see the right one", not "there is none".
  nearest_block as (
    select g.id, g.path, extensions.st_distance(g.centroid, h.p) as distance_m, 1 as rank
      from geo_units g
      cross join here h
     where g.centroid is not null
       and g.type = 'block'
       and extensions.st_dwithin(g.centroid, h.p, max_km * 1000)
     order by distance_m
     limit 1
  ),
  candidate as (
    select * from (
      select * from close_locality
      union all
      select * from nearest_block
    ) candidates
     order by rank
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
  'shortcut. Matches a village/town within village_km; failing that, the nearest block '
  'and never a distant village. distance_m is set on the matched row alone. Reads only — '
  'the user still confirms.';

revoke execute on function geo_nearest(double precision, double precision, double precision, double precision) from public;
grant execute on function geo_nearest(double precision, double precision, double precision, double precision) to authenticated;
