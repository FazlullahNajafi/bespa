# 06 — Data model

Postgres 15 on Supabase. This document is the source of truth for
`supabase/migrations/`. Conventions: `snake_case`; every table has `id uuid default
gen_random_uuid()`, `created_at timestamptz default now()`, and `updated_at` maintained by
a trigger; soft-delete via `deleted_at` only where history matters.

> **Ordering note.** Sections below are grouped by domain for reading, not by dependency.
> Several tables forward-reference others (`village_profiles` → `profiles`, `gallery_items`
> → `calendar_events`, `drivers` → `stands`). In `supabase/migrations/` the real order is:
> extensions → enums → `geo_units` → `profiles`/`privacy_settings` → `media` → village
> content → calendar → transport → civic → views → RLS policies → cron jobs. Cyclic
> references (`trip_seats.booking_id`) are added with a trailing `alter table`.

```sql
create extension if not exists "pgcrypto";
create extension if not exists "ltree";
create extension if not exists "postgis";      -- geography(Point) for places, pickups
create extension if not exists "pg_cron";      -- hold sweeps, presence expiry
```

## 6.1 Enums

```sql
create type geo_type       as enum ('ut','district','block','village','town','panchayat','municipality');
create type user_role      as enum ('member','driver','panchayat_admin','dept_liaison','district_admin','super_admin');
create type visibility     as enum ('villagers','officials','nobody');
create type mod_status     as enum ('pending','approved','rejected');
create type place_category as enum ('school','hospital','mosque','imambargah','khanqah',
                                    'government_office','bank_atm','water_point','tourist',
                                    'market','sports','other');
create type notice_category as enum ('vacation','order','event','alert','general');
create type gallery_kind   as enum ('place','festival','general');

create type vehicle_type   as enum ('xylo','innova','tempo_traveller','bus_large',
                                    'omni','eeco','bus_small','other');
create type trip_class     as enum ('long','short');
create type trip_mode      as enum ('shared','charter');
create type trip_status    as enum ('open','filling','confirmed','departed','completed','cancelled');
create type seat_status    as enum ('free','held','booked','blocked');
create type seat_kind      as enum ('driver','window','middle','aisle','folding');
create type booking_status as enum ('requested','confirmed','cancelled_by_passenger',
                                    'cancelled_by_driver','no_show','completed');

create type event_category as enum ('religious_islamic','religious_buddhist',
                                    'cultural_local','national','civic_local');
create type issue_status   as enum ('submitted','acknowledged','forwarded','in_progress',
                                    'resolved','rejected','reopened');
```

## 6.2 Geography

```sql
create table geo_units (
  id           uuid primary key default gen_random_uuid(),
  parent_id    uuid references geo_units(id) on delete restrict,
  type         geo_type not null,
  name_en      text not null,
  name_ur      text,
  name_bft     text,                      -- Purgi / Balti
  slug         text not null,
  lgd_code     text,                      -- Local Government Directory reconciliation
  path         ltree not null,            -- maintained by trigger; e.g. ladakh.kargil.sankoo.minjee
  centroid     geography(Point,4326),
  created_at   timestamptz default now(),
  unique (parent_id, slug)
);
create index on geo_units using gist (path);
create index on geo_units (parent_id);
create index on geo_units using gist (centroid);
```

`path` is rebuilt by a `before insert or update of parent_id, slug` trigger; a second
statement-level trigger re-paths descendants when a node moves. Ancestor tests are then
`child.path <@ ancestor.path`.

