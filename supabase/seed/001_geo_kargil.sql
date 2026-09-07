-- Geo seed — Ladakh / Kargil.
--
-- HONESTY RULE (spec 01.8 #4: "Nothing is fake"). This file contains only units that are
-- named in the specification itself. It stops at block level on purpose:
--
--   * The UT and the district are unambiguous.
--   * The six blocks are the ones listed in spec 02.2.
--   * VILLAGES ARE DELIBERATELY NOT SEEDED HERE. The spec names Baroo, Minjee, Trespone,
--     Choskore and Ando, but not which block each belongs to, and guessing the parentage
--     would put invented administrative data into the tenancy spine — the one table where
--     a wrong row is most expensive to unpick later.
--
-- Villages arrive via the LGD import (spec 02.2), with `lgd_code` populated and the
-- parentage hand-checked. That import is a Phase 0 task and blocks Phase 1.
-- Test fixtures create their own throwaway villages; they never rely on this file.
--
-- `slug` doubles as the ltree label, so it must match ^[a-z0-9_]{1,63}$.

insert into geo_units (type, parent_id, slug, name_en, name_ur, name_bft, lgd_code)
values ('ut', null, 'ladakh', 'Ladakh', 'لداخ', null, null)
on conflict (parent_id, slug) do nothing;

insert into geo_units (type, parent_id, slug, name_en, name_ur, name_bft, lgd_code)
select 'district', g.id, 'kargil', 'Kargil', 'کرگل', null, null
  from geo_units g where g.path = 'ladakh'::extensions.ltree
on conflict (parent_id, slug) do nothing;

-- Blocks as listed in spec 02.2. Names are English transliterations in common official
-- use; Urdu and Purgi forms are left null rather than guessed, and get filled in with the
-- LGD import and local review.
insert into geo_units (type, parent_id, slug, name_en)
select 'block', d.id, v.slug, v.name_en
  from geo_units d
  cross join (values
      ('kargil',         'Kargil'),
      ('sankoo',         'Sankoo'),
      ('drass',          'Drass'),
      ('shakar_chiktan', 'Shakar-Chiktan'),
      ('taisuru',        'Taisuru'),
      ('zanskar',        'Zanskar')
  ) as v(slug, name_en)
 where d.path = 'ladakh.kargil'::extensions.ltree
on conflict (parent_id, slug) do nothing;
