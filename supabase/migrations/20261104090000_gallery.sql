-- The village gallery (spec 03.3), and the moderation queue it brings with it.
--
-- Photos of places and festivals, contributed by villagers. This is the first table in the
-- app where a stranger's content reaches other people's screens, so it is also where
-- `mod_status` — declared in the very first enums migration and unused ever since —
-- finally earns its place.
--
-- **Pre-moderation**, as spec 03.3 writes it: `pending` → `approved`/`rejected`. The cost
-- is real and worth naming, because it is a product decision and not an oversight — in a
-- village whose admin opens the app twice a week, a photo sits invisible for days and the
-- person who sent it concludes the feature is broken. Two things soften it without
-- weakening it: **the uploader always sees their own photo**, pending or not, so they can
-- tell it arrived; and a rejection carries a reason that is shown to them.
--
-- The image bytes live in the `images` bucket under `<village>/<user>/<file>`, which the
-- storage policies already scope. This table is the record ABOUT the image: who sent it,
-- for which village, what it says, and whether it may be shown.

set search_path = public, extensions;

create table gallery_images (
  id           uuid primary key default gen_random_uuid(),
  geo_unit_id  uuid not null references geo_units(id) on delete cascade,
  -- Denormalised from `geo_units.path` by trigger, for the same reason `notices` does it:
  -- the visibility rule is an ltree containment test and joining through geo_units on
  -- every policy check is the difference between an index scan and a sequential one.
  geo_path     extensions.ltree not null,

  -- The object in the `images` bucket. Unique, so the same upload cannot be submitted
  -- twice by a retry that lost its answer — which the outbox will do on a bad connection.
  storage_path text not null unique,
  caption      text,

  uploaded_by  uuid not null references profiles(id) on delete cascade,

  status        mod_status not null default 'pending',
  reviewed_by   uuid references profiles(id),
  reviewed_at   timestamptz,
  -- Shown to the uploader. A rejection with no reason reads as arbitrary, and in a
  -- village of two hundred people an arbitrary rejection is a grievance with a name on it.
  reject_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint gallery_caption_length check (caption is null or length(caption) <= 280),
  constraint gallery_rejected_has_reason
    check (status <> 'rejected' or length(btrim(coalesce(reject_reason, ''))) > 0),
  constraint gallery_reviewed_together
    check ((reviewed_by is null) = (reviewed_at is null))
);

create or replace function gallery_images_set_path() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  select path into new.geo_path from geo_units where id = new.geo_unit_id;
  if new.geo_path is null then
    raise exception 'no_such_geo_unit' using errcode = '22023';
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger gallery_images_path
  before insert or update of geo_unit_id on gallery_images
  for each row execute function gallery_images_set_path();

create index gallery_images_geo_idx on gallery_images using gist (geo_path);
-- The two queries that matter: "what can I show this village" and "what is waiting for
-- me to review".
create index gallery_images_approved_idx
  on gallery_images (geo_unit_id, created_at desc) where status = 'approved';
create index gallery_images_pending_idx
  on gallery_images (geo_unit_id, created_at) where status = 'pending';
create index gallery_images_uploader_idx on gallery_images (uploaded_by, created_at desc);

alter table gallery_images enable row level security;

-- Three ways to see a row, and they are deliberately different people:
--   * anyone in the village, once it is approved;
--   * its uploader, always — so "did it send?" has an answer, and a rejection with its
--     reason reaches the person it is about;
--   * an admin of that village, always — there is nothing to moderate otherwise.
create policy gallery_images_readable on gallery_images
  for select to authenticated
  using (
    (status = 'approved' and my_village_path() operator(extensions.<@) geo_path)
    or uploaded_by = (select auth.uid())
    or admins_geo(geo_unit_id)
  );

grant select on gallery_images to authenticated;
-- No insert/update/delete grant: `uploaded_by`, `status` and the review columns are not
-- the client's to set, and the functions below are the only way they move.

-- ---------------------------------------------------------------------------
-- submit_gallery_image
-- ---------------------------------------------------------------------------

