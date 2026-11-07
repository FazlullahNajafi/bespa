-- Driver verification (spec 04.5, and the design's `screens-driver-verify`).
--
-- The design's opening note is the brief for this whole migration: *"We only confirm
-- that they ARE a taxi driver — no Aadhaar / KYC, no vehicle paperwork chase. Just the
-- two-or-three documents the RTO already issues to licensed taxi drivers."* So there are
-- three documents and no identity programme, and the schema cannot grow one by accident.
--
-- ## A licence photograph does not go in the `images` bucket
--
-- `images` is readable by anyone in the uploader's village — that is the whole point of
-- it, and it is exactly wrong here. A commercial driving licence carries a full name, an
-- address, a date of birth and a licence number, and publishing one to two hundred
-- neighbours because the gallery already had a bucket would be the worst privacy failure
-- in this app by some distance.
--
-- So: a second bucket, `documents`, private, where an object is readable by **its owner
-- and a district reviewer and nobody else** — not by the village, not by a
-- `panchayat_admin`, not by another driver.
--
-- ## Who verifies
--
-- Not `admins_geo`. A panchayat admin administers a village; a driving licence is a
-- district matter and a village admin has no standing to judge one. Review is
-- `district_admin` or `super_admin`, which are the two roles that are deliberately not
-- pinned to a geography.
--
-- ## What verification gates
--
-- Spec 04.5: "Unverified drivers may not create trips or go live." Enforced here, on the
-- **licence only**. The permit and the badge are collected and shown, but blocking a
-- real driver off the board over a route permit he has not photographed yet would make
-- the board empty for the wrong reason — and the licence is the one document that is
-- legally required to carry a passenger at all.

set search_path = public, extensions;

-- The design's three. A new type rather than text: this list comes from the RTO and
-- does not vary by village, so the one spelling matters and a typo should not create a
-- fourth document.
create type driver_doc_kind as enum ('licence', 'permit', 'badge');

create table driver_documents (
  user_id uuid not null references profiles(id) on delete cascade,
  kind    driver_doc_kind not null,

  /** `<user_id>/<kind>/<file>` in the private `documents` bucket. */
  storage_path text not null,

  -- The design shows four states. "Not uploaded" is the absence of a row, so the three
  -- here are its other three: `pending` is the design's "In review", `approved` its
  -- "Verified", `rejected` its "Rejected".
  status        mod_status not null default 'pending',
  reject_reason text,
  reviewed_by   uuid references profiles(id),
  reviewed_at   timestamptz,

  submitted_at timestamptz not null default now(),

  -- Named, because `submit_driver_document` upserts `on conflict on constraint`: a
  -- conflict target written as a column list cannot be qualified, and `kind` is also a
  -- parameter name in that function, so Postgres refuses it as ambiguous. Third time
  -- this shape has bitten in this repo.
  constraint driver_documents_pkey primary key (user_id, kind),

  constraint driver_documents_rejected_has_reason
    check (status <> 'rejected' or length(btrim(coalesce(reject_reason, ''))) > 0),
  constraint driver_documents_reviewed_together
    check ((reviewed_by is null) = (reviewed_at is null))
);

create index driver_documents_queue_idx
  on driver_documents (submitted_at) where status = 'pending';

alter table driver_documents enable row level security;

create or replace function reviews_drivers() returns boolean
  language sql stable security definer set search_path = public, extensions as $$
  select has_role('district_admin'::user_role) or has_role('super_admin'::user_role);
$$;

comment on function reviews_drivers is
  'Who may look at a driver''s documents. Deliberately not admins_geo: a panchayat '
  'admin administers a village, and a driving licence is not a village matter.';

-- The owner and a district reviewer. Nobody else — not the village, not other drivers.
create policy driver_documents_readable on driver_documents
  for select to authenticated
  using (user_id = (select auth.uid()) or reviews_drivers());

grant select on driver_documents to authenticated;

-- ---------------------------------------------------------------------------
-- The private bucket
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 5 * 1024 * 1024,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- `<user_id>/…` — one segment, not two. The `images` bucket leads with the village
-- because that is who may see it; nothing about a licence is village-scoped, and
-- putting a village in the path would invite a policy that reads it.
create policy documents_read_own_or_reviewer on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or reviews_drivers()
    )
  );

