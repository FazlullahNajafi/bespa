-- Profile edit and the privacy onboarding step (spec 03.4, 03.6, 10.5 Phase 0).
--
-- Three things, in order of importance:
--
--   1. It narrows the UPDATE grants on the identity tables to the columns a user may
--      actually write. This is a privilege-escalation fix, not tidying — see below.
--   2. It adds `profiles.privacy_reviewed_at`, the flag the auth gate reads to decide
--      whether the privacy step has been shown.
--   3. It adds `set_my_privacy`, which writes the four flags and stamps that column in
--      one transaction.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- 1. Column-level UPDATE grants
-- ---------------------------------------------------------------------------
-- `grant update on profiles to authenticated` with a `using (id = auth.uid())` policy
-- reads as "a user may edit their own profile". What it actually permits is
--
--     update profiles set roles = '{super_admin}' where id = auth.uid();
--
-- which satisfies the policy, because the policy constrains the ROW, not the columns.
-- `has_role('super_admin')` then short-circuits `admins_geo` for every geo unit in the
-- district — full escalation from any signed-up account. The same grant also let a user
-- write `village_id` directly, walking straight past `set_my_village`'s 30-day limit and
-- its audit log, which is the control standing in front of scraping a neighbouring
-- village's directory (spec 02.2).
--
-- `profile_private.phone_verified` was writable the same way, and `is_phone_verified()`
-- is what gates posting and booking.
--
-- RLS cannot express this: a policy filters rows. Column privileges are the mechanism
-- Postgres provides, so the fix is to grant exactly the editable columns. Everything
-- else moves to a security-definer function, which bypasses grants by design.
--
-- Only UPDATE is narrowed. SELECT stays table-wide, deliberately: a column-level SELECT
-- grant makes `select *` fail outright, which through PostgREST is a trap.

revoke update on profiles        from authenticated;
revoke update on profile_private from authenticated;
revoke update on privacy_settings from authenticated;

-- Spec 03.6's editable set, minus phone (its own table) and village (its own RPC).
grant update (full_name, avatar_path, occupation, bio) on profiles to authenticated;

-- Not `phone_verified`: that is set by the OTP flow, as a definer, or not at all.
grant update (phone) on profile_private to authenticated;

-- The four flags of spec 03.4. Not `user_id` — re-pointing the row at someone else is
-- already refused by the policy, but there is no reason to leave it writable.
grant update (show_phone, show_avatar, show_occupation, in_directory)
  on privacy_settings to authenticated;

-- ---------------------------------------------------------------------------
-- Changing a phone number un-verifies it
-- ---------------------------------------------------------------------------
-- Otherwise a verified number could be swapped for an unverified one while keeping the
-- verified flag — which is the same hole as granting the column, reached a different way.
--
-- The `phone_verified` comparison is what keeps the future OTP flow working: a definer
-- that sets phone and phone_verified = true in one statement is left alone, because it
-- moves that column itself. A client update cannot, since it has no grant on it.

create or replace function profile_private_unverify_on_change()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.phone is distinct from old.phone
     and new.phone_verified is not distinct from old.phone_verified then
    new.phone_verified := false;
  end if;
  return new;
end $$;

create trigger profile_private_unverify
  before update on profile_private
  for each row execute function profile_private_unverify_on_change();

-- ---------------------------------------------------------------------------
-- 2. The privacy step's flag
-- ---------------------------------------------------------------------------
-- Spec 03.4 requires the privacy settings to be presented on their own screen during
-- onboarding, "not buried in Settings". That makes it a gate state, and a gate state
-- needs something durable to read: the defaults are written by `handle_new_user`, so the
-- row's existence proves nothing about whether anyone saw it.
--
-- It lives on `profiles` rather than on `privacy_settings` because the auth gate already
-- reads the profile on every cold start to decide routing. On `privacy_settings` it would
-- cost a second round trip before first paint, on connections where that is the budget
-- (spec 09: first paint under 4s on a 2 GB Android).
--
-- Not granted to `authenticated` above, so only `set_my_privacy` can stamp it.

alter table profiles add column privacy_reviewed_at timestamptz;

comment on column profiles.privacy_reviewed_at is
  'When the user last confirmed their privacy settings. Null routes them to the onboarding privacy step.';

-- ---------------------------------------------------------------------------
-- 3. set_my_privacy
-- ---------------------------------------------------------------------------
-- An RPC rather than two PostgREST writes, for the reason spec 07 gives for layer 2: it
-- is one transaction. "Settings saved" and "the step is done" must not be able to
-- disagree — a client that wrote the flags and then died would leave the user looping
-- through the onboarding step forever, re-applying settings that are already in place.

create or replace function set_my_privacy(
  show_phone      visibility,
  show_avatar     visibility,
  show_occupation visibility,
  in_directory    boolean
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    -- 42501 insufficient_privilege -> PostgREST 403 -> errors.ts 'not_permitted'.
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  -- Spec 03.4 offers "officials only" for the phone number and nothing else. The
  -- `visibility` enum carries all three values for every column, so without this an
  -- avatar could be stored as 'officials' — which `directory_members` tests for equality
  -- with 'villagers' and would therefore hide, silently, with the UI showing a third
  -- state that does not exist.
  if show_avatar = 'officials' or show_occupation = 'officials' then
    raise exception 'officials-only applies to the phone number' using errcode = '22023';
  end if;

  update privacy_settings s
     set show_phone      = set_my_privacy.show_phone,
         show_avatar     = set_my_privacy.show_avatar,
         show_occupation = set_my_privacy.show_occupation,
         in_directory    = set_my_privacy.in_directory
   where s.user_id = me;

  -- A row is created for every user by handle_new_user, so a miss means the profile is
  -- gone underneath us rather than that this is a first write.
  if not found then
    raise exception 'no privacy row for this user' using errcode = '42501';
  end if;

  update profiles set privacy_reviewed_at = now() where id = me;
end $$;

revoke execute on function set_my_privacy(visibility, visibility, visibility, boolean) from public;
grant execute on function set_my_privacy(visibility, visibility, visibility, boolean) to authenticated;

comment on function set_my_privacy is
  'Writes the caller''s four privacy flags and marks the onboarding privacy step complete.';
