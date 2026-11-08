-- The village and the two units above it, for Home's header (spec 03.1 §1).
--
-- Tried first as a PostgREST self-embed:
--
--   parent:geo_units!geo_units_parent_id_fkey(name_en, type, parent:geo_units!…(…))
--
-- and it came back empty on the device while the row plainly existed. A self-referencing
-- foreign key is ambiguous by *direction* — the same constraint describes "my parent"
-- and "my children", and naming it does not say which. Rather than discover which hint
-- syntax a given PostgREST version wants, ask for exactly what the header needs.
--
-- One round trip, which is the other half of the point: three chained reads to put
-- "Minjee · Kargil · Kargil" under a greeting is three on a cold start over 2G.

set search_path = public, extensions;

create or replace function village_chain(unit uuid)
returns table (
  name_en   text,
  name_bft  text,
  block     text,
  district  text
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select v.name_en,
         v.name_bft,
         b.name_en,
         d.name_en
    from geo_units v
    left join geo_units b on b.id = v.parent_id
    left join geo_units d on d.id = b.parent_id
   where v.id = unit;
$$;

comment on function village_chain is
  'A village with the names of the two units above it. Security invoker, so the '
  'geo_units read policy still applies — this exposes nothing a picker could not.';

revoke execute on function village_chain(uuid) from public;
grant execute on function village_chain(uuid) to authenticated;
