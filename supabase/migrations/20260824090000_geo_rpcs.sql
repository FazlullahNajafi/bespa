-- Geo RPCs for onboarding (spec 07.2 "Geo & onboarding").
--
-- `geo_children` could be a plain PostgREST select — RLS already lets any authenticated
-- user read `geo_units`. It exists as an RPC anyway because the picker needs a *stable
-- contract*: the client asks for "the children of this node", not "rows where parent_id
-- equals". If the hierarchy is ever restructured (spec 09.3 risk #8 — boundaries and
-- panchayat names do change), the shape of that answer changes here, once, rather than in
-- every caller.

set search_path = public, extensions;

create or replace function geo_children(parent uuid default null)
returns table (
  id       uuid,
  type     geo_type,
  name_en  text,
  name_ur  text,
  name_bft text,
  slug     text,
  has_children boolean
)
language sql
stable
security invoker           -- deliberately invoker: geo_units RLS is the access rule
set search_path = public, extensions
as $$
  select g.id, g.type, g.name_en, g.name_ur, g.name_bft, g.slug,
         exists (select 1 from geo_units c where c.parent_id = g.id) as has_children
    from geo_units g
   where g.parent_id is not distinct from parent
   order by g.name_en;
$$;

comment on function geo_children is
  'Children of a geo unit for the cascading onboarding picker. Pass null for the root (UT).';

-- ---------------------------------------------------------------------------
-- set_my_village
-- ---------------------------------------------------------------------------
-- Changing village moves what you can see — it is the attack surface for scraping a
-- neighbouring village's directory (spec 02.2). Hence: rate-limited to once per 30 days,
-- audited, and constrained so the pair actually makes sense in the hierarchy.

create table village_change_log (
  id           bigserial primary key,
  user_id      uuid not null references profiles(id) on delete cascade,
  from_village uuid references geo_units(id),
  to_village   uuid references geo_units(id),
  changed_at   timestamptz not null default now()
);

create index village_change_log_user_idx on village_change_log (user_id, changed_at desc);

alter table village_change_log enable row level security;

-- A user may audit their own history. Writes happen only inside the definer function.
create policy village_change_log_self on village_change_log
  for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function set_my_village(village uuid, panchayat uuid default null)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  me            uuid := auth.uid();
  current_village uuid;
  last_changed  timestamptz;
  village_type  geo_type;
begin
  if me is null then
    -- 42501 insufficient_privilege -> PostgREST 403 -> errors.ts 'not_permitted'.
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  select p.village_id, p.village_changed_at
    into current_village, last_changed
    from profiles p where p.id = me;

  -- No-op rather than an error: re-submitting the onboarding form must be harmless.
  if current_village is not distinct from village then
    return;
  end if;

  -- The 30-day limit applies only to a *change*, never to first-time onboarding.
  if current_village is not null
     and last_changed is not null
     and last_changed > now() - interval '30 days' then
    -- PostgREST reads the 3 digits after 'PT' as the HTTP status; 429 is what
    -- errors.ts maps to 'rate_limited'.
    raise exception 'rate_limited'
      using errcode = 'PT429',
            hint = 'A village can be changed once every 30 days.';
  end if;

  select g.type into village_type from geo_units g where g.id = village;
  if village_type is null then
    raise exception 'no_such_geo_unit' using errcode = '22023';
  end if;
  if village_type not in ('village', 'town') then
    raise exception 'village_id must point at a village or town node'
      using errcode = '22023';
  end if;

  -- A panchayat must actually sit under the chosen village, or the tenancy key and the
  -- admin scope would disagree — `admins_geo` resolves through panchayat_id first.
  if panchayat is not null
     and not exists (
       select 1 from geo_units p
        where p.id = panchayat
          and p.parent_id = village
          and p.type in ('panchayat', 'municipality')
     ) then
    raise exception 'panchayat does not belong to that village'
      using errcode = '22023';
  end if;

  update profiles
     set village_id = village,
         panchayat_id = panchayat,
         village_changed_at = now()
   where id = me;

  insert into village_change_log (user_id, from_village, to_village)
  values (me, current_village, village);
end $$;

revoke execute on function set_my_village(uuid, uuid) from public;
grant execute on function set_my_village(uuid, uuid) to authenticated;

comment on function set_my_village is
  'Sets the caller''s village (and optional panchayat). Once per 30 days after the first, audited.';

-- ---------------------------------------------------------------------------
-- Table privileges
-- ---------------------------------------------------------------------------
-- RLS filters rows you can already reach; it does not grant reach. Without these
-- grants every policy above is unreachable and the table reads as "permission denied".
-- Granted per policy: read where a `select` policy exists, write where an `update` one does.
-- No inserts: rows are created by security-definer functions, not by the client.

grant select on village_change_log to authenticated;
