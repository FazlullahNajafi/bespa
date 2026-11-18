-- `revoke execute ... from public` does not close a function to `anon`.
--
-- This repo has used that line since the first migration, on the assumption that a
-- function revoked from PUBLIC is reachable only by what is granted it afterwards.
-- Supabase's default privileges grant EXECUTE on every new function in `public` to
-- `anon`, `authenticated` and `service_role` *explicitly*, and revoking from PUBLIC
-- leaves an explicit grant exactly where it was. The ACL says so plainly:
--
--     proacl: postgres=X/postgres | anon=X/postgres | service_role=X/postgres
--
-- So every security-definer function in this schema has been callable by `anon` — and
-- the publishable key is in the APK, which anyone can unzip. Most of them survive that
-- because they check `auth.uid()` themselves and refuse a caller who is nobody. Six did
-- not, and they are the six here.
--
-- **It was caught by a test, on a Postgres image CI had not used before.** The pgTAP
-- assertion "anon cannot execute record_digilocker_licence" passed locally and failed in
-- CI, because CI pins the Supabase CLI to `latest` and the newer image sets those default
-- privileges while the older one did not. The assertion was right both times; only one of
-- the two databases was telling the truth.
--
-- The worst of the six is `notice_push_queue`. It returns `expo_token` per user, and the
-- sender's own docstring says the secret key is "the ONLY key that may read a push
-- token". It was not.
--
-- `service_role` keeps all six: that is the key the GitHub jobs and the DigiLocker edge
-- function hold, and it is the only caller any of them were written for.

-- --------------------------------------------------------------------------
-- Service-key only. No `auth.uid()` appears in any of these, by design — their
-- caller is a script or an edge function, never a session.
-- --------------------------------------------------------------------------

-- Reads device push tokens for the villages a notice covers.
revoke execute on function notice_push_queue(integer) from public, anon, authenticated;

-- Stamps `notices.pushed_at` and returns who was notified.
revoke execute on function record_notice_push(uuid) from public, anon, authenticated;

-- Deletes a device token Expo has reported as dead.
revoke execute on function forget_device_token(text) from public, anon, authenticated;

-- Writes an official district notice, which then pushes to every village under its geo
-- unit. Open to `anon`, this was "anyone with the app's own key may announce anything to
-- a district".
revoke execute on function import_official_notice(
  text, text, text, text, text, notice_category, timestamptz, timestamptz
) from public, anon, authenticated;

-- Marks a driving licence approved. The one route to `approved` that no human reviews,
-- and it takes the driver as an argument rather than reading a session.
revoke execute on function record_digilocker_licence(uuid, text, text, jsonb) from public, anon, authenticated;

-- --------------------------------------------------------------------------
-- Client function, signed-in only. `authenticated` keeps it — the trip list asks which
-- of these drivers carry the badge — but it answers that question about any uuid it is
-- given, and a caller who is nobody has no business asking.
-- --------------------------------------------------------------------------
revoke execute on function verified_drivers(uuid[]) from public, anon;
