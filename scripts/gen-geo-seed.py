#!/usr/bin/env python3
"""Generate supabase/seed/002_geo_kargil_villages.sql from the district spreadsheet.

Source: "List of Panchayat and Revenue Vilages.xlsx", which lists two INDEPENDENT columns
per block -- existing Panchayats and existing Revenue Villages, each with its own Sr. No.
They are parallel lists, not a hierarchy: the counts differ per block and rows carry one
without the other. Villages therefore hang off the BLOCK, matching spec 06's path shape.

Run:  python scripts/gen-geo-seed.py  [--xlsx PATH]
Then: npm run db:reset

Block boundaries come from the Sr. No columns restarting at 1, not from the block label,
which in the sheet is sometimes typed a couple of rows late (Tai-Suru).
"""
from __future__ import annotations

import argparse
import io
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
TARGET = ROOT / "supabase" / "seed" / "002_geo_kargil_villages.sql"
DEFAULT_XLSX = pathlib.Path.home() / "Downloads" / "List of Panchayat and Revenue Vilages.xlsx"

# Sheet block label -> (slug, display name). The first six already exist in 001 with
# hand-checked names; their slugs are reused so nothing is duplicated.
BLOCKS = {
    "KARGIL": ("kargil", "Kargil"),
    "SANKOO": ("sankoo", "Sankoo"),
    "DRASS": ("drass", "Drass"),
    "SH-CHIKTAN": ("shakar_chiktan", "Shakar-Chiktan"),
    "TAI-SURU": ("taisuru", "Taisuru"),
    "ZANSKAR": ("zanskar", "Zanskar"),
    "SOUDH": ("soudh", "Soudh"),
    "BHIMBAT": ("bhimbat", "Bhimbat"),
    "PASHKUM": ("pashkum", "Pashkum"),
    "LOTCHUM": ("lotchum", "Lotchum"),
    "SHARGOLE": ("shargole", "Shargole"),
    "TSG": ("tsg", "TSG"),
    "BARSOO": ("barsoo", "Barsoo"),
    "KARSHA": ("karsha", "Karsha"),
    "LUNGNAK": ("lungnak", "Lungnak"),
}
IN_001 = {"kargil", "sankoo", "drass", "shakar_chiktan", "taisuru", "zanskar"}

# Panchayat names that are real settlements in their own right and are NOT already in the
# village column. Chosen by the user from the candidate list, not derived: the mechanical
# rule (any non-A/B panchayat missing from the village column) yields 14, but 7 of those
# are spelling variants of villages already seeded -- Mushkoo/Muskoo, Goshen/Goshan,
# Chutichan/Chulichan, Lalung/Lalong, Karkitchu/Karkit, Trongion/Tronjon,
# Drass-Rimbir Pora/Rambirpora -- and 4 more are the first word of an existing compound
# name (Taiket, Salapi, Stongday, Stakchay Khangral). Seeding those would list one village
# twice under two spellings and split its directory across two tenancies.
#
# A/B panchayats (Choskore-A/B, Tambis-A/B, ...) are administrative splits of a single
# settlement and are never seeded.
PANCHAYAT_SETTLEMENTS = {
    "KARGIL": ["GONGMA MINJEE", "CHANIGUND", "BADGAM"],
}


def slugify(name: str) -> str:
    return re.sub(r"_+", "_", re.sub(r"[^a-z0-9]+", "_", name.lower())).strip("_")


