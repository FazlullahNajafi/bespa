-- Identity, privacy, and the helper functions every later policy is built on
-- (spec 06.3, 06.10).
--
-- DEVIATION FROM SPEC 06.10 — phone number storage.
-- The spec asks for `revoke select on profiles from authenticated` together with a
-- `directory_members` view declared `security_invoker = true`. Those two cannot coexist:
-- an invoker-rights view executes with the caller's privileges, so revoking the caller's
-- SELECT on the base table breaks the view as well. The alternatives are a definer-rights
-- view (which would bypass profiles' RLS entirely and expose every village — strictly
-- worse) or column-level grants (which Postgres does support, contrary to the note in the
-- spec, but which make `select *` fail hard and are awkward through PostgREST).
--
-- Resolved by moving the sensitive columns to their own table: `profile_private` holds
-- phone and verification state, readable only by the owner. `profiles` keeps
-- authenticated SELECT plus the RLS from the spec, and `directory_members` works exactly
-- as written. `rpc.get_member_contact` (Phase 1) is the only other reader, as a security
-- definer function. Same guarantee, no contradiction.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- updated_at helper, used by every table that carries the column
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  full_name          text not null default '',
  avatar_path        text,
  occupation         text,
  bio                text,
  village_id         uuid references geo_units(id),   -- tenancy key (village|town node)
  panchayat_id       uuid references geo_units(id),
  roles              user_role[] not null default '{member}',
  village_changed_at timestamptz,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index profiles_village_idx on profiles (village_id);
create index profiles_roles_idx   on profiles using gin (roles);

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- Sensitive columns, owner-readable only. See the deviation note above.
create table profile_private (
  user_id        uuid primary key references profiles(id) on delete cascade,
  phone          text,
  phone_verified boolean not null default false,
  updated_at     timestamptz not null default now(),
  constraint profile_private_phone_e164 check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$')
);

create trigger profile_private_set_updated_at
  before update on profile_private
  for each row execute function set_updated_at();

create table privacy_settings (
  user_id         uuid primary key references profiles(id) on delete cascade,
  show_phone      visibility not null default 'villagers',
  show_avatar     visibility not null default 'villagers',
  show_occupation visibility not null default 'villagers',
  in_directory    boolean    not null default true
);

-- Append-only audit of every phone-number reveal (spec 03.4).
create table contact_access_log (
  id          bigserial primary key,
  viewer_id   uuid not null references profiles(id) on delete cascade,
  subject_id  uuid not null references profiles(id) on delete cascade,
  accessed_at timestamptz not null default now()
);

create index contact_access_log_viewer_idx on contact_access_log (viewer_id, accessed_at desc);

-- ---------------------------------------------------------------------------
-- Helper functions (spec 06.3)
-- ---------------------------------------------------------------------------
-- All are `security definer` so they can read `profiles` without tripping the very
-- policies they are used inside — that is what keeps the policy set non-recursive.

create or replace function my_village() returns uuid
  language sql stable security definer set search_path = public as
$$ select village_id from profiles where id = auth.uid() $$;

create or replace function has_role(r user_role) returns boolean
  language sql stable security definer set search_path = public as
$$ select coalesce(r = any(roles), false) from profiles where id = auth.uid() $$;

create or replace function is_phone_verified() returns boolean
  language sql stable security definer set search_path = public as
$$ select coalesce(phone_verified, false) from profile_private where user_id = auth.uid() $$;

-- True when the current user administers `unit` or any of its ancestors.
create or replace function admins_geo(unit uuid) returns boolean
  language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1
      from profiles p
      join geo_units target on target.id = unit
      join geo_units scope  on scope.id = coalesce(p.panchayat_id, p.village_id)
     where p.id = auth.uid()
       and (p.roles && '{panchayat_admin,district_admin,super_admin}'::user_role[])
       and target.path operator(extensions.<@) scope.path
  -- Cast is load-bearing: pgTAP defines has_role(name) -> text, which an untyped
  -- literal resolves to in preference to our has_role(user_role) -> boolean.
  ) or has_role('super_admin'::user_role);
