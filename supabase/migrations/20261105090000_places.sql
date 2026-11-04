-- Places (spec 03.2): a visual directory of the physical village.
--
-- `place_category` is not new either — it was declared in the first enums migration in
-- August, twelve values, and has been waiting since. Same as `gallery_kind` and
-- `mod_status` before it.
--
-- Two things here are different from everything built so far.
--
-- **A place has a point, and the point is required.** Spec 03.2 step 5 is "drop a pin or
-- use my current location", and a place with no location is a row that cannot answer the
-- question people open this screen to ask — where is it, and how far away am I.
--
-- **The duplicate rule warns, it does not refuse.** Spec 03.2: "if a place of the same
-- category exists within 150 m, show 'Is this the same as X?' before allowing a new
-- entry." Two mosques really can stand a hundred metres apart in a Kargil village, so the
-- server's job is to make the submitter look at the other one, not to decide for them.
-- `places_near` is what the screen asks first; `submit_place` refuses only when the
-- submitter has not been shown the answer.

set search_path = public, extensions;

create table places (
  id          uuid primary key default gen_random_uuid(),
  geo_unit_id uuid not null references geo_units(id) on delete cascade,
  geo_path    extensions.ltree not null,

  category    place_category not null,
  name_en     text not null,
  -- Optional, and null rather than guessed, like every other name in this schema.
  name_bft    text,
  description text,

  point       extensions.geography(Point, 4326) not null,
  -- PostgREST hands a geography column back as WKB hex, which the app would have to
  -- parse — the same wall `my_weather_point` hit in October. Two generated columns are
  -- the cheap way out: Postgres keeps them in step, the client reads numbers, and nothing
  -- can write a coordinate that disagrees with the point it came from.
  lat double precision
    generated always as (extensions.st_y(point::extensions.geometry)) stored,
  lon double precision
    generated always as (extensions.st_x(point::extensions.geometry)) stored,

  -- 1..5 objects in the `images` bucket. An array rather than a child table: the count is
  -- small and fixed by the spec, every read wants all of them, and a join to fetch at most
  -- five paths is a join on every list row.
  photo_paths text[] not null,

  -- Spec 03.2 step 6, both optional.
  phone       text,
  timings     text,

  status        mod_status not null default 'pending',
  submitted_by  uuid not null references profiles(id) on delete cascade,
  reviewed_by   uuid references profiles(id),
  reviewed_at   timestamptz,
  reject_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint places_name_present check (length(btrim(name_en)) > 0),
  constraint places_photos_count
    check (array_length(photo_paths, 1) between 1 and 5),
  constraint places_phone_e164
    check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  constraint places_rejected_has_reason
    check (status <> 'rejected' or length(btrim(coalesce(reject_reason, ''))) > 0),
  constraint places_reviewed_together
    check ((reviewed_by is null) = (reviewed_at is null))
);

create or replace function places_set_path() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  select path into new.geo_path from geo_units where id = new.geo_unit_id;
  if new.geo_path is null then
    raise exception 'no_such_geo_unit' using errcode = '22023';
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger places_path
  before insert or update of geo_unit_id on places
  for each row execute function places_set_path();

create index places_geo_idx on places using gist (geo_path);
-- The duplicate check and "how far away is it" both ask the same spatial question.
create index places_point_idx on places using gist (point);
create index places_browse_idx
  on places (geo_unit_id, category, name_en) where status = 'approved';
create index places_pending_idx
  on places (geo_unit_id, created_at) where status = 'pending';

alter table places enable row level security;

-- The same three readers as the gallery, and for the same reasons: the village sees what
-- is approved, a submitter always sees their own so "did it send?" has an answer and a
-- rejection reaches them, and an admin sees everything or there is nothing to moderate.
create policy places_readable on places
  for select to authenticated
  using (
    (status = 'approved' and my_village_path() operator(extensions.<@) geo_path)
    or submitted_by = (select auth.uid())
    or admins_geo(geo_unit_id)
  );

grant select on places to authenticated;

-- ---------------------------------------------------------------------------
-- places_near — what the duplicate prompt is built from
-- ---------------------------------------------------------------------------

create or replace function places_near(
  category place_category,
  lat      double precision,
  lon      double precision,
  radius_m double precision default 150
)
returns table (id uuid, name_en text, distance_m double precision)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  -- The probe point comes out of a CTE rather than being written inline, the same shape
  -- `geo_nearest` uses. `places.lat` and `places.lon` exist as columns, so a bare `lat`
  -- in a query over `places` is ambiguous between the parameter and the row — and
  -- Postgres resolves it to the row, which silently turns the whole filter into
  -- "is this place within 150 m of itself".
  with here as (
    select extensions.st_setsrid(
             extensions.st_makepoint(places_near.lon, places_near.lat), 4326
           )::extensions.geography as p
  )
  select pl.id, pl.name_en, extensions.st_distance(pl.point, here.p)
    from places pl, here
   where pl.category = places_near.category
     and pl.status = 'approved'
     -- st_dwithin, not a distance filter: it is the form the GIST index answers.
     and extensions.st_dwithin(pl.point, here.p, places_near.radius_m)
   order by 3
   limit 5;
$$;

comment on function places_near is
  'Approved places of the same category within radius_m, for spec 03.2''s "is this the '
  'same as X?" prompt. RLS still applies, so it only ever names places the caller can see.';

-- ---------------------------------------------------------------------------
-- submit_place
-- ---------------------------------------------------------------------------

