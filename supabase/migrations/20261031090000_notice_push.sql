-- Announcing a notice (spec 03.5, 06.9, 07.3 `push-fanout`).
--
-- `devices` has held push tokens since 20261020150000 and `notifications` has held the
-- unread badge, and between them nothing has ever sent anything: a notice reached only
-- whoever happened to open the app that day, which is the exact failure the module was
-- built to fix. These three functions are the server half of the daily job that closes
-- it (`scripts/send-notice-push.py`, run from `.github/workflows/daily.yml`).
--
-- All three are for the **service role only**, because the queue hands out push tokens.
-- A token is a capability to push to someone's handset; `devices`' own RLS already keeps
-- them from every other user, and nothing here may widen that.
--
-- Note for the next person: `service_role` bypasses RLS but **not** table privileges, so
-- a plain query from the importer would still fail with "permission denied for table
-- geo_units". Security definer is what makes these readable, and it is why the scoping
-- logic lives in here rather than in the Python.

set search_path = public, extensions;

alter table notices add column pushed_at timestamptz;

comment on column notices.pushed_at is
  'When this notice was announced by push. Null means pending. Set by record_notice_push.';

-- Everything already in the table counts as announced. Without this, the first run of
-- the job would fire every current notice at once — nine of them on the day it ships —
-- which reads as spam from an app nobody has heard a sound from before.
update notices set pushed_at = now() where pushed_at is null;

-- ---------------------------------------------------------------------------
-- The queue
-- ---------------------------------------------------------------------------

create or replace function notice_push_queue(max_age_days int default 3)
returns table (
  notice_id  uuid,
  title      text,
  category   notice_category,
  user_id    uuid,
  expo_token text,
  locale     text
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select n.id, n.title, n.category, p.id, d.expo_token, d.locale
    from notices n
    join notice_sources s on s.key = n.source
    join geo_units g on g.path operator(extensions.<@) n.geo_path
    join profiles p on p.village_id = g.id
    join devices d on d.user_id = p.id
   where n.pushed_at is null
     -- The kill switch in spec 09.4 #2 governs sending as well as showing: a source
     -- switched off mid-import must not still be announced.
     and s.enabled
     -- Never announce something already over. An import that back-fills old notices
     -- would otherwise wake a village for a window that closed last year.
     and (n.expires_at is null or n.expires_at > now())
     -- Nor anything stale. If the job has been down for a week, the backlog is read on
     -- the notices screen, not delivered as seven notifications at once.
     and n.published_at > now() - make_interval(days => max_age_days)
   order by n.published_at;
$$;

comment on function notice_push_queue is
  'One row per device that should hear about a pending notice. service_role only: a push '
  'token is a capability to reach a handset.';

-- ---------------------------------------------------------------------------
-- Recording the send
-- ---------------------------------------------------------------------------

create or replace function record_notice_push(p_notice_id uuid)
returns int
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  recipients int;
begin
  -- One row per *user*, not per device: the badge is a person's unread count, and a
  -- villager with a phone and a shared handset has not been told twice.
  insert into notifications (user_id, kind, title, body, data)
  select distinct p.id,
         'notice.published',
         n.title,
         null,
         jsonb_build_object('notice_id', n.id)
    from notices n
    join geo_units g on g.path operator(extensions.<@) n.geo_path
    join profiles p on p.village_id = g.id
   where n.id = p_notice_id;

  get diagnostics recipients = row_count;

  -- Stamped whatever the count: a notice nobody is in range of is still answered, or it
  -- sits at the head of the queue forever and blocks everything behind it.
  update notices set pushed_at = now() where id = p_notice_id and pushed_at is null;

  return recipients;
end;
$$;

comment on function record_notice_push is
  'Writes the in-app notification rows for a notice and marks it announced. Idempotent on '
  'the flag; call it once, after the push has been accepted.';

-- ---------------------------------------------------------------------------
-- Dead tokens
-- ---------------------------------------------------------------------------

create or replace function forget_device_token(p_token text)
returns void
language sql
security definer
set search_path = public, extensions
as $$
  -- Expo answers DeviceNotRegistered for a token belonging to an app that was
  -- uninstalled or whose token was rotated. Keeping it means pushing into the void on
  -- every run, and counting a delivery that never happens.
  delete from devices where expo_token = p_token;
$$;

comment on function forget_device_token is
  'Drops a push token Expo has rejected as unregistered. service_role only.';

revoke execute on function notice_push_queue(int) from public;
revoke execute on function record_notice_push(uuid) from public;
revoke execute on function forget_device_token(text) from public;

grant execute on function notice_push_queue(int) to service_role;
grant execute on function record_notice_push(uuid) to service_role;
grant execute on function forget_device_token(text) to service_role;