```sql
-- Editable village-level content, one row per village/town node.
create table village_profiles (
  geo_unit_id   uuid primary key references geo_units(id) on delete cascade,
  description   text,
  cover_path    text,                    -- storage key
  static_map_path text,                  -- offline fallback image
  boundary      geography(Polygon,4326),
  sarpanch_id   uuid references profiles(id),
  updated_by    uuid references profiles(id),
  updated_at    timestamptz default now()
);

create table village_stats (
  id          uuid primary key default gen_random_uuid(),
  geo_unit_id uuid not null references geo_units(id) on delete cascade,
  metric_key  text not null,             -- population_total, households, literacy_rate …
  value       numeric not null,
  unit        text,
  year        int not null,
  source      text not null,             -- shown in the UI; rows without it are not rendered
  unique (geo_unit_id, metric_key, year)
);

-- Office-holder contacts published by the panchayat; public within the village.
create table village_contacts (
  id          uuid primary key default gen_random_uuid(),
  geo_unit_id uuid not null references geo_units(id) on delete cascade,
  name        text not null,
  designation text not null,
  phone       text not null,
  sort_order  int default 0
);
```

## 6.3 Identity

```sql
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text not null,
  avatar_path   text,
  occupation    text,
  bio           text,
  phone         text,
  phone_verified boolean default false,
  village_id    uuid references geo_units(id),      -- tenancy key (village|town node)
  panchayat_id  uuid references geo_units(id),
  roles         user_role[] not null default '{member}',
  village_changed_at timestamptz,
  is_active     boolean default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index on profiles (village_id);
create index on profiles using gin (roles);

create table privacy_settings (
  user_id        uuid primary key references profiles(id) on delete cascade,
  show_phone     visibility not null default 'villagers',
  show_avatar    visibility not null default 'villagers',
  show_occupation visibility not null default 'villagers',
  in_directory   boolean not null default true
);

-- Append-only audit of every phone-number reveal.
create table contact_access_log (
  id          bigserial primary key,
  viewer_id   uuid not null references profiles(id),
  subject_id  uuid not null references profiles(id),
  accessed_at timestamptz default now()
);
create index on contact_access_log (viewer_id, accessed_at desc);
```

Helper functions used throughout the policies:

```sql
create or replace function my_village() returns uuid
  language sql stable security definer set search_path = public as
$$ select village_id from profiles where id = auth.uid() $$;

create or replace function has_role(r user_role) returns boolean
  language sql stable security definer set search_path = public as
$$ select r = any(roles) from profiles where id = auth.uid() $$;

-- true when the current user administers `unit` or any of its ancestors
create or replace function admins_geo(unit uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    join geo_units target on target.id = unit
    join geo_units scope  on scope.id = coalesce(p.panchayat_id, p.village_id)
    where p.id = auth.uid()
      and (p.roles && '{panchayat_admin,district_admin,super_admin}'::user_role[])
      and target.path <@ scope.path
  ) or has_role('super_admin');
$$;
```

## 6.4 Village content