create policy documents_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy documents_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ---------------------------------------------------------------------------
-- Submitting and reviewing
-- ---------------------------------------------------------------------------

create or replace function submit_driver_document(kind driver_doc_kind, storage_path text)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  if storage_path not like (me::text || '/%') then
    raise exception 'document does not belong to this user' using errcode = '22023';
  end if;

  -- Re-uploading after a rejection replaces the row and clears the decision, which is
  -- the design's "Re-upload" action. The old reason must go with it, or a document
  -- sitting in review still shows why the last one was refused.
  insert into driver_documents as d (user_id, kind, storage_path)
  values (me, submit_driver_document.kind, submit_driver_document.storage_path)
  on conflict on constraint driver_documents_pkey do update
     set storage_path  = excluded.storage_path,
         status        = 'pending',
         reject_reason = null,
         reviewed_by   = null,
         reviewed_at   = null,
         submitted_at  = now();
end $$;

create or replace function review_driver_document(
  driver uuid,
  kind   driver_doc_kind,
  approve boolean,
  reason text default null
)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
begin
  if me is null or not reviews_drivers() then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  if not approve and length(btrim(coalesce(reason, ''))) = 0 then
    raise exception 'a rejection needs a reason' using errcode = '22023';
  end if;

  update driver_documents d
     set status        = case when approve then 'approved' else 'rejected' end::mod_status,
         reject_reason = case when approve then null else btrim(reason) end,
         reviewed_by   = me,
         reviewed_at   = now()
   where d.user_id = review_driver_document.driver
     and d.kind    = review_driver_document.kind;

  if not found then
    raise exception 'no such document' using errcode = '22023';
  end if;
end $$;

comment on function review_driver_document is
  'A district reviewer approves or refuses one document. A refusal carries a reason, '
  'because the driver reads it and has to know what to send instead.';

/**
 * Whether this user may put a vehicle in front of passengers.
 *
 * The licence alone. See the header: the permit and the badge are collected and shown,
 * and blocking a licensed driver off the board over a route permit he has not
 * photographed would empty the board for a clerical reason.
 */
create or replace function is_verified_driver(uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1 from driver_documents d
     where d.user_id = uid and d.kind = 'licence' and d.status = 'approved'
  );
$$;

-- ---------------------------------------------------------------------------
-- The gate (spec 04.5)
-- ---------------------------------------------------------------------------