create or replace function submit_gallery_image(
  geo_unit     uuid,
  storage_path text,
  caption      text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  me     uuid := auth.uid();
  mine   uuid;
  new_id uuid;
begin
  if me is null then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  select village_id into mine from profiles where id = me;

  -- A villager contributes to their own village and nowhere else. Not `admins_geo`: this
  -- is the one path in the app open to someone with no role at all, so it is scoped by
  -- membership instead. An admin of a block uploading into a village they do not live in
  -- can do it the same way anyone else does — by being a member of it.
  if mine is null or mine <> geo_unit then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  -- The object must already be in the bucket, under this user's own folder, which the
  -- storage policy enforced on the way in. Checking the prefix here as well means a
  -- client cannot attach a row to someone else's object.
  if storage_path is null
     or storage_path not like (geo_unit::text || '/' || me::text || '/%') then
    raise exception 'storage path does not belong to this user' using errcode = '22023';
  end if;

  insert into gallery_images (geo_unit_id, storage_path, caption, uploaded_by)
  values (geo_unit, storage_path, nullif(btrim(coalesce(caption, '')), ''), me)
  returning id into new_id;

  return new_id;
end;
$$;

comment on function submit_gallery_image is
  'Records an uploaded image as pending for the caller''s own village. The bytes are '
  'already in the bucket; this is the row about them.';

-- ---------------------------------------------------------------------------
-- review_gallery_image
-- ---------------------------------------------------------------------------

create or replace function review_gallery_image(
  image_id uuid,
  approve  boolean,
  reason   text default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  me     uuid := auth.uid();
  target uuid;
begin
  select geo_unit_id into target from gallery_images where id = image_id;

  if me is null or target is null or not admins_geo(target) then
    -- One code for "no such row" and "not yours": telling them apart would say whether
    -- an id exists in a village the caller cannot see.
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  if not approve and length(btrim(coalesce(reason, ''))) = 0 then
    raise exception 'a rejection needs a reason' using errcode = '22023';
  end if;

  update gallery_images
     set status        = case when approve then 'approved' else 'rejected' end::mod_status,
         reject_reason = case when approve then null else btrim(reason) end,
         reviewed_by   = me,
         reviewed_at   = now(),
         updated_at    = now()
   where id = image_id;
end;
$$;

comment on function review_gallery_image is
  'Approves or rejects a pending image for a village the caller administers. A rejection '
  'must carry a reason, which its uploader can read.';

-- ---------------------------------------------------------------------------
-- withdraw_gallery_image
-- ---------------------------------------------------------------------------
-- Deletable, unlike a notice. A notice is a published record of what a village was told;
-- a photo is a thing someone shared and may want back, and the uploader is the only
-- person who can say it was a mistake. An admin can remove one too — a moderator who
-- cannot take something down is not a moderator.

create or replace function withdraw_gallery_image(image_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  me     uuid := auth.uid();
  row    gallery_images%rowtype;
begin
  select * into row from gallery_images where id = image_id;

  if me is null or row.id is null
     or not (row.uploaded_by = me or admins_geo(row.geo_unit_id)) then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  delete from gallery_images where id = image_id;

  -- Handed back so the caller can remove the object as well. The bytes are not deleted
  -- here: storage is a separate service, and a row that vanishes while its object stays
  -- is a smaller problem than a half-done transaction.
  return row.storage_path;
end;
$$;

comment on function withdraw_gallery_image is
  'Removes a gallery row, by its uploader or by an admin of its village, and returns the '
  'storage path so the caller can delete the object too.';

revoke execute on function submit_gallery_image(uuid, text, text) from public;
revoke execute on function review_gallery_image(uuid, boolean, text) from public;
revoke execute on function withdraw_gallery_image(uuid) from public;

grant execute on function submit_gallery_image(uuid, text, text) to authenticated;
grant execute on function review_gallery_image(uuid, boolean, text) to authenticated;
grant execute on function withdraw_gallery_image(uuid) to authenticated;