```sql
create table places (
  id           uuid primary key default gen_random_uuid(),
  geo_unit_id  uuid not null references geo_units(id) on delete cascade,
  category     place_category not null,
  name_en      text not null,
  name_bft     text,
  description  text,
  location     geography(Point,4326),
  address_text text,
  phone        text,
  timings      text,
  submitted_by uuid references profiles(id),
  status       mod_status not null default 'pending',
  moderated_by uuid references profiles(id),
  moderated_at timestamptz,
  reject_reason text,
  created_at   timestamptz default now()
);
create index on places (geo_unit_id, status, category);
create index on places using gist (location);

create table media (                       -- shared by places, gallery, issues, notices
  id           uuid primary key default gen_random_uuid(),
  bucket       text not null,
  path         text not null,
  width int, height int, bytes int,
  uploaded_by  uuid references profiles(id),
  created_at   timestamptz default now()
);

create table place_media (
  place_id uuid references places(id) on delete cascade,
  media_id uuid references media(id) on delete cascade,
  sort_order int default 0,
  primary key (place_id, media_id)
);

create table gallery_items (
  id           uuid primary key default gen_random_uuid(),
  geo_unit_id  uuid not null references geo_units(id) on delete cascade,
  media_id     uuid not null references media(id) on delete cascade,
  kind         gallery_kind not null default 'general',
  caption      text,
  place_id     uuid references places(id) on delete set null,
  event_id     uuid references calendar_events(id) on delete set null,
  uploaded_by  uuid references profiles(id),
  status       mod_status not null default 'pending',
  is_banner    boolean default false,
  banner_order int,
  created_at   timestamptz default now()
);
create index on gallery_items (geo_unit_id, status, kind);
create unique index gallery_banner_slot
  on gallery_items (geo_unit_id, banner_order) where is_banner;
-- at most five banner images per village
create or replace function check_banner_limit() returns trigger language plpgsql as $$
begin
  if new.is_banner and (select count(*) from gallery_items
       where geo_unit_id = new.geo_unit_id and is_banner and id <> new.id) >= 5 then
    raise exception 'banner limit of 5 reached for this village';
  end if; return new;
end $$;

create table notices (
  id           uuid primary key default gen_random_uuid(),
  geo_unit_id  uuid not null references geo_units(id) on delete cascade,
  category     notice_category not null default 'general',
  title        text not null,
  body         text not null,
  attachment_id uuid references media(id),
  is_pinned    boolean default false,
  published_by uuid not null references profiles(id),
  published_at timestamptz default now(),
  expires_at   timestamptz,
  created_at   timestamptz default now()
);
create index on notices (geo_unit_id, published_at desc);
```

## 6.5 Transport

```sql
create table seat_layouts (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,             -- 'Innova 7-seat'
  vehicle_type vehicle_type not null,
  seat_count   int not null,
  layout       jsonb not null             -- { rows: [ { seats: [{no,x,w,kind}] } ] }
);

create table drivers (
  profile_id     uuid primary key references profiles(id) on delete cascade,
  license_no     text,
  license_media_id uuid references media(id),
  verified       boolean default false,
  verified_by    uuid references profiles(id),
  verified_at    timestamptz,
  home_stand_id  uuid references stands(id),
  upi_id         text,
  payment_qr_id  uuid references media(id),
  rating_avg     numeric(3,2) default 0,
  rating_count   int default 0,
  trips_completed int default 0,
  suspended_at   timestamptz
);

create table vehicles (
  id           uuid primary key default gen_random_uuid(),
  driver_id    uuid not null references drivers(profile_id) on delete cascade,
  type         vehicle_type not null,
  reg_number   text not null,
  model        text,
  photo_id     uuid references media(id),
  layout_id    uuid not null references seat_layouts(id),
  is_active    boolean default true,
  unique (reg_number)
);

create table stands (
  id          uuid primary key default gen_random_uuid(),
  geo_unit_id uuid not null references geo_units(id),
  name        text not null,
  location    geography(Point,4326),
  serves      trip_class not null
);

create table routes (
  id             uuid primary key default gen_random_uuid(),
  class          trip_class not null,
  origin_id      uuid not null references geo_units(id),
  destination_id uuid not null references geo_units(id),
  name           text not null,             -- 'Kargil → Baroo'
  distance_km    numeric,
  duration_min   int,
  fare_hint      jsonb,                     -- { "eeco": 20, "bus_small": 10 }
  is_active      boolean default true,
  unique (origin_id, destination_id, class)
);
```

### Long distance: trips, seats, bookings

