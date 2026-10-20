-- Notices (spec 03.5, 06.4), and the official-source mirror behind them.
--
-- One table carries two quite different things:
--
--   * a **village notice**, written in the app by someone the village knows, scoped to
--     one geo unit, editable by its author's office;
--   * an **official notice**, mirrored from `kargil.nic.in`, scoped to the district,
--     authored by a government office, and never editable here.
--
-- One table because the user-facing feed is one list and `geo_unit_id` already expresses
-- the difference in scope. The cost is that "which kind is this" must be enforced rather
-- than assumed, so the three CHECK constraints below encode it: a local notice has an
-- author and a body, a mirrored one has a source URL. Neither shape can be written wrong.
--
-- Spec 09.3 risk 1b: the mirror is the PRIMARY source, not the fallback. It is what makes
-- the module useful in a village whose sarpanch never posts — the same reasoning that
-- gives Transport a callable driver directory at zero liveness.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Sources, and the kill switch
-- ---------------------------------------------------------------------------
-- Bespa has no LAHDC sponsor (spec 09.4 #2). Mirroring a government body's notices
-- without one is defensible as an index, but it has to be revocable *immediately* if the
-- administration objects — minutes, not a release. Hence a row read at query time rather
-- than a constant in the bundle: flipping `enabled` hides every mirrored notice at once.
--
-- It also holds the attribution the UI shows, so "Source: LAHDC Kargil" is data rather
-- than a hard-coded string the next source would have to work around.

create table notice_sources (
  key          text primary key,
  label        text not null,
  homepage_url text,
  enabled      boolean not null default true,
  -- Plain-language note rendered under a mirrored notice. Kept here so the disclaimer
  -- travels with the source instead of being reinvented per screen.
  disclaimer   text
);

insert into notice_sources (key, label, homepage_url, enabled, disclaimer) values
  ('local', 'Your village', null, true, null),
  ('lahdc', 'LAHDC Kargil', 'https://kargil.nic.in/', true,
   'Published by the district administration. Bespa links to the original and is not a government service.');

-- ---------------------------------------------------------------------------
-- Notices
-- ---------------------------------------------------------------------------

create table notices (
  id           uuid primary key default gen_random_uuid(),
  geo_unit_id  uuid not null references geo_units(id) on delete cascade,

  -- Denormalised from `geo_units.path` by trigger, because the visibility rule in spec
  -- 03.5 is `my village path <@ notice.geo_path` and evaluating that through a join on
  -- every row of every policy check is the difference between an index scan and a
  -- sequential one. A district notice reaches every village beneath it this way.
  geo_path     extensions.ltree not null,

  category     notice_category not null default 'general',
  title        text not null,
  -- Empty for a mirrored notice, whose content lives in the linked PDF. Constrained
  -- below so a *local* notice can never be empty.
  body         text not null default '',

  is_pinned    boolean not null default false,
  published_by uuid references profiles(id),   -- null for a mirrored notice
  published_at timestamptz not null default now(),
  -- Spec 03.5 archives expired notices rather than hiding them, so this is never a
  -- visibility filter in RLS — only an ordering and sectioning hint for the client.
  expires_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  source       text not null default 'local' references notice_sources(key),
  -- The original document. For 'lahdc' this is the PDF on kargil.nic.in, and the app
  -- links to it rather than reproducing its contents (spec 09.4 #2).
  source_url   text,
  -- Natural key for the importer. The PDF URL is what the district site gives us that is
  -- stable per notice, and uniqueness on it is what makes a re-run a no-op rather than a
  -- second copy — the same lesson as the geography seed.
  source_ref   text,
  fetched_at   timestamptz,

  -- A local notice is written by somebody, in words. Both halves matter: an unattributed
  -- notice that pushes to a whole village is exactly what accountability is for.
  constraint notices_local_has_author
    check (source <> 'local' or published_by is not null),
  constraint notices_local_has_body
    check (source <> 'local' or length(btrim(body)) > 0),
  -- A mirrored notice must point at its original, or the app is reproducing a government
  -- document with no way for a reader to check it.
  constraint notices_mirrored_has_url
    check (source = 'local' or source_url is not null)
);

create unique index notices_source_ref_idx
  on notices (source, source_ref) where source_ref is not null;

create index notices_geo_published_idx on notices (geo_unit_id, published_at desc);
-- GiST, not btree: the visibility test is ltree containment, not equality.
create index notices_geo_path_idx on notices using gist (geo_path);

create trigger notices_set_updated_at
  before update on notices
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- geo_path upkeep
-- ---------------------------------------------------------------------------
-- Derived, never supplied by a caller: a client that could set `geo_path` freely could
-- publish a notice to the whole district by writing `ladakh.kargil` while naming its own
-- village in `geo_unit_id`.

create or replace function notices_set_geo_path()
returns trigger language plpgsql set search_path = public, extensions as $$
begin
  select g.path into new.geo_path from geo_units g where g.id = new.geo_unit_id;
  if new.geo_path is null then
    raise exception 'no such geo unit %', new.geo_unit_id using errcode = '22023';
  end if;
  return new;
end $$;

create trigger notices_geo_path
  before insert or update of geo_unit_id on notices
  for each row execute function notices_set_geo_path();

-- ---------------------------------------------------------------------------
-- Helper: the caller's own village path
-- ---------------------------------------------------------------------------

create or replace function my_village_path() returns extensions.ltree
  language sql stable security definer set search_path = public, extensions as
$$ select g.path from profiles p join geo_units g on g.id = p.village_id
    where p.id = auth.uid() $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table notices        enable row level security;
alter table notice_sources enable row level security;

-- Sources are reference data the UI renders attribution from.
create policy notice_sources_read on notice_sources
  for select to authenticated using (true);

-- A notice is visible when the reader's village sits at or beneath the notice's geo unit
-- (spec 03.5), and when its source is switched on.
create policy notices_read on notices
  for select to authenticated
  using (
    my_village_path() operator(extensions.<@) geo_path
    and exists (
      select 1 from notice_sources s where s.key = notices.source and s.enabled
    )
  );

-- Editing is for the office that published it, and never for a mirrored notice: those
-- are somebody else's words, and the only honest way to correct one is at the source.
create policy notices_update_admin on notices
  for update to authenticated
  using (source = 'local' and admins_geo(geo_unit_id))
  with check (source = 'local' and admins_geo(geo_unit_id));

-- ---------------------------------------------------------------------------
-- publish_notice
-- ---------------------------------------------------------------------------
-- An RPC, not an insert grant, for the reason this project grants no inserts anywhere:
-- `published_by` must be the caller and a client cannot be trusted to say who it is.
-- `source` is likewise not a caller's choice — nothing from the app may claim to be an
-- official notice.

create or replace function publish_notice(
  geo_unit   uuid,
  title      text,
  body       text,
  category   notice_category default 'general',
  is_pinned  boolean default false,
  expires_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  me uuid := auth.uid();
  new_id uuid;
begin
  if me is null then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  -- `admins_geo` is true for the unit itself and anything beneath it, so a village
  -- admin can post to their village and a district admin to the whole district — while
  -- a village admin naming the district is refused, because the district is an ancestor
  -- of their scope rather than a descendant.
  if not admins_geo(geo_unit) then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  if length(btrim(title)) = 0 or length(btrim(body)) = 0 then
    raise exception 'a notice needs a title and a body' using errcode = '22023';
  end if;

  insert into notices (geo_unit_id, category, title, body, is_pinned, expires_at,
                       published_by, source)
  values (geo_unit, publish_notice.category, btrim(title), btrim(body),
          publish_notice.is_pinned, publish_notice.expires_at, me, 'local')
  returning id into new_id;

  return new_id;
end $$;

revoke execute on function publish_notice(uuid, text, text, notice_category, boolean, timestamptz) from public;
grant execute on function publish_notice(uuid, text, text, notice_category, boolean, timestamptz) to authenticated;

comment on function publish_notice is
  'Publishes a village notice as the caller, for a geo unit they administer.';

-- ---------------------------------------------------------------------------
-- import_official_notice
-- ---------------------------------------------------------------------------
-- The mirror's only way in. Granted to `service_role` alone, so the importer's key opens
-- exactly one door: it can create and refresh `source <> 'local'` rows and nothing else.
--
-- Idempotent on (source, source_ref). Re-running the scraper refreshes titles and dates
-- in place; it never inserts a second copy, and it never deletes. A parse failure must
-- look like "no new notices", never like "the district withdrew everything".

create or replace function import_official_notice(
  p_source       text,
  p_source_ref   text,
  p_source_url   text,
  -- An ltree path, not an id, so the importer never has to read `geo_units`.
  -- `service_role` bypasses RLS but NOT table privileges, so looking the district up
  -- from the client would have meant granting it SELECT on the geography — widening the
  -- importer's key from "may call one function" to "may read a table". Resolving it in
  -- here keeps that key to exactly one capability.
  p_geo_path     text,
  p_title        text,
  p_category     notice_category default 'general',
  p_published_at timestamptz default now(),
  p_expires_at   timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  new_id  uuid;
  v_geo   uuid;
begin
  -- Parameters carry a `p_` prefix for one unavoidable reason: an ON CONFLICT target
  -- cannot be table-qualified, so a parameter named `source` makes
  -- `on conflict (source, source_ref)` ambiguous and the function fails at runtime
  -- rather than at creation. Positional callers are unaffected.
  if p_source = 'local' then
    raise exception 'the importer may not write village notices' using errcode = '22023';
  end if;
  if not exists (select 1 from notice_sources s where s.key = p_source) then
    raise exception 'unknown notice source %', p_source using errcode = '22023';
  end if;
  if p_source_ref is null or length(btrim(p_source_ref)) = 0 then
    raise exception 'an imported notice needs a stable source_ref' using errcode = '22023';
  end if;

  select g.id into v_geo
    from geo_units g where g.path = p_geo_path::extensions.ltree;
  if v_geo is null then
    raise exception 'no geo unit at path %', p_geo_path using errcode = '22023';
  end if;

  insert into notices (geo_unit_id, category, title, body, published_at, expires_at,
                       source, source_url, source_ref, fetched_at)
  values (v_geo, p_category, btrim(p_title), '',
          p_published_at, p_expires_at,
          p_source, p_source_url, btrim(p_source_ref), now())
  on conflict (source, source_ref) where source_ref is not null do update
    set title        = excluded.title,
        category     = excluded.category,
        published_at = excluded.published_at,
        expires_at   = excluded.expires_at,
        source_url   = excluded.source_url,
        geo_unit_id  = excluded.geo_unit_id,
        fetched_at   = now()
  returning id into new_id;

  return new_id;
end $$;

revoke execute on function import_official_notice(text, text, text, text, text, notice_category, timestamptz, timestamptz) from public;
revoke execute on function import_official_notice(text, text, text, text, text, notice_category, timestamptz, timestamptz) from authenticated;
grant execute on function import_official_notice(text, text, text, text, text, notice_category, timestamptz, timestamptz) to service_role;

comment on function import_official_notice is
  'Upserts a mirrored official notice. service_role only; cannot write source = local.';

-- ---------------------------------------------------------------------------
-- Table privileges
-- ---------------------------------------------------------------------------
-- Column-level UPDATE, per the rule migration 20261019120000 had to learn the hard way:
-- the policy decides which ROW an admin may touch, and only the grant decides which
-- COLUMNS. Without this, an admin could rewrite `source` to 'lahdc' and dress a village
-- notice up as a government one, or move `geo_unit_id` to the district and reach every
-- village in Kargil.
--
-- No DELETE, deliberately. A notice that has already pushed to a whole village cannot be
-- unsent, and a silent disappearance is worse than a visible correction: edit the body
-- and set `expires_at`, which moves it to the Archive spec 03.5 describes.

grant select on notice_sources to authenticated;
grant select on notices        to authenticated;
grant update (title, body, category, is_pinned, expires_at) on notices to authenticated;
