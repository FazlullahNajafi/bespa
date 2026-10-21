-- Correct the official source's identity (spec 03.5, 09.4 #2).
--
-- The mirror was seeded as 'lahdc' / "LAHDC Kargil". That is the wrong body. LAHDC is the
-- elected Hill Development Council; `kargil.nic.in` is the District Administration of
-- Kargil, UT Ladakh — the NIC-hosted district portal — and the notices mirrored from it
-- are the administration's, not the Council's. Attributing a government notice to the
-- wrong institution is exactly the kind of error that makes an unsponsored index
-- indefensible, so the key is corrected as well as the label: a reader never sees the
-- key, but the next person to add a source reads it.
--
-- The FK on `notices.source` has no ON UPDATE CASCADE, so the row is inserted, the
-- notices are repointed, and the old row is dropped — in that order, inside one
-- transaction, so nothing ever references a missing source.

set search_path = public, extensions;

insert into notice_sources (key, label, homepage_url, enabled, disclaimer) values
  ('district_kargil', 'District Administration, Kargil', 'https://kargil.nic.in/', true,
   'Mirrored from kargil.nic.in. Bespa links to the original documents and is not a government service.')
on conflict (key) do update
  set label        = excluded.label,
      homepage_url = excluded.homepage_url,
      disclaimer   = excluded.disclaimer;

update notices set source = 'district_kargil' where source = 'lahdc';

delete from notice_sources where key = 'lahdc';
