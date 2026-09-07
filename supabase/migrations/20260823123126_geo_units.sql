-- Geography: the tenancy spine (spec 02.2, 06.2).
-- One self-referencing adjacency list, with a materialised ltree `path` so ancestor and
-- descendant tests are index-backed operators (`child.path <@ ancestor.path`) rather than
-- recursive CTEs on every request.

set search_path = public, extensions;

create table geo_units (
  id         uuid primary key default gen_random_uuid(),
  parent_id  uuid references geo_units(id) on delete restrict,
  type       geo_type not null,
  name_en    text not null,
  name_ur    text,
  name_bft   text,                               -- Purgi / Balti
  slug       text not null,
  lgd_code   text,                               -- Local Government Directory reconciliation
  path       extensions.ltree not null,          -- maintained by trigger
  centroid   extensions.geography(Point, 4326),
  created_at timestamptz not null default now(),
  unique (parent_id, slug),
  -- ltree labels are [A-Za-z0-9_]; enforce the narrower slug form we actually use so a
  -- bad insert fails loudly here instead of inside the trigger.
  constraint geo_units_slug_is_ltree_label check (slug ~ '^[a-z0-9_]{1,63}$'),
  -- Only a root node (the UT) may be parentless.
  constraint geo_units_root_is_ut check (parent_id is not null or type = 'ut')
);

create index geo_units_path_idx     on geo_units using gist (path);
create index geo_units_parent_idx   on geo_units (parent_id);
create index geo_units_centroid_idx on geo_units using gist (centroid);
create index geo_units_type_idx     on geo_units (type);
create unique index geo_units_lgd_code_idx on geo_units (lgd_code) where lgd_code is not null;

-- ---------------------------------------------------------------------------
-- Path maintenance
-- ---------------------------------------------------------------------------

-- Before insert, and whenever a node is renamed or moved, recompute its own path.
create or replace function geo_units_set_path()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  parent_path extensions.ltree;
begin
  if new.parent_id is null then
    new.path := new.slug::extensions.ltree;
  else
    select g.path into parent_path from geo_units g where g.id = new.parent_id;
    if parent_path is null then
      raise exception 'parent geo_unit % does not exist', new.parent_id
        using errcode = 'foreign_key_violation';
    end if;
    if tg_op = 'UPDATE' and parent_path operator(extensions.<@) old.path then
      raise exception 'cannot move geo_unit % beneath its own descendant', new.id
        using errcode = 'check_violation';
    end if;
    new.path := parent_path operator(extensions.||) new.slug::extensions.ltree;
  end if;
  return new;
end $$;

create trigger geo_units_set_path
  before insert or update of parent_id, slug on geo_units
  for each row execute function geo_units_set_path();

-- When a node's path changes, rewrite every descendant's path in one statement.
-- The guard on the trigger stops the cascade once paths are correct.
create or replace function geo_units_repath_descendants()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update geo_units g
     set path = new.path operator(extensions.||)
                extensions.subpath(g.path, extensions.nlevel(old.path))
   where g.path operator(extensions.<@) old.path
     and g.id <> new.id;
  return null;
end $$;

create trigger geo_units_repath_descendants
  after update of path on geo_units
  for each row when (old.path is distinct from new.path)
  execute function geo_units_repath_descendants();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- Geography is reference data: every signed-in user reads all of it (the onboarding
-- picker needs to walk the tree). Nobody writes it from the app — a missing village is a
-- support request, which keeps the namespace clean (spec 02.2). Writes happen through
-- migrations and seeds, which run as `postgres` and bypass RLS.

alter table geo_units enable row level security;

create policy geo_units_read_authenticated
  on geo_units for select
  to authenticated
  using (true);

comment on table geo_units is
  'Administrative hierarchy (UT -> district -> block -> village|town -> panchayat|municipality). '
  'profiles.village_id points at the village|town level and is the tenancy key for nearly every RLS policy.';

-- ---------------------------------------------------------------------------
-- Table privileges
-- ---------------------------------------------------------------------------
-- RLS filters rows you can already reach; it does not grant reach. Without these
-- grants every policy above is unreachable and the table reads as "permission denied".
-- Granted per policy: read where a `select` policy exists, write where an `update` one does.
-- No inserts: rows are created by security-definer functions, not by the client.

grant select on geo_units to authenticated;
