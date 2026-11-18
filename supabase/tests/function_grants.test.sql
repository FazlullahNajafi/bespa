-- pgTAP: who may call the functions that no session guards.
--
-- Most security-definer functions here defend themselves — `auth.uid() is null` raises
-- `not_permitted`, so a caller who is nobody gets nothing. Six do not, because their
-- caller was never meant to be a session at all: a GitHub job or an edge function
-- holding the secret key. For those six the GRANT *is* the security.
--
-- And the GRANT was not what it looked like. `revoke execute ... from public` leaves
-- `anon` exactly where it was, because Supabase's default privileges grant EXECUTE on a
-- new function to `anon`, `authenticated` and `service_role` explicitly, and revoking
-- from PUBLIC does not touch an explicit grant. The publishable key is in the APK.
--
-- This file is the regression guard for the class rather than the instance: a new
-- service-key function added without its revoke fails here, not in a village.
--
-- Run: npm run db:test

begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Service-key only: neither a signed-out caller nor a signed-in one
-- ---------------------------------------------------------------------------

-- Returns `expo_token` per user. The sender's own docstring calls the secret key "the
-- ONLY key that may read a push token", and until 20261118060000 that was not true.
select ok(not has_function_privilege('anon', 'notice_push_queue(integer)', 'execute'),
          'anon cannot read the push queue');
select ok(not has_function_privilege('authenticated', 'notice_push_queue(integer)', 'execute'),
          'nor can a signed-in user — a push token is not theirs to read either');

select ok(not has_function_privilege('anon', 'record_notice_push(uuid)', 'execute'),
          'anon cannot mark a notice as pushed');
select ok(not has_function_privilege('authenticated', 'record_notice_push(uuid)', 'execute'),
          'nor can a signed-in user');

select ok(not has_function_privilege('anon', 'forget_device_token(text)', 'execute'),
          'anon cannot delete a device token');
select ok(not has_function_privilege('authenticated', 'forget_device_token(text)', 'execute'),
          'nor can a signed-in user');

-- An official notice pushes to every village under its geo unit.
select ok(not has_function_privilege('anon',
            'import_official_notice(text,text,text,text,text,notice_category,timestamptz,timestamptz)',
            'execute'),
          'anon cannot publish an official district notice');
select ok(not has_function_privilege('authenticated',
            'import_official_notice(text,text,text,text,text,notice_category,timestamptz,timestamptz)',
            'execute'),
          'nor can a signed-in user');

select ok(not has_function_privilege('anon',
            'record_digilocker_licence(uuid,text,text,jsonb)', 'execute'),
          'anon cannot record a DigiLocker licence');
select ok(not has_function_privilege('authenticated',
            'record_digilocker_licence(uuid,text,text,jsonb)', 'execute'),
          'nor can a signed-in user');

-- The secret key is the caller all six were written for, and must keep working.
select ok(has_function_privilege('service_role', 'notice_push_queue(integer)', 'execute'),
          'the secret key still reads the push queue');
select ok(has_function_privilege('service_role',
            'record_digilocker_licence(uuid,text,text,jsonb)', 'execute'),
          'and still records a DigiLocker licence');

-- ---------------------------------------------------------------------------
-- Signed in, but not signed out
-- ---------------------------------------------------------------------------

-- The trip list asks which of these drivers carry the badge. It answers about any uuid
-- it is handed, so a caller who is nobody has no business asking.
select ok(not has_function_privilege('anon', 'verified_drivers(uuid[])', 'execute'),
          'anon cannot ask who is a verified driver');

select * from finish();
rollback;
