-- The village directory's two missing halves (spec 03.4).
--
-- `directory_members` and `contact_access_log` have existed since the identity migration;
-- what was never built is the only way a phone number is allowed to leave the server, and
-- the panchayat cards pinned above the list.
--
-- Spec 03.4 is unusually specific about the phone number, and the reasons are worth
-- restating because every line below follows from them: a number is **never** in a list
-- response, it is fetched one at a time, every fetch is logged where the *subject* can
-- read it, and the whole thing is rate limited so that scraping a village's phone book is
-- impractical rather than merely discouraged.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- village_contacts — the sarpanch card and the panchayat numbers
-- ---------------------------------------------------------------------------
-- These are not profiles. They are offices, published by the panchayat, and public within
-- the village by definition of the office — which is why they carry a plain phone column
-- while a villager's number is locked behind an RPC and an audit log. Someone holding an
-- office has a number people are *entitled* to have.

create table village_contacts (
  id          uuid primary key default gen_random_uuid(),
  geo_unit_id uuid not null references geo_units(id) on delete cascade,
  -- Denormalised by trigger, same as `notices`: the visibility rule is an ltree
  -- containment test and joining through geo_units on every policy check is the
  -- difference between an index scan and a sequential one.
  geo_path    extensions.ltree not null,

  name        text not null,
  designation text not null,
  phone       text,

  -- Ordering is the panchayat's choice: the sarpanch first, then whoever they say.
  sort_order  int not null default 0,

  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint village_contacts_name_present check (length(btrim(name)) > 0),
  constraint village_contacts_designation_present check (length(btrim(designation)) > 0),
  constraint village_contacts_phone_e164
    check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$')
);

create or replace function village_contacts_set_path() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  select path into new.geo_path from geo_units where id = new.geo_unit_id;
  if new.geo_path is null then
    raise exception 'no_such_geo_unit' using errcode = '22023';
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger village_contacts_path
  before insert or update of geo_unit_id on village_contacts
  for each row execute function village_contacts_set_path();

create index village_contacts_geo_idx on village_contacts using gist (geo_path);

alter table village_contacts enable row level security;

-- Visible to anyone the contact covers: a village's own contacts, and anything published
-- at block or district level above them. Same containment rule as notices.
create policy village_contacts_readable on village_contacts
  for select to authenticated
  using (my_village_path() operator(extensions.<@) geo_path);

create policy village_contacts_admin_writes on village_contacts
  for all to authenticated
  using (admins_geo(geo_unit_id))
  with check (admins_geo(geo_unit_id));

grant select on village_contacts to authenticated;
-- No insert/update/delete grant: rows are created by the definer function below, so
-- `created_by` cannot be claimed by the caller. Same rule as every other table here.

-- ---------------------------------------------------------------------------
-- get_member_contact — the only way a villager's number leaves the server
-- ---------------------------------------------------------------------------

-- Spec 03.4: "Rate-limited to 30 lookups/user/day to make bulk harvesting impractical."
-- A rolling 24 hours rather than a calendar day, because a calendar limit resets at
-- midnight and hands a scraper 60 lookups in two minutes either side of it.
create or replace function get_member_contact(member_id uuid)
returns table (phone text, phone_verified boolean)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  me       uuid := auth.uid();
  lookups  int;
  allowed  boolean;
begin
  if me is null then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  -- Your own number is not a lookup. It is already on your profile screen, and counting
  -- it would let someone exhaust their own quota by opening their own page.
  if member_id = me then
    return query select pp.phone, pp.phone_verified
                   from profile_private pp where pp.user_id = me;
    return;
  end if;

  select count(*)::int into lookups
    from contact_access_log
   where viewer_id = me
     and accessed_at > now() - interval '24 hours';

  if lookups >= 30 then
    -- PostgREST reads the 3 digits after 'PT' as the HTTP status; errors.ts maps 429 to
    -- 'rate_limited'.
    raise exception 'rate_limited'
      using errcode = 'PT429',
            hint = 'Up to 30 contact lookups a day.';
  end if;

  -- The permission check, re-evaluated here rather than trusted from the list that got
  -- the user this far: a setting may have changed since the screen was rendered, and the
  -- list is a cache on someone's phone.
  select
    s.in_directory
    and p.is_active
    and p.village_id = my_village()
    and (
      s.show_phone = 'villagers'
      or (s.show_phone = 'officials'
          and (select pr.roles && '{panchayat_admin,district_admin,super_admin}'::user_role[]
                 from profiles pr where pr.id = me))
    )
    into allowed
    from profiles p
    join privacy_settings s on s.user_id = p.id
   where p.id = member_id;

  if not coalesce(allowed, false) then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  -- Logged BEFORE the number is returned, so a reveal cannot be had without the audit
  -- row — spec 03.4's promise is to the subject, who can read this log.
  insert into contact_access_log (viewer_id, subject_id) values (me, member_id);

  return query select pp.phone, pp.phone_verified
                 from profile_private pp where pp.user_id = member_id;
end;
$$;

comment on function get_member_contact is
  'The only path to another villager''s phone number (spec 03.4): re-checks their privacy '
  'setting, writes the access log row the subject can read, and refuses past 30 lookups '
  'in 24 hours.';

revoke execute on function get_member_contact(uuid) from public;
grant execute on function get_member_contact(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- publish_village_contact — an office card, written as the caller
-- ---------------------------------------------------------------------------

create or replace function publish_village_contact(
  geo_unit    uuid,
  name        text,
  designation text,
  phone       text default null,
  sort_order  int default 0
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  me     uuid := auth.uid();
  new_id uuid;
begin
  if me is null or not admins_geo(geo_unit) then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  insert into village_contacts (geo_unit_id, name, designation, phone, sort_order, created_by)
  values (geo_unit, btrim(name), btrim(designation),
          nullif(btrim(coalesce(phone, '')), ''),
          publish_village_contact.sort_order, me)
  returning id into new_id;

  return new_id;
end;
$$;

comment on function publish_village_contact is
  'Publishes a panchayat contact card for a geo unit the caller administers.';

revoke execute on function publish_village_contact(uuid, text, text, text, int) from public;
grant execute on function publish_village_contact(uuid, text, text, text, int) to authenticated;
