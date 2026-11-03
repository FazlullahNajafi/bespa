-- Editing and removing a panchayat contact card (spec 03.4).
--
-- `publish_village_contact` has existed since the directory migration and there has never
-- been a way to correct or remove what it wrote. That is not a tidiness problem: these
-- cards are offices, and an office changes hands. A sarpanch's card still showing last
-- year's holder's number is worse than no card — people ring it, and the number they
-- reach has no idea why.
--
-- Definer functions rather than grants, for the reason the rest of this schema gives: no
-- table here grants INSERT, UPDATE or DELETE, so a client cannot claim `created_by` or
-- move a row into a village it does not administer. `admins_geo` is re-checked on the
-- row's CURRENT geo unit, not on anything the caller passes.
--
-- DELETE is allowed here, unlike on `notices`, and the difference is worth stating. A
-- notice is a published record — it was true when it was sent, and removing it rewrites
-- what the village was told. A contact card is a standing claim about who to ring today,
-- so leaving a wrong one up is the harm, not taking it down.

set search_path = public, extensions;

create or replace function update_village_contact(
  p_id          uuid,
  p_name        text,
  p_designation text,
  p_phone       text default null,
  p_sort_order  int default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  me       uuid := auth.uid();
  target   uuid;
begin
  select geo_unit_id into target from village_contacts where id = p_id;

  if me is null or target is null or not admins_geo(target) then
    -- Same code for "no such row" and "not yours": which of the two it is would tell a
    -- caller whether an id exists in a village they cannot see.
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  update village_contacts
     set name        = btrim(p_name),
         designation = btrim(p_designation),
         phone       = nullif(btrim(coalesce(p_phone, '')), ''),
         sort_order  = coalesce(p_sort_order, sort_order),
         updated_at  = now()
   where id = p_id;
end;
$$;

comment on function update_village_contact is
  'Corrects a panchayat contact card the caller administers. The geo unit is never moved.';

create or replace function delete_village_contact(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  me     uuid := auth.uid();
  target uuid;
begin
  select geo_unit_id into target from village_contacts where id = p_id;

  if me is null or target is null or not admins_geo(target) then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  delete from village_contacts where id = p_id;
end;
$$;

comment on function delete_village_contact is
  'Removes a panchayat contact card. Allowed, unlike deleting a notice: a card is a claim '
  'about who to ring today, so a wrong one left up is the harm.';

revoke execute on function update_village_contact(uuid, text, text, text, int) from public;
revoke execute on function delete_village_contact(uuid) from public;

grant execute on function update_village_contact(uuid, text, text, text, int) to authenticated;
grant execute on function delete_village_contact(uuid) to authenticated;
