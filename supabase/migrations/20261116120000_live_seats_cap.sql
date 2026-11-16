-- `set_live_seats` is the only way the number on the board changes after a driver goes
-- live, and until now it clamped one end only.
--
-- `go_live` refuses more seats than the vehicle has. `set_live_seats` did not, so the
-- rule held exactly until the first adjustment and then stopped holding — and the board
-- is read by someone standing at the stand deciding whether to walk over. An Alto
-- advertising eight seats is not a cosmetic error.
--
-- This became reachable with the "one more seat" control (spec 04.4): a driver whose
-- passenger walks away needs the count to go back up, and a control that only goes down
-- leaves a van reading "Full" for 45 minutes because of one tap.
--
-- Both ends are clamped rather than raised as errors. The caller is a stepper, not a
-- form: there is no wrong number to report back, only a limit to stop at.

create or replace function set_live_seats(live uuid, seats_free smallint)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null
     or not exists (select 1 from live_rides r
                     where r.id = set_live_seats.live and r.driver_id = (select auth.uid())) then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  update live_rides r
     set seats_free = greatest(0, least(set_live_seats.seats_free, v.seats))
    from vehicles v
   where r.id = set_live_seats.live
     and v.id = r.vehicle_id;
end $$;

comment on function set_live_seats is
  'Sets the seats showing on the board, clamped to between zero and the vehicle''s own '
  'capacity. The driver''s stepper is the only caller.';
