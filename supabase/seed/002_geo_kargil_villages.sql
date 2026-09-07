-- Revenue villages of Kargil district, and the nine blocks 001 did not carry.
--
-- Source: "List of Panchayat and Revenue Vilages.xlsx" (district administration), which
-- lists, per block, two INDEPENDENT columns: existing Panchayats and existing Revenue
-- Villages, each with its own Sr. No. They are parallel lists, not a hierarchy -- the
-- counts differ per block (Tai-Suru: 9 panchayats, 17 villages) and rows carry one
-- without the other. Villages therefore hang off the BLOCK, matching the path in spec 06
-- (`ladakh.kargil.sankoo.minjee`). No panchayat->village mapping is inferable from this
-- sheet, so panchayats are deliberately NOT seeded here; inferring them from row
-- adjacency would invent relationships the source does not state.
--
-- Block boundaries are taken from the Sr. No columns restarting at 1, not from the block
-- label, which in the sheet is sometimes typed a couple of rows late (Tai-Suru).
--
-- The sheet's SUB DIVISION level (Kargil, Drass, Shaker-Chiktan, Sankoo, Zanskar) is not
-- represented: geo_type has no such member and the onboarding picker goes
-- ut -> district -> block -> village.
--
-- Urdu and Purgi names are absent from the source and stay null rather than guessed.
-- lgd_code likewise: this sheet carries no LGD codes.

set search_path = public, extensions;

-- The nine blocks missing from 001.
insert into geo_units (type, parent_id, slug, name_en)
select 'block', d.id, b.slug, b.name_en
  from (values
      ('soudh', 'Soudh'),
      ('bhimbat', 'Bhimbat'),
      ('pashkum', 'Pashkum'),
      ('lotchum', 'Lotchum'),
      ('shargole', 'Shargole'),
      ('tsg', 'TSG'),
      ('barsoo', 'Barsoo'),
      ('karsha', 'Karsha'),
      ('lungnak', 'Lungnak')
  ) as b(slug, name_en)
  join geo_units d on d.path = 'ladakh.kargil'::extensions.ltree
on conflict (parent_id, slug) do nothing;

