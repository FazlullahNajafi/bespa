-- The village's own page, and its statistics (spec 03.1 §3 and §5).
--
-- Two tables, and the second one is the interesting one.
--
-- **Stats are rows, not columns.** `(metric_key, value, year, source)`, exactly as spec
-- 03.1 requires, because a village publishes population this year and literacy next year
-- and neither should cost a migration. The column-per-metric design that suggests itself
-- is wrong twice over: it needs a migration per metric, and it has nowhere to put the
-- year and the source that every figure has to carry.
--
-- That design earns its keep in 2026. Ladakh's fresh census is under way and its results
-- are not out, so every number a village can publish today is a 2011 figure. When the new
-- ones land an admin inserts them as another year and the screen moves forward on its own
-- — no release, no app update, and the old figures stay readable rather than being
-- overwritten by history.
--
-- **`source` and `year` are NOT NULL.** Spec 03.1: "unsourced figures are not shown". A
-- nullable source means filtering at read time in every caller and getting it wrong in
-- one of them; refusing the write is one rule in one place. "Census of India 2011" is a
-- source. "I think about two thousand" is not, and the field is there to make someone
-- type the difference.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- village_profiles — the description, the cover photo, the historical note
-- ---------------------------------------------------------------------------

create table village_profiles (
  geo_unit_id uuid primary key references geo_units(id) on delete cascade,
  geo_path    extensions.ltree not null,

  -- Spec 03.1 §3: "2–3 line description" on the card, the whole thing on the About page.
  description  text,
  -- Spec 03.1's "Village detail / About" asks for a founding or historical note. Separate
  -- from the description because the card shows one and not the other.
  history_note text,
  -- An object in the `images` bucket, same `<village>/<user>/<file>` shape as everything
  -- else. The card falls back to the gallery banner when this is null rather than
  -- shipping a placeholder photograph of somewhere that is not this village.
  cover_path   text,

  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id),

  constraint village_profiles_description_len check (length(description) <= 2000),
  constraint village_profiles_history_len     check (length(history_note) <= 4000)
);

create or replace function village_profiles_set_path() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  select path into new.geo_path from geo_units where id = new.geo_unit_id;
  if new.geo_path is null then
    raise exception 'no_such_geo_unit' using errcode = '22023';
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger village_profiles_path
  before insert or update on village_profiles
  for each row execute function village_profiles_set_path();

create index village_profiles_geo_idx on village_profiles using gist (geo_path);

alter table village_profiles enable row level security;

-- Readable by anyone inside it, like every other village-scoped table. Not readable
-- district-wide: tenancy is `profiles.village_id` throughout and a village page is not
-- the place to start making exceptions.
create policy village_profiles_readable on village_profiles
  for select to authenticated
  using (my_village_path() operator(extensions.<@) geo_path);

grant select on village_profiles to authenticated;

-- ---------------------------------------------------------------------------
-- village_stats — one row per figure per year
-- ---------------------------------------------------------------------------

create table village_stats (
  geo_unit_id uuid not null references geo_units(id) on delete cascade,
  geo_path    extensions.ltree not null,

  -- Deliberately `text` and not an enum. An enum would mean a migration to publish a
  -- metric nobody thought of, and ALTER TYPE ... ADD VALUE cannot run inside a
  -- transaction, so it would mean a migration of its own every time. Spec 03.1's list is
  -- described as a *suggested* seed set for exactly this reason. The check keeps it to
  -- one spelling — `population_total`, never `Population Total` — so two admins cannot
  -- split one metric in two.
  metric_key text not null,
  value      numeric not null,
  year       smallint not null,
  -- Spec 03.1: every number displays its source. Not nullable; see the header.
  source     text not null,

  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id),

  -- One figure per metric per year, so 2011 and 2026 populations coexist and the screen
  -- can show the newest while the older stays readable. This is the whole point of the
  -- row design and it is the primary key that delivers it.
  --
  -- Named explicitly because `set_village_stat` upserts `on conflict on constraint` —
  -- a conflict target written as a column list cannot be schema-qualified, and inside
  -- that function `metric_key` and `year` are also parameter names, so Postgres refuses
  -- it as ambiguous. Naming the constraint sidesteps the collision entirely.
  constraint village_stats_pkey primary key (geo_unit_id, metric_key, year),

  constraint village_stats_key_shape check (metric_key ~ '^[a-z][a-z0-9_]{2,48}$'),
  constraint village_stats_source_present check (length(btrim(source)) > 0),
  constraint village_stats_value_sane check (value >= 0),
  -- A census year, not a typo. The lower bound is the first Indian census.
  constraint village_stats_year_sane check (year between 1871 and 2100)
);

