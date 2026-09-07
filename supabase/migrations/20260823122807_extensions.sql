-- Extensions (spec 06 preamble).
-- Installed into the `extensions` schema per Supabase convention, never into `public`.
-- Every function that relies on ltree/postgis operators pins `search_path = public, extensions`.
--
-- pg_cron is deliberately NOT enabled here. It is only needed once the hold-sweep and
-- presence-expiry jobs exist (spec 06.11, Phase 3); enabling it early would make this
-- migration fail on projects where the extension has not been allow-listed yet.

create schema if not exists extensions;

create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "ltree"    with schema extensions;
create extension if not exists "postgis"  with schema extensions;
