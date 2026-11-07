-- Driver verification as an onboarding step (spec 04.5, design `screens-driver-verify`).
--
-- The design says verification is "triggered when a user picks 'Taxi Driver' on the
-- occupation step", and until now it was not: the occupation screen pushed the
-- verification route and the auth gate — which routes with `replace` the moment the
-- profile refetches — threw the push away. A driver signing up never saw it.
--
-- A push cannot win against that gate and should not try. Onboarding here is a sequence
-- of flags on `profiles` that the gate reads, and this is a fourth one. The shape is
-- `occupation_asked_at`'s exactly, for the same reason it exists: a step that cannot be
-- marked done is a step somebody is trapped on.
--
-- **Asked, not required.** The flag is stamped whether the driver sends their papers or
-- taps "later", because a man standing in a shop with no signal and a licence in his
-- other pocket must still be able to reach the app. The gate in `create_trip` and
-- `go_live` is what makes verification mean something; this screen only has to be seen
-- once.
--
-- It runs **after** privacy rather than immediately after the occupation step. The
-- design's "triggered by" is about cause, not screen order, and village and privacy are
-- the two steps that decide whether the app can show anything at all — a new driver
-- should reach a working app before being asked to photograph a licence.

set search_path = public, extensions;

alter table profiles add column driver_docs_asked_at timestamptz;

comment on column profiles.driver_docs_asked_at is
  'Null, for a user whose occupation is driver, routes them to (onboarding)/driver-papers. '
  'Stamped only by mark_driver_docs_asked. Deliberately not granted to the user: a flag '
  'the client can write is a flag that gets written to skip the step it guards.';

create or replace function mark_driver_docs_asked()
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  -- Idempotent and never un-stamped. Re-running it must not move the timestamp, or a
  -- driver revisiting the screen from Transport would re-enter onboarding.
  update profiles p
     set driver_docs_asked_at = now()
   where p.id = (select auth.uid())
     and p.driver_docs_asked_at is null;
end $$;

comment on function mark_driver_docs_asked is
  'Marks the driver-papers step as seen, whether or not anything was uploaded.';

revoke execute on function mark_driver_docs_asked() from public;
grant execute on function mark_driver_docs_asked() to authenticated;