-- 126 revenue villages across 15 blocks.
insert into geo_units (type, parent_id, slug, name_en)
select 'village', b.id, v.slug, v.name_en
  from (values
      ('kargil', 'minjee', 'Minjee'),
      ('kargil', 'shilkchey', 'Shilkchey'),
      ('kargil', 'choskore', 'Choskore'),
      ('kargil', 'sapi', 'Sapi'),
      ('kargil', 'batambis', 'Batambis'),
      ('kargil', 'lato_fultuks', 'Lato (Fultuks)'),
      ('kargil', 'hardass', 'Hardass'),
      ('kargil', 'chuliskamboo', 'Chuliskamboo'),
      ('kargil', 'karkit', 'Karkit'),
      ('kargil', 'kaksar', 'Kaksar'),
      ('soudh', 'yourbaltak', 'Yourbaltak'),
      ('soudh', 'akchamal', 'Akchamal'),
      ('soudh', 'tumail', 'Tumail'),
      ('soudh', 'barchay', 'Barchay'),
      ('soudh', 'apati', 'Apati'),
      ('soudh', 'lalong', 'Lalong'),
      ('soudh', 'silmo', 'Silmo'),
      ('soudh', 'chulichan', 'Chulichan'),
      ('soudh', 'garkone', 'Garkone'),
      ('soudh', 'darchiks', 'Darchiks'),
      ('drass', 'rambirpora', 'Rambirpora'),
      ('drass', 'tronjon', 'Tronjon'),
      ('drass', 'haripora', 'Haripora'),
      ('drass', 'holiyal', 'Holiyal'),
      ('drass', 'murad_bagh', 'Murad Bagh'),
      ('drass', 'muskoo', 'Muskoo'),
      ('drass', 'botokul', 'Botokul'),
      ('drass', 'goshan', 'Goshan'),
      ('drass', 'pandrass', 'Pandrass'),
      ('drass', 'matayan', 'Matayan'),
      ('bhimbat', 'kharboo', 'Kharboo'),
      ('bhimbat', 'shimsha', 'Shimsha'),
      ('bhimbat', 'thasgam', 'Thasgam'),
      ('bhimbat', 'jusgund', 'Jusgund'),
      ('bhimbat', 'bhimbat', 'Bhimbat'),
      ('bhimbat', 'gindiyal', 'Gindiyal'),
      ('bhimbat', 'youlboo', 'Youlboo'),
      ('bhimbat', 'chowkiyal', 'Chowkiyal'),
      ('bhimbat', 'throngos', 'Throngos'),
      ('pashkum', 'pashkum', 'Pashkum'),
      ('lotchum', 'lochum', 'Lochum'),
      ('lotchum', 'nunemchay', 'Nunemchay'),
      ('lotchum', 'darket', 'Darket'),
      ('lotchum', 'skambo', 'Skambo'),
      ('lotchum', 'tacha', 'Tacha'),
      ('lotchum', 'karit', 'Karit'),
      ('lotchum', 'kukstay', 'Kukstay'),
      ('shargole', 'karamba', 'Karamba'),
      ('shargole', 'foker_phoo', 'Foker Phoo'),
      ('shargole', 'shargole', 'Shargole'),
      ('shargole', 'khachay', 'Khachay'),
      ('shargole', 'tingdoo', 'Tingdoo'),
      ('shargole', 'wakha', 'Wakha'),
      ('shargole', 'mulbekh', 'Mulbekh'),
      ('shakar_chiktan', 'bodh_kharboo', 'Bodh Kharboo'),
      ('shakar_chiktan', 'haniskote', 'Haniskote'),
      ('shakar_chiktan', 'shakar', 'Shakar'),
      ('shakar_chiktan', 'sanjak', 'Sanjak'),
      ('shakar_chiktan', 'chiktan', 'Chiktan'),
      ('shakar_chiktan', 'kokshow', 'Kokshow'),
      ('shakar_chiktan', 'samra', 'Samra'),
      ('shakar_chiktan', 'hagnis', 'Hagnis'),
      ('shakar_chiktan', 'youkm_kharboo', 'Youkm Kharboo'),
      ('shakar_chiktan', 'lamsu_sando', 'Lamsu-Sando'),
      ('shakar_chiktan', 'stakchay', 'Stakchay'),
      ('tsg', 'gundmangal_pore', 'Gundmangal Pore'),
      ('tsg', 'tambis', 'Tambis'),
      ('tsg', 'kanoor', 'Kanoor'),
      ('tsg', 'trespone', 'Trespone'),
      ('tsg', 'saliskore', 'Saliskore'),
      ('sankoo', 'lankarchay', 'Lankarchay'),
      ('sankoo', 'faroona', 'Faroona'),
      ('sankoo', 'umba', 'Umba'),
      ('sankoo', 'stakpa', 'Stakpa'),
      ('sankoo', 'thangdumbur', 'Thangdumbur'),
      ('sankoo', 'nakma_kussar', 'Nakma Kussar'),
      ('sankoo', 'thasgam', 'Thasgam'),
      ('sankoo', 'sangrah', 'Sangrah'),
      ('barsoo', 'kachay_khar', 'Kachay Khar'),
      ('barsoo', 'barsoo', 'Barsoo'),
      ('barsoo', 'bartoo', 'Bartoo'),
      ('barsoo', 'shargandi', 'Shargandi'),
      ('barsoo', 'itchoo', 'Itchoo'),
      ('barsoo', 'taiket_khandi', 'Taiket/Khandi'),
      ('taisuru', 'youljuk', 'Youljuk'),
      ('taisuru', 'purtichey', 'Purtichey'),
      ('taisuru', 'galing', 'Galing'),
      ('taisuru', 'karpokhar', 'Karpokhar'),
      ('taisuru', 'tia_suru', 'Tia-Suru'),
      ('taisuru', 'kargee', 'Kargee'),
      ('taisuru', 'namsuru', 'Namsuru'),
      ('taisuru', 'khows', 'Khows'),
      ('taisuru', 'khochik', 'Khochik'),
      ('taisuru', 'thulus_pursa', 'Thulus Pursa'),
      ('taisuru', 'achambor', 'Achambor'),
      ('taisuru', 'parkachik', 'Parkachik'),
      ('taisuru', 'rangdum', 'Rangdum'),
      ('taisuru', 'panikhar', 'Panikhar'),
      ('taisuru', 'printee', 'Printee'),
      ('taisuru', 'choskore', 'Choskore'),
      ('taisuru', 'tangole', 'Tangole'),
      ('karsha', 'phay', 'Phay'),
      ('karsha', 'ranthaksha', 'Ranthaksha'),
      ('karsha', 'ating', 'Ating'''),
      ('karsha', 'abran', 'Abran'),
      ('karsha', 'remala_skagam', 'Remala/Skagam'),
      ('karsha', 'hemiling', 'Hemiling'),
      ('karsha', 'akshow', 'Akshow'),
      ('karsha', 'karsha', 'Karsha'),
      ('karsha', 'lamiriging', 'Lamiriging'),
      ('karsha', 'tongri', 'Tongri'),
      ('karsha', 'tacha_khasar', 'Tacha Khasar'),
      ('zanskar', 'zangla', 'Zangla'),
      ('zanskar', 'padum', 'Padum'),
      ('zanskar', 'salapi_gapak', 'Salapi/Gapak'),
      ('zanskar', 'sani', 'Sani'),
      ('zanskar', 'upt_pipiting', 'Upt Pipiting'),
      ('zanskar', 'ruk_ruk', 'Ruk-Ruk'),
      ('zanskar', 'stongday_kumik', 'Stongday Kumik'),
      ('lungnak', 'raru_monay', 'Raru-Monay'),
      ('lungnak', 'pipcha', 'Pipcha'),
      ('lungnak', 'itcher', 'Itcher'),
      ('lungnak', 'cha', 'Cha'),
      ('lungnak', 'shun_shaday', 'Shun-Shaday'),
      ('lungnak', 'testa', 'Testa'),
      ('lungnak', 'kargak', 'Kargak')
  ) as v(block_slug, slug, name_en)
  join geo_units b on b.type = 'block' and b.slug = v.block_slug
                 and b.path <@ 'ladakh.kargil'::extensions.ltree
on conflict (parent_id, slug) do nothing;