def q(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def parse(xlsx: pathlib.Path):
    try:
        import pandas as pd
    except ImportError:
        sys.exit("pandas is required: pip install pandas openpyxl")

    frame = pd.read_excel(xlsx, sheet_name="Sheet1", header=None).iloc[5:]
    frame.columns = [
        "district", "subdiv", "block", "p_sr", "panchayat", "spacer", "v_sr", "village",
    ]

    def text(x):
        return "" if pd.isna(x) else str(x).strip()

    def number(x):
        try:
            return int(float(x))
        except (TypeError, ValueError):
            return None

    segments, current = [], None
    for idx in frame.index:
        row = frame.loc[idx]
        v_sr, p_sr = number(row["v_sr"]), number(row["p_sr"])
        starts_block = (v_sr == 1 or p_sr == 1) and (
            current is None or current["max_v"] > 1 or current["max_p"] > 1
        )
        if starts_block:
            current = {"label": None, "villages": [], "max_v": 0, "max_p": 0}
            segments.append(current)
        if current is None:
            continue
        if text(row["block"]):
            current["label"] = text(row["block"])
        if text(row["village"]):
            current["villages"].append(text(row["village"]))
        if v_sr:
            current["max_v"] = max(current["max_v"], v_sr)
        if p_sr:
            current["max_p"] = max(current["max_p"], p_sr)

    unknown = {s["label"] for s in segments} - set(BLOCKS)
    if unknown:
        sys.exit(f"unrecognised block label(s) in the sheet: {sorted(unknown)}")
    return segments


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--xlsx", type=pathlib.Path, default=DEFAULT_XLSX)
    args = ap.parse_args()
    if not args.xlsx.exists():
        sys.exit(f"spreadsheet not found: {args.xlsx}")

    segments = parse(args.xlsx)
    new_blocks = [BLOCKS[s["label"]] for s in segments if BLOCKS[s["label"]][0] not in IN_001]

    rows, from_panchayat = [], 0
    for seg in segments:
        block_slug = BLOCKS[seg["label"]][0]
        seen = set()
        for name in seg["villages"] + PANCHAYAT_SETTLEMENTS.get(seg["label"], []):
            slug = slugify(name)
            if slug in seen:
                sys.exit(f"duplicate slug {slug!r} within block {seg['label']}")
            seen.add(slug)
            rows.append((block_slug, slug, name.title()))
        from_panchayat += len(PANCHAYAT_SETTLEMENTS.get(seg["label"], []))

    out = io.StringIO()
    out.write(f"""-- Revenue villages of Kargil district, and the nine blocks 001 did not carry.
--
-- GENERATED by `scripts/gen-geo-seed.py` from the district administration's
-- "List of Panchayat and Revenue Vilages.xlsx" -- edit the script, not this file.
--
-- The sheet lists, per block, two INDEPENDENT columns: existing Panchayats and existing
-- Revenue Villages, each with its own Sr. No. They are parallel lists, not a hierarchy --
-- the counts differ per block (Tai-Suru: 9 panchayats, 17 villages) and rows carry one
-- without the other. Villages therefore hang off the BLOCK, matching the path in spec 06
-- (`ladakh.kargil.sankoo.minjee`).
--
-- {from_panchayat} entries come from the PANCHAYAT column rather than the village column: settlements
-- residents name as home that the revenue list does not carry separately. They are typed
-- `village` because `village_id` is the tenancy key and they are a tenancy, not because
-- they are revenue villages. A/B panchayats are administrative splits of one settlement
-- and are never seeded. See the script for why most panchayat names are excluded.
--
-- Block boundaries are taken from the Sr. No columns restarting at 1, not from the block
-- label, which in the sheet is sometimes typed a couple of rows late (Tai-Suru).
--
-- The sheet's SUB DIVISION level is not represented: geo_type has no such member and the
-- onboarding picker goes ut -> district -> block -> village.
--
-- Urdu and Purgi names are absent from the source and stay null rather than guessed.
-- lgd_code likewise: this sheet carries no LGD codes.

set search_path = public, extensions;

-- The nine blocks missing from 001.
insert into geo_units (type, parent_id, slug, name_en)
select 'block', d.id, b.slug, b.name_en
  from (values
""")
    out.write(",\n".join(f"      ({q(s)}, {q(n)})" for s, n in new_blocks))
    out.write("""
  ) as b(slug, name_en)
  join geo_units d on d.path = 'ladakh.kargil'::extensions.ltree
on conflict (parent_id, slug) do nothing;

""")
    out.write(f"-- {len(rows)} places across {len(segments)} blocks.\n")
    out.write("insert into geo_units (type, parent_id, slug, name_en)\nselect 'village', b.id, v.slug, v.name_en\n  from (values\n")
    out.write(",\n".join(f"      ({q(b)}, {q(s)}, {q(n)})" for b, s, n in rows))
    out.write("""
  ) as v(block_slug, slug, name_en)
  join geo_units b on b.type = 'block' and b.slug = v.block_slug
                 and b.path <@ 'ladakh.kargil'::extensions.ltree
on conflict (parent_id, slug) do nothing;
""")

    TARGET.write_text(out.getvalue(), encoding="utf-8", newline="\n")
    print(
        f"wrote {TARGET.relative_to(ROOT)}: {len(new_blocks)} blocks, {len(rows)} places "
        f"({from_panchayat} from the panchayat column)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
