# Making someone a panchayat admin

A panchayat admin can write notices for their own village. Nobody else can, and there is
**no screen for granting it** — on purpose. You do it by hand, once per person, in the
Supabase dashboard.

## Why by hand

`profiles.roles` is deliberately not writable by users. In October this app had a live
privilege escalation: a user could run `update profiles set roles = '{super_admin}'`
because the security policy only checked that the row was *theirs*, which it was. The fix
was to grant UPDATE column by column and leave `roles` out, so the only way in is a
statement run by someone with the keys — you.

A screen for it is a new way in, and it would need its own tests to be worth trusting. For
a three-village pilot, a statement is the right size of tool.

## Who to give it to

Spec 9.3 risk 1b is explicit that this is a **role and not an office**: give it to whoever
already runs the village WhatsApp group, on the sarpanch's nomination. That is the
decision from 2026-11-02 and it is why the composer is a plain form — the person using it
is someone who already types.

Do not grant it to someone in a village they do not live in. The scope follows their
`village_id`, so moving village moves their admin rights with them.

## How

1. Open the project's SQL editor:
   https://supabase.com/dashboard/project/oibfmuwjzzbqtybwafxa/sql

2. Find the person. Search by name, so you can check the village before you grant
   anything:

   ```sql
   select p.id, p.full_name, g.name_en as village, p.roles
     from profiles p
     left join geo_units g on g.id = p.village_id
    where p.full_name ilike '%part of their name%';
   ```

3. Check the village in that result is the one you mean. Then grant:

   ```sql
   update profiles
      set roles = array(select distinct unnest(roles || '{panchayat_admin}'::user_role[]))
    where id = 'the-uuid-from-step-2';
   ```

   The `array(select distinct unnest(...))` is not decoration: it adds the role without
   dropping the ones already there, and running it twice leaves one copy rather than two.

4. Tell them to **close and reopen Bespa**. The profile is cached for five minutes and
   kept across restarts, so the "Write a notice" button will not appear until the app
   refetches.

## Taking it away

```sql
update profiles
   set roles = array_remove(roles, 'panchayat_admin'::user_role)
 where id = 'the-uuid';
```

Their notices stay published. `published_by` records who wrote each one, which is the
point of attributing them — an unattributed notice that pushes to a whole village is
exactly what accountability is for.

## What they can and cannot do

They **can** write a notice for their own village, which reaches every member of it and
pushes to their phones; and edit one of their village's own notices afterwards (title,
body, category, pin, expiry).

They **cannot** publish to another village, to the block, or to the district — the server
checks containment, so naming a unit above their scope is refused, not just hidden. They
cannot delete a notice: nothing in this app grants DELETE on `notices`. They cannot make a
notice look official; `source` is set to `local` by the server and never by the client.

## Checking what you have granted

```sql
select p.full_name, g.name_en as village, p.roles
  from profiles p
  left join geo_units g on g.id = p.village_id
 where p.roles && '{panchayat_admin,district_admin,super_admin}'::user_role[];
```