create or replace function submit_place(
  geo_unit    uuid,
  category    place_category,
  name_en     text,
  lat         double precision,
  lon         double precision,
  photo_paths text[],
  description text default null,
  name_bft    text default null,
  phone       text default null,
  timings     text default null,
  -- Set by the screen once it has shown the submitter what is already there. The server
  -- cannot know whether a person looked at a prompt, so this is the screen asserting it
  -- did — which is the honest shape for a warning that is not a refusal.
  duplicate_acknowledged boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  me     uuid := auth.uid();
  mine   uuid;
  nearby text;
  new_id uuid;
  path   text;
begin
  if me is null then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  select village_id into mine from profiles where id = me;

  -- A villager contributes to their own village and nowhere else. Same rule as the
  -- gallery: this is open to anyone with no role at all, so membership is the scope.
  if mine is null or mine <> geo_unit then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  if coalesce(array_length(photo_paths, 1), 0) not between 1 and 5 then
    raise exception 'a place needs between one and five photos' using errcode = '22023';
  end if;

  -- Every object must sit under this user's own folder in this village, which the storage
  -- policy already enforced on the way in. Re-checked so a row cannot be attached to
  -- someone else's photo.
  foreach path in array photo_paths loop
    if path not like (geo_unit::text || '/' || me::text || '/%') then
      raise exception 'photo does not belong to this user' using errcode = '22023';
    end if;
  end loop;

  if not duplicate_acknowledged then
    -- Asked here rather than through `places_near`, and scoped to this village. Inside a
    -- security-definer function RLS does not apply, so `places_near` would see the whole
    -- district — and then refuse a submission naming a place the submitter was never
    -- shown, because their own call to `places_near` is filtered by the policy. The
    -- warning and the refusal have to be looking at the same set.
    select pl.name_en into nearby
      from places pl,
           lateral (select extensions.st_setsrid(
                             extensions.st_makepoint(submit_place.lon, submit_place.lat), 4326
                           )::extensions.geography as p) here
     where pl.geo_unit_id = submit_place.geo_unit
       and pl.category = submit_place.category
       and pl.status = 'approved'
       and extensions.st_dwithin(pl.point, here.p, 150)
     order by extensions.st_distance(pl.point, here.p)
     limit 1;

    if nearby is not null then
      -- Its own code, so the client can tell "there is already one of these nearby" from
      -- any other refusal and show the prompt rather than an error.
      raise exception 'possible duplicate of %', nearby using errcode = 'PT409';
    end if;
  end if;

  insert into places (geo_unit_id, category, name_en, name_bft, description,
                      point, photo_paths, phone, timings, submitted_by)
  values (geo_unit, category, btrim(name_en),
          nullif(btrim(coalesce(name_bft, '')), ''),
          nullif(btrim(coalesce(description, '')), ''),
          extensions.st_setsrid(extensions.st_makepoint(lon, lat), 4326)::extensions.geography,
          photo_paths,
          nullif(btrim(coalesce(phone, '')), ''),
          nullif(btrim(coalesce(timings, '')), ''),
          me)
  returning id into new_id;

  return new_id;
end;
$$;

comment on function submit_place is
  'Submits a place for the caller''s own village as pending. Refuses with PT409 when an '
  'approved place of the same category is within 150 m and the submitter has not been '
  'shown it.';

-- ---------------------------------------------------------------------------
-- review_place / withdraw_place
-- ---------------------------------------------------------------------------

create or replace function review_place(place_id uuid, approve boolean, reason text default null)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  me     uuid := auth.uid();
  target uuid;
begin
  select geo_unit_id into target from places where id = place_id;

  if me is null or target is null or not admins_geo(target) then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  if not approve and length(btrim(coalesce(reason, ''))) = 0 then
    raise exception 'a rejection needs a reason' using errcode = '22023';
  end if;

  update places
     set status        = case when approve then 'approved' else 'rejected' end::mod_status,
         reject_reason = case when approve then null else btrim(reason) end,
         reviewed_by   = me,
         reviewed_at   = now(),
         updated_at    = now()
   where id = place_id;
end;
$$;

create or replace function withdraw_place(place_id uuid)
returns text[]
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  me  uuid := auth.uid();
  row places%rowtype;
begin
  select * into row from places where id = place_id;

  if me is null or row.id is null
     or not (row.submitted_by = me or admins_geo(row.geo_unit_id)) then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  delete from places where id = place_id;

  -- The photo paths go back so the caller can remove the objects too, same as the
  -- gallery: storage is a separate service and a half-done transaction across both is
  -- worse than an orphaned object nothing can reach.
  return row.photo_paths;
end;
$$;

comment on function review_place is
  'Approves or rejects a pending place for a village the caller administers.';
comment on function withdraw_place is
  'Removes a place, by its submitter or an admin, returning its photo paths.';

revoke execute on function places_near(place_category, double precision, double precision, double precision) from public;
revoke execute on function submit_place(uuid, place_category, text, double precision, double precision, text[], text, text, text, text, boolean) from public;
revoke execute on function review_place(uuid, boolean, text) from public;
revoke execute on function withdraw_place(uuid) from public;

grant execute on function places_near(place_category, double precision, double precision, double precision) to authenticated;
grant execute on function submit_place(uuid, place_category, text, double precision, double precision, text[], text, text, text, text, boolean) to authenticated;
grant execute on function review_place(uuid, boolean, text) to authenticated;
grant execute on function withdraw_place(uuid) to authenticated;
