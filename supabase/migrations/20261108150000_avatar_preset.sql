-- A chosen illustration instead of a photograph (spec 03.4, 08.5).
--
-- `profiles.avatar_path` has existed since the identity migration and nothing has ever
-- written it: the directory and Home draw coloured initials. Initials are a reasonable
-- answer and stay the default, but spec 03.4 publishes a new profile to the whole
-- village, and in Kargil a photograph of a woman's face is something many families will
-- not put there. The honest third option is an illustration the person picks.
--
-- **Picked, never inferred.** There is no way to tell from a name whether somebody wears
-- a hijab, and a wrong guess is wrong about a real person on a screen their neighbours
-- read. So this is a column the user sets and nothing derives.
--
-- A separate column rather than a sentinel in `avatar_path` — `preset:hijabi` would
-- have to be special-cased everywhere a storage path is signed, and the first place it
-- was missed would try to fetch an object called "preset:hijabi".

set search_path = public, extensions;

alter table profiles add column avatar_preset text;

-- A closed list, checked here rather than trusted: the client renders one drawing per
-- value, so a value with no drawing is a blank circle.
alter table profiles add constraint profiles_avatar_preset_known
  check (avatar_preset is null or avatar_preset in ('man', 'hijabi', 'woman'));

comment on column profiles.avatar_preset is
  'An illustrated avatar the user chose. Null means fall back to avatar_path, then to '
  'initials. Never inferred from the name.';

-- Writable by its owner, like the other four columns a person may edit about
-- themselves. The row policy already limits that to their own profile.
grant update (avatar_preset) on profiles to authenticated;

-- ---------------------------------------------------------------------------
-- The directory has to carry it, behind the same privacy gate
-- ---------------------------------------------------------------------------
--
-- `directory_members` already hides `avatar_path` unless `show_avatar = 'villagers'`.
-- The preset is the same kind of fact about the same person and gets the same gate:
-- somebody who hid their photograph did not thereby agree to publish a drawing of
-- themselves, and an ungated column here would quietly undo the setting beside it.

create or replace view directory_members with (security_invoker = true) as
  select p.id,
         p.full_name,
         p.village_id,
         p.panchayat_id,
         p.roles,
         p.created_at,
         case when s.show_avatar     = 'villagers' then p.avatar_path end as avatar_path,
         case when s.show_occupation = 'villagers' then p.occupation  end as occupation,
         (s.show_phone in ('villagers', 'officials'))                     as phone_available,
         -- Appended rather than slotted in beside `avatar_path` where it belongs:
         -- `create or replace view` may add columns at the end and may not rename or
         -- reorder the ones already there, and dropping the view to tidy the column
         -- order would drop its grant with it.
         case when s.show_avatar     = 'villagers' then p.avatar_preset end as avatar_preset
    from profiles p
    join privacy_settings s on s.user_id = p.id
   where p.is_active and s.in_directory;

grant select on directory_members to authenticated;

comment on view directory_members is
  'Client-facing directory projection. Never exposes a phone number — see '
  'rpc.get_member_contact. Both avatar columns sit behind show_avatar.';