$$;

-- True when `uid` is an active member of the caller's own village.
-- Security definer for the same reason as the helpers above: the privacy_settings policy
-- that calls it must not re-enter profiles' RLS, whose own policy reads privacy_settings.
create or replace function shares_my_village(uid uuid) returns boolean
  language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from profiles p
      where p.id = uid and p.is_active and p.village_id = my_village()
   ) $$;

-- ---------------------------------------------------------------------------
-- New user bootstrap
-- ---------------------------------------------------------------------------
-- A row in auth.users always implies exactly one profile, one privacy row, and one
-- private row. Doing this in a trigger rather than the client means there is no window
-- in which a signed-in user has no profile.

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;

  insert into privacy_settings (user_id) values (new.id) on conflict do nothing;

  insert into profile_private (user_id, phone, phone_verified)
  values (new.id, new.phone, new.phone is not null)
  on conflict do nothing;

  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table profiles           enable row level security;
alter table profile_private    enable row level security;
alter table privacy_settings   enable row level security;
alter table contact_access_log enable row level security;

-- Profiles: yourself always; co-villagers if they have not opted out of the directory.
create policy profile_self on profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profile_covillagers on profiles
  for select to authenticated
  using (
    village_id = my_village()
    and village_id is not null
    and is_active
    and exists (
      select 1 from privacy_settings s
       where s.user_id = profiles.id and s.in_directory
    )
  );

create policy profile_update_self on profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Private columns: owner only, in both directions. No co-villager policy exists here by
-- design — the number is reached only through get_member_contact.
create policy profile_private_self on profile_private
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy profile_private_update_self on profile_private
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Privacy settings: owner reads and writes. Other users never read them directly; the
-- directory view and the contact RPC apply them on the reader's behalf.
create policy privacy_self on privacy_settings
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Spec 06 defines profile_covillagers and directory_members to read *other* members'
-- privacy_settings, but never states a policy for this table. Owner-only reads would make
-- both unreachable, so opting into the directory also publishes the flags the directory
-- renders from. Rows with in_directory = false stay private to their owner.
create policy privacy_directory_read on privacy_settings
  for select to authenticated
  using (in_directory and shares_my_village(user_id));

create policy privacy_update_self on privacy_settings
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Access log: a user may audit who looked them up; nobody may write it directly
-- (get_member_contact inserts as definer).
create policy contact_log_subject_reads on contact_access_log
  for select to authenticated
  using (subject_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Directory view (spec 06.10)
-- ---------------------------------------------------------------------------
-- security_invoker = true so the caller's RLS on `profiles` still decides which rows are
-- visible; the view only strips columns the owner has hidden. `phone_available` tells the
-- client whether to render a call button without revealing the number itself.

create view directory_members with (security_invoker = true) as
  select p.id,
         p.full_name,
         p.village_id,
         p.panchayat_id,
         p.roles,
         p.created_at,
         case when s.show_avatar     = 'villagers' then p.avatar_path end as avatar_path,
         case when s.show_occupation = 'villagers' then p.occupation  end as occupation,
         (s.show_phone in ('villagers', 'officials'))                     as phone_available
    from profiles p
    join privacy_settings s on s.user_id = p.id
   where p.is_active and s.in_directory;

grant select on directory_members to authenticated;

comment on view directory_members is
  'Client-facing directory projection. Never exposes a phone number — see rpc.get_member_contact.';

-- ---------------------------------------------------------------------------
-- Table privileges
-- ---------------------------------------------------------------------------
-- RLS filters rows you can already reach; it does not grant reach. Without these
-- grants every policy above is unreachable and the table reads as "permission denied".
-- Granted per policy: read where a `select` policy exists, write where an `update` one does.
-- No inserts: rows are created by security-definer functions, not by the client.

grant select, update on profiles           to authenticated;
grant select, update on profile_private    to authenticated;
grant select, update on privacy_settings   to authenticated;
grant select          on contact_access_log to authenticated;