```sql
create table trips (
  id              uuid primary key default gen_random_uuid(),
  driver_id       uuid not null references drivers(profile_id),
  vehicle_id      uuid not null references vehicles(id),
  route_id        uuid not null references routes(id),
  mode            trip_mode not null default 'shared',
  departure_at    timestamptz not null,
  departure_window text,                    -- 'Early morning (~5 AM)'
  seat_price      numeric(10,2) not null,
  total_seats     int not null,
  seats_available int not null,
  pickup_notes    text,
  status          trip_status not null default 'open',
  cancel_reason   text,
  created_at      timestamptz default now(),
  check (seats_available between 0 and total_seats)
);
create index on trips (route_id, departure_at) where status in ('open','filling');
create index on trips (driver_id, departure_at desc);

-- One row per physical seat. The composite PK is what makes double-booking impossible.
create table trip_seats (
  trip_id     uuid not null references trips(id) on delete cascade,
  seat_no     text not null,
  kind        seat_kind not null default 'middle',
  status      seat_status not null default 'free',
  booking_id  uuid,                          -- FK added after bookings
  held_by     uuid references profiles(id),
  hold_expires_at timestamptz,
  primary key (trip_id, seat_no)
);
create index on trip_seats (trip_id, status);
create index on trip_seats (hold_expires_at) where status = 'held';

create table bookings (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid not null references trips(id) on delete cascade,
  passenger_id   uuid not null references profiles(id),
  code           text not null unique,        -- 6-char human-readable
  seats          text[] not null,
  passenger_count int not null default 1,
  fare_total     numeric(10,2) not null,
  contact_phone  text not null,
  pickup_point   geography(Point,4326),
  pickup_note    text,
  status         booking_status not null default 'requested',
  payment_marked boolean default false,       -- passenger self-report only; no money moves
  cancelled_at   timestamptz,
  cancel_reason  text,
  created_at     timestamptz default now()
);
create index on bookings (passenger_id, created_at desc);
create index on bookings (trip_id);
alter table trip_seats add constraint trip_seats_booking_fk
  foreign key (booking_id) references bookings(id) on delete set null;

create table ratings (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null unique references bookings(id) on delete cascade,
  driver_id   uuid not null references drivers(profile_id),
  rater_id    uuid not null references profiles(id),
  stars       int not null check (stars between 1 and 5),
  tags        text[],
  comment     text,
  created_at  timestamptz default now()
);
```

### Short distance: live presence

```sql
create table driver_presence (
  id           uuid primary key default gen_random_uuid(),
  driver_id    uuid not null references drivers(profile_id) on delete cascade,
  vehicle_id   uuid not null references vehicles(id),
  route_id     uuid not null references routes(id),
  stand_id     uuid references stands(id),
  location     geography(Point,4326),        -- coarse, opt-in
  seats_free   int not null check (seats_free >= 0),
  fare         numeric(10,2),
  went_live_at timestamptz default now(),
  expires_at   timestamptz not null default now() + interval '45 minutes',
  ended_at     timestamptz,
  end_reason   text                          -- 'departed' | 'full' | 'expired'
);
create index on driver_presence (route_id, expires_at) where ended_at is null;
create unique index one_live_per_driver
  on driver_presence (driver_id) where ended_at is null;

-- Soft, expiring interest signal. Deliberately not a booking.
create table seat_claims (
  id          uuid primary key default gen_random_uuid(),
  presence_id uuid not null references driver_presence(id) on delete cascade,
  passenger_id uuid not null references profiles(id),
  pickup_note text,
  expires_at  timestamptz not null default now() + interval '10 minutes',
  cancelled_at timestamptz,
  unique (presence_id, passenger_id)
);
```

## 6.6 Calendar

```sql
create table calendar_events (
  id             uuid primary key default gen_random_uuid(),
  category       event_category not null,
  name_en        text not null,
  name_ur        text,
  name_bft       text,
  description    text,
  scope_geo_id   uuid references geo_units(id),   -- null = all of Ladakh
  -- exactly one dating scheme is populated
  gregorian_date date,
  hijri_month    int check (hijri_month between 1 and 12),
  hijri_day      int check (hijri_day between 1 and 30),
  duration_days  int default 1,
  is_recurring   boolean default true,
  is_moon_dependent boolean default false,
  is_holiday     boolean default false,
  cover_media_id uuid references media(id),
  status         mod_status default 'approved',
  created_at     timestamptz default now(),
  check (gregorian_date is not null or (hijri_month is not null and hijri_day is not null))
);

-- Locally confirmed correction to the tabular Hijri calculation.
create table hijri_offsets (
  id            uuid primary key default gen_random_uuid(),
  geo_unit_id   uuid not null references geo_units(id),   -- district level
  offset_days   int not null check (offset_days between -2 and 2),
  effective_from date not null,
  note          text,
  set_by        uuid not null references profiles(id),
  created_at    timestamptz default now(),
  unique (geo_unit_id, effective_from)
);
```

