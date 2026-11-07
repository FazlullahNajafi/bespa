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

Do not grant it to someone in a village they do not live in. You name the village in the
grant itself, so a careless one hands a stranger that village's megaphone and nothing
about the person's own profile will correct it.

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

3. Find the village you are granting **for**. You name it yourself rather than trusting
   their profile to be pointing at the right one when you run this:

   ```sql
   select id, name_en, type, path::text
     from geo_units
    where name_en ilike '%village name%' and type in ('village', 'town');
   ```

4. Grant, naming both:

   ```sql
   insert into admin_grants (user_id, geo_unit_id, role, granted_by, note)
   values ('the-person-uuid',
           'the-village-uuid',
           'panchayat_admin',
           null,
           'verified by phone, 2026-11-03')
   on conflict (user_id, geo_unit_id, role) do nothing;
   ```

   The `note` is worth filling in. The role is handed out on a human check, so the record
   of that check belongs with the grant rather than in your memory.

   **The grant is pinned to that village and does not follow the person.** If they change
   village later, their rights stay where they were granted — which is the point. Before
   2026-11-03 the scope was read from their profile, so moving village moved the
   megaphone with them.

5. Tell them to **close and reopen Bespa**. The profile is cached for five minutes and
   kept across restarts, so the "Write a notice" button will not appear until the app
   refetches.

## Taking it away

```sql
delete from admin_grants
 where user_id = 'the-uuid'
   and geo_unit_id = 'the-village-uuid';
```

To see what someone currently holds:

```sql
select g.role, u.name_en as unit, g.granted_at, g.note
  from admin_grants g join geo_units u on u.id = g.geo_unit_id
 where g.user_id = 'the-uuid';
```

Their notices stay published. `published_by` records who wrote each one, which is the
point of attributing them — an unattributed notice that pushes to a whole village is
exactly what accountability is for.

## What they can and cannot do

They **can** write a notice for their own village, which reaches every member of it and
pushes to their phones; edit one of their village's own notices afterwards (title, body,
category, pin, expiry); and maintain the **panchayat contact cards** that sit above the
directory — adding the sarpanch's card, correcting it when the office changes hands, and
removing it. Those cards carry their phone number openly, because spec 3.4 treats an
office's number as public within the village.

They **cannot** publish to another village, to the block, or to the district — the server
checks containment, so naming a unit above their scope is refused, not just hidden. They
cannot delete a notice: nothing in this app grants DELETE on `notices`. They cannot make a
notice look official; `source` is set to `local` by the server and never by the client.

## Checking what you have granted

```sql
select p.full_name, u.name_en as administers, g.role, g.granted_at, g.note
  from admin_grants g
  join profiles p on p.id = g.user_id
  join geo_units u on u.id = g.geo_unit_id
 order by u.name_en, p.full_name;
```

---

# Checking driver documents

A separate job from the one above, and a separate kind of admin.

## Why a panchayat admin cannot do it

A panchayat admin administers a **village**. A commercial driving licence is a district
document: it is issued by the RTO, it is valid across Ladakh, and a village has no
standing to judge one. It also carries a full name, an address, a date of birth and a
licence number — so "who may look at it" is a privacy question, not a convenience one.

The server enforces this. `reviews_drivers()` allows only **`district_admin`** and
**`super_admin`**, which are the two roles deliberately not pinned to a geography. A
panchayat admin of the applicant's own village is refused the document, the queue, and
the decision. There is a pgTAP assertion for each of those three.

## Making yourself able to review

Unlike `panchayat_admin`, this is not a row in `admin_grants` — it is a role on the
profile, because it applies everywhere rather than to one place. Same reasoning as the
October fix: `roles` is not user-writable, so it can only be set by someone with the
database keys.

In the Supabase dashboard → **SQL editor**, with your own email:

```sql
update profiles
   set roles = array(select distinct unnest(roles || 'super_admin'::user_role))
 where id = (select id from auth.users where email = 'you@example.com');
```

`array(select distinct unnest(...))` rather than `roles || 'super_admin'` on its own, so
running it twice does not leave you with the role listed twice.

Check it took:

```sql
select u.email, p.roles
  from profiles p join auth.users u on u.id = p.id
 where 'super_admin' = any(p.roles) or 'district_admin' = any(p.roles);
```

Then **close and reopen Bespa** — the profile is cached for five minutes, and the row
that appears on the Profile tab is drawn from it.

## Where you actually review

**Profile tab → Driver documents.** The row only appears for the two roles above.

Each card shows who sent it, which document it is, and how long it has been waiting.
**Open the photo** opens it full-screen in the browser on a signed link that lasts
fifteen minutes — deliberately not an inline thumbnail, because a licence has small print
and a thumbnail is how a document gets approved without being read.

Then **Looks right**, or **Send it back** with a reason. The reason is required and the
driver reads it, so write what they should photograph instead — "the photo is too dark",
not "rejected".

## What approving actually unlocks

Only the **commercial driving licence** gates anything. Once it is approved that driver
can post trips and go live; until then the server refuses both with their own error code
and the app offers them this flow instead of the form.

The permit and the taxi badge are collected and shown on their verification screen, but
they do not gate anything. Blocking a licensed driver off the board over a route permit
he has not photographed yet would empty the board for a clerical reason rather than a
safety one.

Withdrawing a licence — send it back after approving — takes the badge off trips that
driver has **already** posted, because the badge is read live rather than stored on the
trip. A cached badge is the one that keeps vouching after the vouching stopped.

## For testing, end to end

1. Grant yourself `super_admin` with the statement above, reopen the app.
2. On the driver account: occupation **Driver** during sign-up, or Rides → Post a trip →
   **Get verified**. Send a photo of anything for the licence.
3. On your account: Profile → **Driver documents** → open it → **Looks right**.
4. Back on the driver account, Post a trip now shows the form instead of the offer.

One account can do all of it: grant yourself `super_admin`, send your own licence, and
approve it. Nothing stops a reviewer approving their own document — worth knowing before
a real pilot, and listed in the open issues in `docs/architecture.md`.
