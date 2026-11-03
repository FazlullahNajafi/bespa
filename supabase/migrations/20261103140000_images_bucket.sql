-- The images bucket (spec 03.2, 03.3, 10.5's Phase 1 spike).
--
-- One bucket for everything villagers contribute — gallery photos, place photos, a
-- village cover — because they share one access rule: a photo belongs to a village, and
-- a village's photos are for that village.
--
-- **Private, not public.** A place photo shows a house and a gallery photo shows faces,
-- and spec 02.1's whole posture is that village-scoped means village-scoped. A public
-- bucket would make every object readable by anyone who guesses or is given the URL, with
-- the policy below reduced to decoration. Reads go through a signed URL instead.
--
-- The path is `<village_id>/<user_id>/<file>` and that is load-bearing: the first segment
-- is what the policies check, so an upload cannot be addressed into another village's
-- folder and a read cannot reach out of your own. Postgres `storage.foldername()` splits
-- it.

set search_path = public, extensions;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', false, 4194304,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 4 MiB, and the client resizes to 1600px before it uploads. Both halves are needed: a
-- limit that lives only in the client is not a limit, and a limit that lives only in the
-- server wastes a villager's data allowance before telling them.

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

-- Read: your own village's images. Not the district's, not the block's — the same
-- "villagers means users whose village_id equals yours" rule as the directory.
create policy images_read_own_village on storage.objects
  for select to authenticated
  using (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = my_village()::text
  );

-- Write: into your own village's folder, under your own user id. The second segment
-- being the uploader is what makes "whose photo is this" answerable without a side
-- table, and what lets the delete policy below be written at all.
create policy images_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = my_village()::text
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

-- Remove: your own, or anything in a village you administer. A moderator who cannot
-- remove a photo is not a moderator, and spec 03.3 puts gallery moderation on the
-- panchayat admin.
create policy images_delete_own_or_admin on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'images'
    and (
      (storage.foldername(name))[2] = (select auth.uid())::text
      or admins_geo(nullif((storage.foldername(name))[1], '')::uuid)
    )
  );

-- No UPDATE policy, deliberately. An image is replaced by uploading another and removing
-- the old one; letting a row be updated in place would mean a photo could change under a
-- caption that was approved for the one before it.