## 6.7 Helplines

```sql
create table helpline_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null, sort_order int default 0, is_emergency boolean default false
);

create table helplines (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid not null references helpline_categories(id),
  label         text not null,
  department    text,
  numbers       text[] not null,
  geo_scope_id  uuid references geo_units(id),   -- null = national
  source_url    text,
  last_verified_at date,
  sort_order    int default 0,
  is_active     boolean default true
);
create index on helplines (geo_scope_id, category_id);
```

## 6.8 Issues

```sql
create table departments (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  short_name    text,
  geo_scope_id  uuid not null references geo_units(id),
  contact_name  text,
  whatsapp      text,
  sms           text,
  email         text,
  escalates_to  uuid references departments(id),
  is_active     boolean default true
);

create table issue_categories (
  id            uuid primary key default gen_random_uuid(),
  name_en       text not null,
  name_ur       text,
  icon          text not null,
  department_id uuid references departments(id),
  sort_order    int default 0
);

create table issues (
  id             uuid primary key default gen_random_uuid(),
  ref_no         text not null unique,            -- KRG-2026-000142
  reporter_id    uuid not null references profiles(id),
  category_id    uuid not null references issue_categories(id),
  geo_unit_id    uuid not null references geo_units(id),
  title          text not null,
  description    text not null,
  voice_media_id uuid references media(id),
  location       geography(Point,4326),
  address_text   text,
  is_public      boolean default true,
  status         issue_status not null default 'submitted',
  department_id  uuid references departments(id),
  forwarded_at   timestamptz,
  forwarded_via  text,                            -- 'whatsapp' | 'sms' | 'email'
  resolved_at    timestamptz,
  resolution_note text,
  reporter_confirmed boolean,
  parent_issue_id uuid references issues(id),     -- duplicate merging
  upvotes        int default 0,
  created_at     timestamptz default now()
);
create index on issues (geo_unit_id, status, created_at desc);
create index on issues using gist (location);

create table issue_media (
  issue_id uuid references issues(id) on delete cascade,
  media_id uuid references media(id) on delete cascade,
  primary key (issue_id, media_id)
);

create table issue_events (          -- append-only timeline; the trust surface
  id         bigserial primary key,
  issue_id   uuid not null references issues(id) on delete cascade,
  actor_id   uuid references profiles(id),
  from_status issue_status,
  to_status  issue_status not null,
  note       text,
  created_at timestamptz default now()
);

create table issue_upvotes (
  issue_id uuid references issues(id) on delete cascade,
  user_id  uuid references profiles(id) on delete cascade,
  primary key (issue_id, user_id)
);
```

## 6.9 Notifications & devices

```sql
create table devices (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  expo_token  text not null unique,
  platform    text,
  locale      text,
  last_seen_at timestamptz default now()
);

create table notifications (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references profiles(id) on delete cascade,
  kind      text not null,               -- notice.published, booking.confirmed, issue.status …
  title     text not null,
  body      text,
  data      jsonb,                        -- deep-link payload
  read_at   timestamptz,
  created_at timestamptz default now()
);
create index on notifications (user_id, created_at desc) where read_at is null;
```

## 6.10 Row-level security

Every table: `alter table X enable row level security;` with **no permissive default**.
Representative policies — the pattern repeats.

```sql
-- Profiles: yourself always; co-villagers if you have not opted out of the directory.
create policy profile_self on profiles
  for select using (id = auth.uid());

create policy profile_covillagers on profiles
  for select using (
    village_id = my_village()
    and is_active
    and exists (select 1 from privacy_settings s
                where s.user_id = profiles.id and s.in_directory)
  );

create policy profile_update_self on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
```