create or replace function village_stats_set_path() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  select path into new.geo_path from geo_units where id = new.geo_unit_id;
  if new.geo_path is null then
    raise exception 'no_such_geo_unit' using errcode = '22023';
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger village_stats_path
  before insert or update on village_stats
  for each row execute function village_stats_set_path();

create index village_stats_geo_idx on village_stats using gist (geo_path);
create index village_stats_browse_idx on village_stats (geo_unit_id, metric_key, year desc);

alter table village_stats enable row level security;

create policy village_stats_readable on village_stats
  for select to authenticated
  using (my_village_path() operator(extensions.<@) geo_path);

grant select on village_stats to authenticated;

-- ---------------------------------------------------------------------------
-- Writing — admins only, through definer functions as everywhere else
-- ---------------------------------------------------------------------------

create or replace function set_village_profile(
  geo_unit     uuid,
  description  text default null,
  history_note text default null,
  cover_path   text default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  me uuid := auth.uid();
begin
  if me is null or not admins_geo(geo_unit) then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  -- The cover must be an object this admin uploaded into this village, the same check
  -- `submit_place` and `submit_gallery_image` make. The storage policy enforced it on the
  -- way in; re-checked so a row cannot point at someone else's object.
  if cover_path is not null
     and cover_path not like (geo_unit::text || '/' || me::text || '/%') then
    raise exception 'photo does not belong to this user' using errcode = '22023';
  end if;

  insert into village_profiles as vp (geo_unit_id, description, history_note, cover_path, updated_by)
  values (geo_unit,
          nullif(btrim(coalesce(description, '')), ''),
          nullif(btrim(coalesce(history_note, '')), ''),
          cover_path,
          me)
  on conflict (geo_unit_id) do update
     set description  = excluded.description,
         history_note = excluded.history_note,
         -- A null cover on an update means "leave it alone", not "remove it": the edit
         -- screen sends the text fields on every save and the photo only when it changed.
         cover_path   = coalesce(excluded.cover_path, vp.cover_path),
         updated_by   = excluded.updated_by;
end;
$$;

comment on function set_village_profile is
  'Writes the village description, historical note and cover photo. Admins of that unit '
  'only. A null cover_path leaves the existing photo in place.';

create or replace function set_village_stat(
  geo_unit   uuid,
  metric_key text,
  value      numeric,
  year       smallint,
  source     text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  me uuid := auth.uid();
begin
  if me is null or not admins_geo(geo_unit) then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  if length(btrim(coalesce(source, ''))) = 0 then
    -- Spec 03.1: unsourced figures are not shown. Refusing the write is the only place
    -- this rule can live without every reader having to remember it.
    raise exception 'a figure needs a source' using errcode = '22023';
  end if;

  insert into village_stats (geo_unit_id, metric_key, value, year, source, updated_by)
  values (geo_unit, lower(btrim(set_village_stat.metric_key)), set_village_stat.value,
          set_village_stat.year, btrim(set_village_stat.source), me)
  on conflict on constraint village_stats_pkey do update
     set value      = excluded.value,
         source     = excluded.source,
         updated_by = excluded.updated_by;
end;
$$;

comment on function set_village_stat is
  'Publishes or corrects one figure for one year. The year is part of the key, so adding '
  'a 2026 census figure never overwrites the 2011 one.';

create or replace function delete_village_stat(
  geo_unit   uuid,
  metric_key text,
  year       smallint
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.uid() is null or not admins_geo(geo_unit) then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  delete from village_stats s
   where s.geo_unit_id = delete_village_stat.geo_unit
     and s.metric_key  = lower(btrim(delete_village_stat.metric_key))
     and s.year        = delete_village_stat.year;
end;
$$;

revoke execute on function set_village_profile(uuid, text, text, text) from public;
revoke execute on function set_village_stat(uuid, text, numeric, smallint, text) from public;
revoke execute on function delete_village_stat(uuid, text, smallint) from public;

grant execute on function set_village_profile(uuid, text, text, text) to authenticated;
grant execute on function set_village_stat(uuid, text, numeric, smallint, text) to authenticated;
grant execute on function delete_village_stat(uuid, text, smallint) to authenticated;
