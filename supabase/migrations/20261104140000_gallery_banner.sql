-- Gallery tabs and the Home banner (spec 03.1 §2, 03.3).
--
-- Two additions to `gallery_images`, and one thing deliberately NOT added.
--
-- **`kind`** gives spec 03.3's three tabs — All · Places · Festivals — using the
-- `gallery_kind` enum declared in August and unused until now, without inventing a
-- relationship. The spec wants a festival photo tagged to a `calendar_event` so it also
-- surfaces on that event's page, and wants a place photo tied to a place; neither table
-- exists, and both are Phase 2 and Phase 1-after-maps respectively. A foreign key to a
-- table that does not exist cannot be written, and a free-text stand-in for one would
-- have to be unpicked later. So this is the coarse fact — which of the three a photo is —
-- and `calendar_event_id` / `place_id` join it when those tables arrive.
--
-- **`banner_position`** is the Home carousel. Spec 03.3 makes the selection an admin
-- action rather than a personal one, against the brief's own suggestion, because the
-- banner is the village's shared front page and not anybody's favourites list.

set search_path = public, extensions;

-- `gallery_kind` is not new: it was declared in the very first enums migration back in
-- August, as ('place','festival','general'), in anticipation of this. Using it rather
-- than minting a near-identical type with 'other' in place of 'general' — which is what
-- the first attempt did, and what the database refused.

alter table gallery_images
  add column kind gallery_kind not null default 'general',
  -- 1..5, or null for "not on the banner". Spec 03.1 caps the carousel at five: it is
  -- the front page of a village on a 2 GB phone, not an album.
  add column banner_position smallint,
  add constraint gallery_banner_range
    check (banner_position is null or banner_position between 1 and 5);

-- One photo per slot per village, and the index is partial so the nulls — which are most
-- rows — cost nothing and do not collide with each other.
create unique index gallery_banner_slot_idx
  on gallery_images (geo_unit_id, banner_position)
  where banner_position is not null;

create index gallery_kind_idx
  on gallery_images (geo_unit_id, kind, created_at desc) where status = 'approved';

comment on column gallery_images.kind is
  'Which tab it belongs to (spec 03.3). A coarse stand-in until calendar_events and '
  'places exist to be referenced properly.';

comment on column gallery_images.banner_position is
  'Slot on the village''s Home carousel, 1..5, or null. Set only by set_village_banner.';

-- ---------------------------------------------------------------------------
-- set_village_banner
-- ---------------------------------------------------------------------------
-- The whole ordered set in one call, rather than a toggle per photo. The banner is a
-- *sequence*, and five toggles racing each other is how two photos end up in slot 3 and
-- an admin on a bad connection ends up with a banner that is half of what they chose.

create or replace function set_village_banner(geo_unit uuid, image_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  me       uuid := auth.uid();
  eligible int;
begin
  if me is null or not admins_geo(geo_unit) then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  if coalesce(array_length(image_ids, 1), 0) > 5 then
    raise exception 'a banner holds at most five photos' using errcode = '22023';
  end if;

  -- Every id must be an approved photo of THIS village. Checked as a count rather than
  -- row by row so that a list containing one bad id changes nothing at all: a banner
  -- that silently drops the photo an admin meant to put first is worse than a refusal.
  select count(*) into eligible
    from gallery_images
   where id = any(coalesce(image_ids, '{}'::uuid[]))
     and geo_unit_id = geo_unit
     and status = 'approved';

  if eligible <> coalesce(array_length(image_ids, 1), 0) then
    raise exception 'every banner photo must be an approved photo of this village'
      using errcode = '22023';
  end if;

  -- Cleared first, so a photo moving from slot 4 to slot 1 does not trip the unique
  -- index against its own old position.
  update gallery_images
     set banner_position = null, updated_at = now()
   where geo_unit_id = geo_unit and banner_position is not null;

  update gallery_images g
     set banner_position = chosen.position, updated_at = now()
    from (
      select id, ordinality::smallint as position
        from unnest(coalesce(image_ids, '{}'::uuid[])) with ordinality as t(id, ordinality)
    ) chosen
   where g.id = chosen.id;
end;
$$;

comment on function set_village_banner is
  'Replaces the whole Home carousel for a village the caller administers, in the order '
  'given. Refuses the set outright if any photo is not an approved one of that village.';

-- ---------------------------------------------------------------------------
-- set_gallery_kind
-- ---------------------------------------------------------------------------
-- Its uploader can say what a photo is, and an admin can correct it while reviewing —
-- the person who took it knows, and the person who approves it is the one looking.

create or replace function set_gallery_kind(image_id uuid, new_kind gallery_kind)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  me  uuid := auth.uid();
  row gallery_images%rowtype;
begin
  select * into row from gallery_images where id = image_id;

  if me is null or row.id is null
     or not (row.uploaded_by = me or admins_geo(row.geo_unit_id)) then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  update gallery_images
     set kind = new_kind, updated_at = now()
   where id = image_id;
end;
$$;

comment on function set_gallery_kind is
  'Sets which tab a photo belongs to, by its uploader or an admin of its village.';

revoke execute on function set_village_banner(uuid, uuid[]) from public;
revoke execute on function set_gallery_kind(uuid, gallery_kind) from public;

grant execute on function set_village_banner(uuid, uuid[]) to authenticated;
grant execute on function set_gallery_kind(uuid, gallery_kind) to authenticated;