> **Phone numbers are not protected by this policy** — column-level security is not
> available, so `profiles.phone` is exposed to any co-villager `select *`. It is therefore
> **not stored on `profiles` for reads**: the client-facing view `directory_members`
> (below) omits it, the base table is revoked from `anon`/`authenticated`, and the number
> is only ever obtained through `rpc.get_member_contact`.

```sql
revoke select on profiles from authenticated;
create view directory_members with (security_invoker = true) as
  select p.id, p.full_name, p.village_id, p.panchayat_id, p.roles, p.created_at,
         case when s.show_avatar = 'villagers' then p.avatar_path end     as avatar_path,
         case when s.show_occupation = 'villagers' then p.occupation end  as occupation,
         (s.show_phone = 'villagers')                                     as phone_available
  from profiles p join privacy_settings s on s.user_id = p.id
  where p.is_active and s.in_directory;
grant select on directory_members to authenticated;

-- Village content: read approved rows in your own geo subtree; write your own submissions.
create policy places_read on places for select using (
  status = 'approved' and geo_unit_id = my_village()
);
create policy places_read_own on places for select using (submitted_by = auth.uid());
create policy places_insert  on places for insert
  with check (submitted_by = auth.uid() and geo_unit_id = my_village()
              and status = 'pending');
create policy places_moderate on places for update using (admins_geo(geo_unit_id));

-- Notices: visible to every descendant of the target unit.
create policy notices_read on notices for select using (
  exists (select 1 from geo_units target, geo_units mine
          where target.id = notices.geo_unit_id and mine.id = my_village()
            and mine.path <@ target.path)
);
create policy notices_write on notices for all using (admins_geo(geo_unit_id));

-- Trips are public to all authenticated users (transport crosses villages by nature).
create policy trips_read on trips for select using (auth.role() = 'authenticated');
create policy trips_write on trips for all
  using (driver_id = auth.uid()) with check (driver_id = auth.uid());

-- Seat maps are readable; they are only ever written through the booking RPCs.
create policy seats_read on trip_seats for select using (auth.role() = 'authenticated');
revoke insert, update, delete on trip_seats from authenticated;

-- Bookings: passenger and that trip's driver only.
create policy bookings_passenger on bookings for select using (passenger_id = auth.uid());
create policy bookings_driver on bookings for select using (
  exists (select 1 from trips t where t.id = bookings.trip_id and t.driver_id = auth.uid())
);

-- Issues: reporter, geo admins, routed department liaison; public ones to co-villagers.
create policy issues_reporter on issues for select using (reporter_id = auth.uid());
create policy issues_public on issues for select
  using (is_public and geo_unit_id = my_village());
create policy issues_admin on issues for all using (admins_geo(geo_unit_id));
create policy issues_dept on issues for select using (
  has_role('dept_liaison') and department_id in (
    select department_id from department_liaisons where user_id = auth.uid())
);
create policy issues_insert on issues for insert
  with check (reporter_id = auth.uid() and status = 'submitted');
```

Storage policies follow the same shape: `avatars` public-read; `village-media` readable
only by members of the owning geo unit; `issue-media` readable only by the reporter, geo
admins, and the routed liaison, and always served as short-lived signed URLs.

## 6.11 Scheduled jobs (`pg_cron`)

| Schedule | Job |
|---|---|
| every 1 min | Expire seat holds: `held` + `hold_expires_at < now()` → `free` |
| every 5 min | Expire `driver_presence` past `expires_at`; expire `seat_claims` |
| every 15 min | Auto-complete trips past `departure_at + duration_min` |
| daily 02:00 | Archive expired notices; recompute `drivers.rating_avg`; prune `contact_access_log` > 180 days |
| weekly | Helpline source diff check → admin review task (never auto-publishes) |
