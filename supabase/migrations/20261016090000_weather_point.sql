-- The coordinate to ask a weather provider about, for the signed-in user's village
-- (spec 03.1).
--
-- An RPC rather than selecting `geo_units.centroid` from the client, for two reasons.
-- PostgREST hands a geography column back as WKB hex, which the app would have to parse
-- to get a latitude out of. And the fallback belongs here: most villages did not resolve
-- to a coordinate of their own -- geocoders cover small Ladakhi hamlets poorly -- so they
-- borrow their block's point, and that rule should live in one place rather than in
-- whichever screen asks next.
--
-- `exact` says which happened, so the caller can name the place honestly: a reading taken
-- at the block centre is labelled with the block, not with a village it is only near.

set search_path = public, extensions;

create or replace function my_weather_point()
returns table (
  lat    double precision,
  lon    double precision,
  place  text,
  exact  boolean
)
language sql
stable
security invoker          -- geo_units and profiles are both readable by the owner
set search_path = public, extensions
as $$
  select extensions.st_y(point::geometry) as lat,
         extensions.st_x(point::geometry) as lon,
         case when v.centroid is not null then v.name_en else b.name_en end as place,
         v.centroid is not null as exact
    from profiles p
    join geo_units v on v.id = p.village_id
    left join geo_units b on b.id = v.parent_id
    cross join lateral (select coalesce(v.centroid, b.centroid) as point) pt
   where p.id = auth.uid()
     and pt.point is not null;
$$;

comment on function my_weather_point is
  'Lat/lon for the signed-in user''s village, falling back to its block. `exact` is false '
  'when the block''s point was used, so the caller can label the reading with the block.';

revoke execute on function my_weather_point() from public;
grant execute on function my_weather_point() to authenticated;
