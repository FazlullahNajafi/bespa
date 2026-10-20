-- Make the geography root as unique as every other level (spec 02.2, 06.2).
--
-- `unique (parent_id, slug)` does not constrain the root, because a unique constraint
-- treats NULLs as distinct and the root is the one row with `parent_id is null`. So
-- `(null, 'ladakh')` never conflicts with `(null, 'ladakh')`, and the seed's
-- `on conflict (parent_id, slug) do nothing` — which makes every other level idempotent —
-- is a no-op there.
--
-- This is not theoretical. Running the seed twice against the hosted project inserted a
-- second Ladakh, and then every statement below it joined `where path = 'ladakh'`, matched
-- both roots, and duplicated the entire tree: 2 districts, 30 blocks, 258 villages. Two
-- rows for the same real village, each a different `village_id`, is the worst possible
-- failure in this table — tenancy is `profiles.village_id`, so two neighbours could have
-- picked "Gongma Minjee" and landed in different villages, each invisible to the other.
--
-- `nulls not distinct` (Postgres 15+) makes the existing constraint mean what it reads
-- like it means. Preferred over a partial unique index on `(slug) where parent_id is null`
-- because the seed's `on conflict (parent_id, slug)` then keeps working unchanged — a
-- partial index needs its predicate repeated at every call site, which is one more thing
-- to forget.

set search_path = public, extensions;

alter table geo_units drop constraint geo_units_parent_id_slug_key;

alter table geo_units
  add constraint geo_units_parent_id_slug_key
  unique nulls not distinct (parent_id, slug);

comment on constraint geo_units_parent_id_slug_key on geo_units is
  'Siblings have distinct slugs. NULLS NOT DISTINCT so the parentless root is covered too.';
