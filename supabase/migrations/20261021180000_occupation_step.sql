-- Ask for an occupation during onboarding (spec 03.6, design `screens-profile.jsx`).
--
-- The design puts "Tell us about you" between sign-in and the location flow, and asks for
-- the occupation as a tile grid. It was never built: occupation existed only in profile
-- edit, which almost nobody opens, so the directory — the whole point of spec 03.3 — was
-- going to be a list of names and nothing else.
--
-- The gate flag lives on `profiles` for the same reason `privacy_reviewed_at` does: the
-- auth gate reads this row on every cold start, and a second table would make routing
-- cost a second query. Like that one, only a definer function may stamp it — a flag the
-- client can write is a flag that drifts from what actually happened.
--
-- Asked, not required. Not every villager has an occupation to name, and the screen has
-- a Skip; `occupation_asked_at` records that the question was put, which is what stops
-- it being asked again, whether or not it was answered.

set search_path = public, extensions;

alter table profiles add column occupation_asked_at timestamptz;

comment on column profiles.occupation_asked_at is
  'When the onboarding occupation step was shown and dismissed, answered or skipped. '
  'Null routes the user to (onboarding)/occupation. Stamped only by set_my_occupation.';

create or replace function set_my_occupation(p_occupation text default null)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  me    uuid := auth.uid();
  value text := nullif(btrim(p_occupation), '');
begin
  if me is null then
    -- 42501 insufficient_privilege -> PostgREST 403 -> errors.ts 'not_permitted'.
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  -- Spec 03.6 ends the occupation list with "other + free text", so this is text and not
  -- an enum, and the only thing to enforce is that it stays a job title rather than a
  -- paragraph: it is rendered in one line of a directory row.
  if value is not null and length(value) > 60 then
    raise exception 'occupation too long' using errcode = 'check_violation';
  end if;

  -- A null argument is "skip", not "clear": the step is the first time anyone is asked,
  -- but it is also reachable by a user who already has an occupation from profile edit,
  -- and skipping a question must never delete an answer already given.
  update profiles
     set occupation          = coalesce(value, occupation),
         occupation_asked_at = now(),
         updated_at          = now()
   where id = me;
end;
$$;

comment on function set_my_occupation is
  'Sets the caller''s occupation and marks the onboarding step done. A null or blank '
  'argument skips: it stamps the flag and leaves any existing occupation alone.';

revoke execute on function set_my_occupation(text) from public;
grant execute on function set_my_occupation(text) to authenticated;
