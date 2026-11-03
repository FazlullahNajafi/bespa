-- Pin an admin to the village they administer (spec 02.1, 03.5).
--
-- `admins_geo` read the caller's scope from their own profile —
-- `coalesce(panchayat_id, village_id)` — so the role was a flag and the village was
-- whatever the holder's profile happened to say at that moment. Change village, and the
-- rights moved: someone made admin of their hamlet in March would hold the megaphone in
-- whatever village they joined in April, a place they had just arrived in.
--
-- It is slow to exploit (a village change is once per 30 days and audited) and harmless
-- while there is one admin who is also the project owner. It stops being harmless the
-- week the role is handed to forty sarpanches, and that is expected after the panchayat
-- elections — so it is fixed now, while the backfill is three rows instead of forty.
--
-- The grant now names the unit. That also removes a footgun from the granting
-- instructions: you type the village rather than trusting the person's profile to be
-- pointing at the right one when you run the statement.
--
-- `super_admin` is deliberately NOT pinned and stays in `profiles.roles`. It is not a
-- village role — it is "whoever runs this" — and giving it a geo unit would be pretending
-- it has a scope it does not have.

set search_path = public, extensions;

create table admin_grants (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  -- The village, block or district this person administers. Containment does the rest:
  -- a grant on a district covers every village beneath it.
  geo_unit_id uuid not null references geo_units(id) on delete cascade,
  role        user_role not null,

  granted_by  uuid references profiles(id),
  granted_at  timestamptz not null default now(),
  -- Free text for whoever grants it: "elected 2026, verified by phone 03-11". The role is
  -- handed out on a human check, so the record of that check belongs with the grant.
  note        text,

  constraint admin_grants_role_is_scoped
    check (role in ('panchayat_admin', 'district_admin')),
  unique (user_id, geo_unit_id, role)
);

create index admin_grants_user_idx on admin_grants (user_id);

alter table admin_grants enable row level security;

-- A person may see what they have been granted, and nothing else. Writes happen through
-- SQL run by whoever holds the keys; there is deliberately no screen, for the reason
-- `docs/making-someone-an-admin.md` gives.
create policy admin_grants_self on admin_grants
  for select to authenticated
  using (user_id = (select auth.uid()));

grant select on admin_grants to authenticated;

-- ---------------------------------------------------------------------------
-- Backfill: today's behaviour, frozen
-- ---------------------------------------------------------------------------
-- Every existing village admin keeps exactly the scope they have right now — their
-- current village — so nobody gains or loses anything at the moment this runs. What
-- changes is that the scope stops following them.
insert into admin_grants (user_id, geo_unit_id, role, note)
select p.id,
       coalesce(p.panchayat_id, p.village_id),
       r.role,
       'backfilled from profiles.roles, 2026-11-03'
  from profiles p
  cross join lateral unnest(p.roles) as r(role)
 where r.role in ('panchayat_admin', 'district_admin')
   and coalesce(p.panchayat_id, p.village_id) is not null
on conflict (user_id, geo_unit_id, role) do nothing;

-- ---------------------------------------------------------------------------
-- The check itself
-- ---------------------------------------------------------------------------
-- Every server-side authorisation in this app goes through this one function — the
-- notices update policy, `publish_notice`, the village_contacts policy and all three
-- contact-card functions — so replacing it fixes all of them at once.

create or replace function admins_geo(unit uuid) returns boolean
  language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1
      from admin_grants g
      join geo_units scope  on scope.id  = g.geo_unit_id
      join geo_units target on target.id = unit
     where g.user_id = (select auth.uid())
       -- True for the granted unit and anything beneath it, so a district admin reaches
       -- every village in the district while a village admin naming the district is
       -- refused: the district is an ancestor of their scope, not a descendant.
       and target.path operator(extensions.<@) scope.path
  ) or has_role('super_admin'::user_role);
$$;

comment on function admins_geo is
  'True when the caller holds an admin grant covering this geo unit. The scope comes from '
  'the grant, never from the caller''s current village — a grant does not follow someone '
  'who moves.';

-- ---------------------------------------------------------------------------
-- What the app asks
-- ---------------------------------------------------------------------------

create or replace function my_admin_units()
returns table (id uuid, type geo_type, name_en text, role user_role)
  language sql stable security definer set search_path = public, extensions as $$
  select g.geo_unit_id, u.type, u.name_en, g.role
    from admin_grants g
    join geo_units u on u.id = g.geo_unit_id
   where g.user_id = (select auth.uid())
   order by u.name_en;
$$;

comment on function my_admin_units is
  'The geo units the caller administers, for deciding which admin affordances to draw. '
  'Empty for a super_admin, who holds no scoped grant — the client ORs that in.';

revoke execute on function my_admin_units() from public;
grant execute on function my_admin_units() to authenticated;

-- ---------------------------------------------------------------------------
-- "Officials only" means officials of YOUR village
-- ---------------------------------------------------------------------------
-- The same flaw, one layer along. A number set to `officials` admitted anyone whose
-- profile carried an admin role, checked as a flag with no scope — so an admin of one
-- village, living in another, counted as an official of the village they had moved to.
-- Now it asks whether they administer the village the number belongs to.

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
    raise exception 'rate_limited'
      using errcode = 'PT429',
            hint = 'Up to 30 contact lookups a day.';
  end if;

  select
    s.in_directory
    and p.is_active
    and p.village_id = my_village()
    and (
      s.show_phone = 'villagers'
      -- An official OF THIS VILLAGE, not an office holder somewhere else.
      or (s.show_phone = 'officials' and admins_geo(p.village_id))
    )
    into allowed
    from profiles p
    join privacy_settings s on s.user_id = p.id
   where p.id = member_id;

  if not coalesce(allowed, false) then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  insert into contact_access_log (viewer_id, subject_id) values (me, member_id);

  return query select pp.phone, pp.phone_verified
                 from profile_private pp where pp.user_id = member_id;
end;
$$;
