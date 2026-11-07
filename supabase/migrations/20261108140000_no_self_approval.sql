-- A reviewer may not approve their own licence (spec 04.5).
--
-- `review_driver_document` asked whether the caller holds `district_admin` or
-- `super_admin`. It never asked whose document it was — so anyone with the role could
-- photograph their own licence, open the queue and wave it through, and the four-step
-- test in `docs/making-someone-an-admin.md` told them to do exactly that.
--
-- That is fine for one person proving the flow works and indefensible the moment a real
-- driver is on the other side of it, because the whole value of a verified badge is
-- that somebody *else* looked. A check nobody would have noticed missing is the kind
-- worth adding before the pilot rather than after.
--
-- Two halves, and the second matters as much as the first:
--
--   1. The decision is refused.
--   2. The document **leaves the reviewer's own queue**, because a card with two
--      buttons that both fail is a worse answer than no card. A reviewer who is also a
--      driver simply cannot action their own paperwork, and must ask another reviewer —
--      which is the point.
--
-- Reading it stays allowed: `driver_documents_readable` already lets you see your own
-- documents, and that is how the driver screen shows you what you sent.

set search_path = public, extensions;

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

  -- Holding the role is not the same as being somebody else.
  if review_driver_document.driver = me then
    raise exception 'a reviewer cannot check their own documents'
      using errcode = '42501';
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
  'A district reviewer approves or refuses one document — somebody else''s. A refusal '
  'carries a reason, because the driver reads it and has to know what to send instead.';

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
     -- Your own paperwork is not in your queue. The decision is refused anyway, and a
     -- card whose buttons both fail is a worse answer than no card.
     and d.user_id <> (select auth.uid())
   order by d.submitted_at
   limit 100;
$$;

comment on function driver_review_queue is
  'Documents waiting for this reviewer — never their own.';
