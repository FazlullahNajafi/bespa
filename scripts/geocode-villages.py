#!/usr/bin/env python3
"""Resolve a coordinate for every seeded place, for the weather lookup.

Writes supabase/seed/003_geo_centroids.sql.

Geocoders are confidently wrong about small Ladakhi hamlets, which is the whole problem
here. Asked for these village names, Open-Meteo's top hit puts "Sangrah" in Punjab,
Pakistan and "Matayan" in New Jersey; "Padum" -- the headquarters of Zanskar -- does not
appear at all, and "Minjee" returns nothing. Accepting first results would silently give
people the weather for another country.

So every candidate must clear two gates before it is accepted:

  1. inside the Kargil bounding box below, and
  2. India, with an admin1 that looks like Ladakh / Jammu and Kashmir.

Anything else is discarded and the place is left without a coordinate. Unresolved places
fall back to their block's coordinate at query time -- coarse, but in the right valley.

Two providers are tried in order: Open-Meteo (keyless) then Nominatim (OSM, better
coverage of Indian villages, rate-limited to 1 request/second by its usage policy).

Run:  python scripts/geocode-villages.py [--limit N] [--dry-run]
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sys
import time
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
TARGET = ROOT / "supabase" / "seed" / "003_geo_centroids.sql"
SEED_002 = ROOT / "supabase" / "seed" / "002_geo_kargil_villages.sql"

# Kargil district, generously drawn: Drass in the north-west (~34.43, 75.76) down to
# Padum in Zanskar (~33.47, 76.89), east to the Leh boundary.
LAT_MIN, LAT_MAX = 33.0, 35.2
LON_MIN, LON_MAX = 75.2, 77.6

OK_ADMIN = ("ladakh", "jammu", "kashmir")
UA = "bespa-dev/0.1 (village weather lookup; contact: project maintainer)"

# Blocks need a coordinate too: they are the fallback for every village that does not
# resolve. Hand-checked against a map rather than geocoded, because getting 15 right by
# hand beats getting 15 wrong automatically.
BLOCK_COORDS = {
    "kargil": (34.5539, 76.1349),
    "drass": (34.4280, 75.7550),
    "sankoo": (34.2680, 76.0330),
    "shakar_chiktan": (34.5330, 76.6670),
    "taisuru": (34.0830, 76.1670),
    "zanskar": (33.4660, 76.8890),
    "soudh": (34.6670, 76.4170),
    "bhimbat": (34.4000, 75.9000),
    "pashkum": (34.5000, 76.2500),
    "lotchum": (33.9000, 76.9000),
    "shargole": (34.4330, 76.4500),
    "tsg": (34.5800, 76.0500),
    "barsoo": (34.3500, 76.0000),
    "karsha": (33.5100, 76.8900),
    "lungnak": (33.3000, 77.0000),
}


def get(url: str, headers: dict[str, str] | None = None):
    req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def in_box(lat: float, lon: float) -> bool:
    return LAT_MIN <= lat <= LAT_MAX and LON_MIN <= lon <= LON_MAX


def try_open_meteo(name: str):
    q = urllib.parse.quote(name)
    url = f"https://geocoding-api.open-meteo.com/v1/search?name={q}&count=10&language=en&format=json"
    try:
        data = get(url)
    except Exception:
        return None
    for r in data.get("results") or []:
        lat, lon = r.get("latitude"), r.get("longitude")
        if lat is None or lon is None or not in_box(lat, lon):
            continue
        if r.get("country_code") != "IN":
            continue
        admin = (r.get("admin1") or "").lower()
        if admin and not any(k in admin for k in OK_ADMIN):
            continue
        return (lat, lon, "open-meteo")
    return None


def try_nominatim(name: str):
    q = urllib.parse.urlencode(
        {
            "q": f"{name}, Kargil, Ladakh, India",
            "format": "json",
            "limit": "5",
            "countrycodes": "in",
            # Bias and bound the search to the district box (viewbox is lon/lat pairs).
            "viewbox": f"{LON_MIN},{LAT_MAX},{LON_MAX},{LAT_MIN}",
            "bounded": "1",
        }
    )
    try:
        data = get(f"https://nominatim.openstreetmap.org/search?{q}")
    except Exception:
        return None
    for r in data:
        try:
            lat, lon = float(r["lat"]), float(r["lon"])
        except (KeyError, ValueError):
            continue
        if in_box(lat, lon):
            return (lat, lon, "nominatim")
    return None


def places_from_seed() -> list[tuple[str, str, str]]:
    """(block_slug, slug, name) for every place in the generated seed."""
    import re

    text = SEED_002.read_text(encoding="utf-8")
    start = text.index("-- ", text.index("on conflict (parent_id, slug) do nothing;"))
    rows = re.findall(r"\('([a-z0-9_]+)', '([a-z0-9_]+)', '((?:[^']|'')*)'\)", text[start:])
    return [(b, s, n.replace("''", "'")) for b, s, n in rows]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="only process the first N places")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    places = places_from_seed()
    if args.limit:
        places = places[: args.limit]
    if not places:
        sys.exit("no places parsed from 002 — has the seed format changed?")

    print(f"resolving {len(places)} places\n")
    resolved: list[tuple[str, str, float, float, str]] = []
    unresolved: list[tuple[str, str]] = []

    for i, (block, slug, name) in enumerate(places, 1):
        hit = try_open_meteo(name)
        if not hit:
            time.sleep(1.1)  # Nominatim usage policy: max 1 request per second
            hit = try_nominatim(name)
        if hit:
            lat, lon, src = hit
            resolved.append((block, slug, lat, lon, src))
            print(f"  [{i:3}/{len(places)}] {name:<22} {lat:8.4f},{lon:8.4f}  {src}")
        else:
            unresolved.append((block, name))
            print(f"  [{i:3}/{len(places)}] {name:<22} -- no confident match")

    print(f"\nresolved {len(resolved)}/{len(places)}; {len(unresolved)} fall back to their block")
    if unresolved:
        print("unresolved: " + ", ".join(f"{n} ({b})" for b, n in unresolved[:40]))

    if args.dry_run:
        return 0

    def q(v: str) -> str:
        return "'" + v.replace("'", "''") + "'"

    out = [
        "-- Coordinates for the weather lookup (spec 03.1).",
        "--",
        "-- GENERATED by `scripts/geocode-villages.py` -- edit the script, not this file.",
        "--",
        "-- Blocks carry hand-checked coordinates; they are the fallback for any village that",
        "-- did not resolve. Village coordinates are accepted ONLY when the geocoder returned a",
        "-- point inside the Kargil bounding box in an Indian Ladakh/J&K admin area. That gate",
        "-- matters: asked for these names, geocoders place \"Sangrah\" in Punjab, Pakistan and",
        "-- \"Matayan\" in New Jersey. A wrong coordinate here is a wrong forecast for a real",
        "-- village, so an unresolved place is left null and uses its block instead.",
        f"-- {len(resolved)} of {len(places)} places resolved at generation time.",
        "",
        "set search_path = public, extensions;",
        "",
        "-- Block coordinates (hand-checked).",
    ]
    for slug, (lat, lon) in BLOCK_COORDS.items():
        out.append(
            "update geo_units set centroid = extensions.st_point"
            f"({lon}, {lat})::geography where type = 'block' and slug = {q(slug)};"
        )

    if resolved:
        out += ["", f"-- {len(resolved)} geocoded places."]
        out.append("update geo_units v set centroid = extensions.st_point(c.lon, c.lat)::geography")
        out.append("  from (values")
        out.append(
            ",\n".join(
                f"      ({q(b)}, {q(s)}, {lon}::double precision, {lat}::double precision)"
                for b, s, lat, lon, _ in resolved
            )
        )
        out.append("  ) as c(block_slug, slug, lon, lat)")
        out.append("  join geo_units b on b.type = 'block' and b.slug = c.block_slug")
        out.append(" where v.slug = c.slug and v.parent_id = b.id;")

    out.append("")
    TARGET.write_text("\n".join(out), encoding="utf-8", newline="\n")
    print(f"\nwrote {TARGET.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
