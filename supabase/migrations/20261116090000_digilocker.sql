-- DigiLocker licence verification (spec 04.7).
--
-- A licence pulled from DigiLocker is signed by the issuing transport authority, so it
-- answers a question a photograph cannot: is this document real. What it does not replace
-- is the manual path — a driver whose licence is not in DigiLocker, which in Kargil will
-- be some of them, still uploads a picture and an admin still judges it. So this adds a
-- second route to `approved` rather than a different table.
--
-- Nothing here calls the provider. The edge functions do that, because the API secret
-- must never be in the app bundle: an APK is a zip file.

set search_path = public, extensions;

-- How a document reached `approved`. Null on rows that predate this, and on anything
-- still pending — it records the route taken, not an intention.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'doc_verification_source') then
    create type doc_verification_source as enum ('admin', 'digilocker');
  end if;
end $$;

alter table driver_documents
  add column if not exists verified_via doc_verification_source,
  -- The issuer's own metadata, kept verbatim. Worth storing unparsed: it is the evidence
  -- behind the approval, and the shape differs per document type and per issuer.
  add column if not exists issuer_meta jsonb;

comment on column driver_documents.verified_via is
  'How this reached approved: an admin''s judgement, or the issuer''s signature via '
  'DigiLocker. Null while pending.';

-- A document approved by DigiLocker has no reviewer, and one approved by an admin has no
-- issuer metadata. Without this, a future bug could record a DigiLocker approval carrying
-- someone''s name as the reviewer, which is exactly the provenance this column exists to
-- keep straight.
alter table driver_documents
  drop constraint if exists driver_documents_source_matches_reviewer;
alter table driver_documents
  add constraint driver_documents_source_matches_reviewer
  check (
    verified_via is distinct from 'digilocker' or reviewed_by is null
  );

-- ---------------------------------------------------------------------------
-- Sessions
-- ---------------------------------------------------------------------------
-- The provider hands back a session id and later accepts it as the key to someone's
-- identity documents. Which user a session belongs to is therefore decided here, when it
-- is created, and never read from the client — otherwise anyone who learned a session id
-- could attach a stranger's licence to their own profile.
create table if not exists digilocker_sessions (
  session_id text primary key,
  user_id    uuid not null references profiles(id) on delete cascade,

  -- Mirrors the provider's vocabulary: created | succeeded | failed | expired.
  status     text not null default 'created',

  created_at  timestamptz not null default now(),
  finished_at timestamptz,
  -- Why it ended, when it did not succeed. For the user, through errors.ts.
  failure     text
);

create index if not exists digilocker_sessions_user_idx
  on digilocker_sessions (user_id, created_at desc);

alter table digilocker_sessions enable row level security;

-- A user may watch their own session resolve. Nobody writes from the client: both the
-- insert and the status update happen in the edge functions, under the service key.
drop policy if exists digilocker_sessions_own on digilocker_sessions;
create policy digilocker_sessions_own on digilocker_sessions
  for select to authenticated
  using (user_id = auth.uid());

grant select on digilocker_sessions to authenticated;

-- ---------------------------------------------------------------------------
-- Recording a verified licence
-- ---------------------------------------------------------------------------
-- Called by the edge function after it has downloaded the issuer's file into the private
-- `documents` bucket. Definer, because it writes `approved` — which no user may do — and
-- it takes the user explicitly rather than from auth.uid(), since the caller is the
-- service key rather than the driver.
create or replace function record_digilocker_licence(
  driver        uuid,
  session       text,
  storage_path  text,
  meta          jsonb
)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if driver is null or session is null then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  -- The session must already belong to this driver. This is the check that makes a
  -- stolen session id useless.
  if not exists (
    select 1 from digilocker_sessions s
     where s.session_id = session and s.user_id = driver
  ) then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  if storage_path not like (driver::text || '/%') then
    raise exception 'document does not belong to this user' using errcode = '22023';
  end if;

  insert into driver_documents as d (user_id, kind, storage_path, status, verified_via,
                                     issuer_meta, submitted_at)
  values (driver, 'licence', storage_path, 'approved', 'digilocker', meta, now())
  on conflict on constraint driver_documents_pkey do update
     set storage_path  = excluded.storage_path,
         status        = 'approved',
         verified_via  = 'digilocker',
         issuer_meta   = excluded.issuer_meta,
         reject_reason = null,
         -- Cleared deliberately: an issuer-verified licence supersedes whatever an admin
         -- decided about the photograph it replaces.
         reviewed_by   = null,
         reviewed_at   = null,
         submitted_at  = now();

  update digilocker_sessions
     set status = 'succeeded', finished_at = now()
   where session_id = session;
end $$;

revoke execute on function record_digilocker_licence(uuid, text, text, jsonb) from public, authenticated;

comment on function record_digilocker_licence is
  'Edge-function entry point. Not grantable to authenticated: it writes `approved`.';