create or replace function create_trip(
  vehicle          uuid,
  from_label       text,
  to_label         text,
  departure_date   date,
  price_per_seat   numeric,
  seats_total      smallint,
  departure_window text default null,
  mode             trip_mode default 'shared',
  pickup_note      text default null,
  contact_phone    text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  me      uuid := auth.uid();
  owner   uuid;
  cap     smallint;
  new_id  uuid;
begin
  if me is null then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  -- Spec 04.5: unverified drivers may not create trips. Its own code, so the screen can
  -- offer the verification flow rather than showing a flat refusal.
  if not is_verified_driver(me) then
    raise exception 'driver is not verified' using errcode = 'PT403';
  end if;

  select v.owner_id, v.seats into owner, cap from vehicles v where v.id = create_trip.vehicle;
  if owner is null or owner <> me then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  if create_trip.seats_total > cap then
    raise exception 'more seats than the vehicle has' using errcode = '22023';
  end if;

  if create_trip.departure_date < current_date then
    raise exception 'that date has passed' using errcode = '22023';
  end if;

  insert into trips (driver_id, vehicle_id, from_label, to_label, departure_date,
                     departure_window, price_per_seat, seats_total, mode, pickup_note,
                     contact_phone)
  values (me, create_trip.vehicle,
          btrim(create_trip.from_label), btrim(create_trip.to_label),
          create_trip.departure_date,
          nullif(btrim(coalesce(create_trip.departure_window, '')), ''),
          create_trip.price_per_seat, create_trip.seats_total, create_trip.mode,
          nullif(btrim(coalesce(create_trip.pickup_note, '')), ''),
          nullif(btrim(coalesce(create_trip.contact_phone, '')), ''))
  returning id into new_id;

  insert into trip_seats (trip_id, seat_no)
  select new_id, n from generate_series(1, create_trip.seats_total) as n;

  return new_id;
end $$;

create or replace function go_live(
  vehicle    uuid,
  from_label text,
  to_label   text,
  seats_free smallint,
  fare       numeric default null,
  stand_note text default null,
  contact_phone text default null
)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  me     uuid := auth.uid();
  owner  uuid;
  cap    smallint;
  new_id uuid;
begin
  if me is null then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  if not is_verified_driver(me) then
    raise exception 'driver is not verified' using errcode = 'PT403';
  end if;

  select v.owner_id, v.seats into owner, cap from vehicles v where v.id = go_live.vehicle;
  if owner is null or owner <> me then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  if go_live.seats_free > cap then
    raise exception 'more seats than the vehicle has' using errcode = '22023';
  end if;

  update live_rides r
     set ended_at = now(), ended_reason = 'replaced'
   where r.driver_id = me and r.ended_at is null and r.expires_at > now();

  insert into live_rides (driver_id, vehicle_id, from_label, to_label,
                          seats_free, fare, stand_note, contact_phone)
  values (me, go_live.vehicle, btrim(go_live.from_label), btrim(go_live.to_label),
          go_live.seats_free, go_live.fare,
          nullif(btrim(coalesce(go_live.stand_note, '')), ''),
          nullif(btrim(coalesce(go_live.contact_phone, '')), ''))
  returning id into new_id;

  return new_id;
end $$;

-- ---------------------------------------------------------------------------
-- What a passenger sees
-- ---------------------------------------------------------------------------

/**
 * The verified badge on a trip or a board row.
 *
 * A function and not a column on `trips`, so a driver whose licence is later withdrawn
 * stops showing as verified on trips they posted before — a cached badge is the one
 * that keeps vouching after the vouching stopped.
 */
create or replace function verified_drivers(ids uuid[])
returns table (user_id uuid)
language sql stable security definer set search_path = public, extensions as $$
  select distinct d.user_id
    from driver_documents d
   where d.user_id = any (ids)
     and d.kind = 'licence'
     and d.status = 'approved';
$$;

/** The queue, for a district reviewer. */
create or replace function driver_review_queue()
returns table (
  user_id      uuid,
  full_name    text,
  kind         driver_doc_kind,
  storage_path text,
  submitted_at timestamptz
)
language sql stable security definer set search_path = public, extensions as $$
  select d.user_id, p.full_name, d.kind, d.storage_path, d.submitted_at
    from driver_documents d
    join profiles p on p.id = d.user_id
   where d.status = 'pending'
     and reviews_drivers()
   order by d.submitted_at
   limit 100;
$$;

revoke execute on function submit_driver_document(driver_doc_kind, text) from public;
revoke execute on function review_driver_document(uuid, driver_doc_kind, boolean, text) from public;
revoke execute on function is_verified_driver(uuid) from public;
revoke execute on function verified_drivers(uuid[]) from public;
revoke execute on function driver_review_queue() from public;
revoke execute on function reviews_drivers() from public;

grant execute on function submit_driver_document(driver_doc_kind, text) to authenticated;
grant execute on function review_driver_document(uuid, driver_doc_kind, boolean, text) to authenticated;
grant execute on function is_verified_driver(uuid) to authenticated;
grant execute on function verified_drivers(uuid[]) to authenticated;
grant execute on function driver_review_queue() to authenticated;
grant execute on function reviews_drivers() to authenticated;
