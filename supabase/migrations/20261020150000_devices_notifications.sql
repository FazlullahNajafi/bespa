-- Push notifications: device registry and the in-app inbox (spec 06.9, 07.3).
--
-- Built before the first feature that sends anything, because the feature that needs it
-- is notices (spec 03.5) and a notice nobody is told about is a notice nobody reads.
-- Registering a token also has to survive the app being reinstalled, reassigned to a
-- different person, or signed out — which is most of the logic here.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table devices (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  -- Expo's push token. Unique across the table and NOT per user: phones are shared here,
  -- and when a handset changes hands the token must move with the handset rather than
  -- deliver one person's notices to another. `register_my_device` reassigns on conflict.
  expo_token   text not null unique,
  platform     text,
  locale       text,
  last_seen_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create index devices_user_idx on devices (user_id);

create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  kind       text not null,          -- notice.published, booking.confirmed, issue.status …
  title      text not null,
  body       text,
  data       jsonb,                  -- deep-link payload
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

-- Partial index, as spec 06.9 writes it: the query that matters is "what is unread",
-- and the badge asks it on every cold start.
create index notifications_unread_idx
  on notifications (user_id, created_at desc) where read_at is null;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table devices       enable row level security;
alter table notifications enable row level security;

-- A user may see and remove their own devices. Listing them is how "you are signed in on
-- two phones" can ever be shown; nobody else may read a token, since a token is a
-- capability to push to that handset.
create policy devices_self on devices
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy devices_delete_self on devices
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy notifications_self on notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Marking as read is the only field a user writes. Enforced by the column grant below,
-- not by this policy — a policy constrains the row, not the column.
create policy notifications_update_self on notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- register_my_device
-- ---------------------------------------------------------------------------
-- An RPC rather than an insert, because the interesting case is the conflict. The same
-- Expo token can already exist against a different user: a shared phone that a second
-- villager signs into, or a reinstall that recycles the token. Blindly inserting throws;
-- ignoring the conflict silently keeps pushing the previous owner's notices to a handset
-- that is now someone else's, which is the privacy failure spec 02.4 exists to prevent.
--
-- So the token is reassigned to whoever is signed in now. The token identifies the
-- device; the row says who is currently holding it.

create or replace function register_my_device(
  token    text,
  platform text default null,
  locale   text default null
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
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  if token is null or length(trim(token)) = 0 then
    raise exception 'empty push token' using errcode = '22023';
  end if;

  insert into devices (user_id, expo_token, platform, locale)
  values (me, token, platform, locale)
  on conflict (expo_token) do update
    set user_id      = me,
        platform     = coalesce(excluded.platform, devices.platform),
        locale       = coalesce(excluded.locale, devices.locale),
        last_seen_at = now();
end $$;

revoke execute on function register_my_device(text, text, text) from public;
grant execute on function register_my_device(text, text, text) to authenticated;

comment on function register_my_device is
  'Registers or re-points an Expo push token at the caller. Shared handsets reassign.';

-- ---------------------------------------------------------------------------
-- forget_my_devices
-- ---------------------------------------------------------------------------
-- Signing out has to drop the token, or the next notice for this account lands on a
-- handset its owner has already walked away from. Called from the sign-out path.

create or replace function forget_my_devices(token text default null)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  -- With a token, drop just this handset; without one, every device for this user.
  delete from devices d
   where d.user_id = me
     and (forget_my_devices.token is null or d.expo_token = forget_my_devices.token);
end $$;

revoke execute on function forget_my_devices(text) from public;
grant execute on function forget_my_devices(text) to authenticated;

comment on function forget_my_devices is
  'Drops the caller''s push tokens — one handset, or all of them. Called on sign-out.';

-- ---------------------------------------------------------------------------
-- Table privileges
-- ---------------------------------------------------------------------------
-- Per policy, and per column where a user may write only part of a row. `devices` grants
-- no insert or update at all: registration goes through the definer function above, so a
-- client cannot point someone else's token at itself.

grant select, delete on devices to authenticated;
grant select on notifications to authenticated;

-- Only `read_at`. Without the column restriction a user could rewrite the title and body
-- of their own notifications, which is pointless but is also exactly the kind of hole
-- that migration 20261019120000 had to close on `profiles`.
grant update (read_at) on notifications to authenticated;
