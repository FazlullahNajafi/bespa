-- Kargil's four districts (spec 02.2).
--
-- Ladakh was reorganised twice in 2026. Five districts were notified on 27 April (S.O.
-- 180) and Sankoo on 16 October (S.O. 284), taking the UT from two districts to eight.
-- Four of them cover the area Bespa serves:
--
--     Kargil   (retained) — Kargil, Soudh, Pashkum, Lotchum, Shargole, Shakar-Chiktan
--     Drass                — Drass, Bhimbat
--     Sankoo               — Sankoo, TSG, Barsoo, Tai-Suru
--     Zanskar              — Karsha, Zanskar, Lungnak
--
-- Until this ran, all fifteen blocks hung off Kargil, so a resident of Padum or Drass was
-- shown a district that stopped being theirs in April. The villages and the blocks
-- themselves do not move: only which district each block hangs under.
--
-- WHERE THIS CAME FROM, and what is proven rather than assumed:
--
--   * The block and village lists are unchanged. They come from the district
--     administration's own "List of Panchayat and Revenue Villages.xlsx", the same source
--     `gen-geo-seed.py` reads, and were checked row by row against what 002 already
--     seeds: 126 of 128 villages match exactly. The three in 002 and not in the source's
--     village column (Badgam, Chanigund, Gongma Minjee) are the documented panchayat-column
--     entries; `Ating'` appears in the source and not in 002, and is left alone here
--     rather than added without knowing why the generator dropped it.
--
--   * The district assignment is the only new claim, and it is fifteen rows. Three of the
--     four districts are corroborated by a detail each from the notifications as reported:
--     Thasgam (in Bhimbat) is named a Drass tehsil, Phay (in Karsha) a Zanskar one, and
--     Sankoo, TSG and Taisuru are three of Sankoo district's four.
--
--   * **CONFIRMED against the gazette, 2026-11-01.** All fifteen blocks were checked
--     against the Ladakh Gazette (Extraordinary, 22 October 2026, Notification
--     407-DRD (UTL) of 2026), whose annexures tabulate every panchayat halqa under its
--     block under its district for all eight districts. The four districts here match it
--     block for block: Kargil holds Kargil, Lotchum, Pashkum, Shaker-Chiktan, Shargole
--     and South; Drass holds Bhimbat and Drass; Sankoo holds Barsoo, Sankoo, Taisuru and
--     TSG; Zanskar holds Karsha, Lungnak and Zanskar.
--
--     **Barsoo included** — it was the one assignment nothing named when this was
--     written, because the earlier reports speak in TEHSILS while this table speaks in
--     BLOCKS. The gazette settles both halves: Barsoo is a block of Sankoo district, and
--     "GM Pore", the fourth Sankoo *tehsil* those reports named, turns out to be the
--     G.M.Pora-A and G.M.Pora-B *halqas* inside the TSG block. The two vocabularies
--     overlap without lining up, which is why they could not be compared name for name.
--
--     Two names differ in spelling only, and ours are left alone because they come from
--     the district administration's own list: `Soudh` is the gazette's `South`, and
--     `Shakar-Chiktan` its `Shaker-Chiktan`.
--
-- Not seeded: Leh, Nubra, Sham and Changthang. They are real districts and Bespa holds no
-- data for them, and the honesty rule in 001 applies — the tenancy spine is the one table
-- where an invented row is most expensive to unpick.
--
-- `005` and not part of `001`, where the blocks are, for the same reason `004` is
-- separate: this has to run after `002` has created the nine blocks it re-parents and
-- after `003` has given them the centroids copied below.
--
-- Migration `20261101090000` carries the same statements, for projects seeded before this
-- file existed. Both are idempotent, so whichever runs second changes nothing.

-- The three new districts. Each takes the centroid of its namesake block, which is the
-- settlement the district is named for and administered from — the honest reading of a
-- coordinate already hand-checked, rather than one invented here. The blocks keep theirs.
insert into geo_units (type, parent_id, slug, name_en, name_ur, centroid)
select 'district', l.id, b.slug, b.name_en, b.name_ur, b.centroid
  from geo_units l
  join geo_units b on b.path = ('ladakh.kargil.' || b.slug)::extensions.ltree
 where l.path = 'ladakh'::extensions.ltree
   and b.type = 'block'
   and b.slug in ('sankoo', 'drass', 'zanskar')
on conflict (parent_id, slug) do nothing;

-- Re-parent the nine blocks. `geo_units_set_path` recomputes each block's own path and
-- `geo_units_repath_descendants` rewrites every village beneath it in one statement, so
-- nothing below needs naming here.
update geo_units b
   set parent_id = d.id
  from geo_units d
 where d.type = 'district'
   and d.parent_id = (select id from geo_units where path = 'ladakh'::extensions.ltree)
   and b.type = 'block'
   and b.parent_id = (select id from geo_units where path = 'ladakh.kargil'::extensions.ltree)
   and (
        (d.slug = 'drass'   and b.slug in ('drass', 'bhimbat'))
     or (d.slug = 'sankoo'  and b.slug in ('sankoo', 'tsg', 'barsoo', 'taisuru'))
     or (d.slug = 'zanskar' and b.slug in ('karsha', 'zanskar', 'lungnak'))
   );

-- `notices.geo_path` and `village_contacts.geo_path` are denormalised copies, maintained
-- by a trigger that fires on *their* geo_unit_id changing — not on the unit's path
-- changing underneath them. Nothing else refreshes them, and a stale copy is a notice
-- delivered to the wrong set of villages.
update notices n
   set geo_path = g.path
  from geo_units g
 where g.id = n.geo_unit_id
   and n.geo_path is distinct from g.path;

update village_contacts c
   set geo_path = g.path
  from geo_units g
 where g.id = c.geo_unit_id
   and c.geo_path is distinct from g.path;
