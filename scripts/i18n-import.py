#!/usr/bin/env python3
"""Read the filled CSV back into the locale bundles.

    python scripts/i18n-import.py i18n.csv
    python scripts/i18n-import.py i18n.csv --only ur
    python scripts/i18n-import.py i18n.csv --dry-run

Writes `src/i18n/{ur,bft-Latn,bft-Arab,bft-Tibt}.json`, nested the same way `en.json` is,
so a bundle is a drop-in for the English one. `en.json` is never written: English is the
source, and the CSV's `english` column is there to translate from, not to edit.

Three rules, each because of a specific way this goes wrong:

  * **An empty cell is not an empty string.** It is left out of the bundle entirely, so
    i18next falls back to English for that key. Writing `""` would ship a blank label.
  * **A key that is not in `en.json` is refused**, not written. It means a renamed key or
    a sheet that has drifted from the app, and the string would be dead weight nobody
    ever sees.
  * **A missing placeholder is refused.** `{{count}}` dropped from a translation renders
    "seats available" with no number, which looks deliberate and is unreadable. The row
    is named and nothing is written until it is fixed.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path

I18N = Path(__file__).resolve().parent.parent / "src" / "i18n"
TARGETS = ["ur", "bft-Latn", "bft-Arab", "bft-Tibt"]
PLACEHOLDER = re.compile(r"\{\{(\w+)\}\}")


def flatten(node, prefix: str = "") -> dict[str, str]:
    out: dict[str, str] = {}
    for key, value in node.items():
        path = f"{prefix}{key}"
        if isinstance(value, dict):
            out.update(flatten(value, f"{path}."))
        else:
            out[path] = value
    return out


def nest(flat: dict[str, str]) -> dict:
    """`{'a.b': 'x'}` -> `{a: {b: 'x'}}`, matching the shape of `en.json`."""
    root: dict = {}
    for key, value in flat.items():
        node = root
        parts = key.split(".")
        for part in parts[:-1]:
            node = node.setdefault(part, {})
        node[parts[-1]] = value
    return root


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("csv_path", help="the filled sheet")
    ap.add_argument("--only", action="append", choices=TARGETS,
                    help="import one locale; repeatable")
    ap.add_argument("--dry-run", action="store_true", help="report, write nothing")
    args = ap.parse_args()

    english = flatten(json.loads((I18N / "en.json").read_text(encoding="utf8")))
    wanted = args.only or TARGETS

    # utf-8-sig strips the BOM Excel writes, and is harmless on a file without one.
    with open(args.csv_path, encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))

    if not rows or "key" not in rows[0]:
        print("that file has no `key` column — is it the sheet i18n-export.py wrote?",
              file=sys.stderr)
        return 2

    collected: dict[str, dict[str, str]] = {code: {} for code in wanted}
    problems: list[str] = []

    for line, row in enumerate(rows, start=2):
        key = (row.get("key") or "").strip()
        if not key:
            continue
        if key not in english:
            problems.append(f"line {line}: `{key}` is not in en.json — renamed or stale")
            continue

        expected = set(PLACEHOLDER.findall(english[key]))
        for code in wanted:
            text = (row.get(code) or "").strip()
            if not text:
                continue  # left blank on purpose: falls back to English
            missing = expected - set(PLACEHOLDER.findall(text))
            if missing:
                problems.append(
                    f"line {line}: {code} `{key}` drops "
                    + ", ".join("{{" + m + "}}" for m in sorted(missing)))
                continue
            collected[code][key] = text

    if problems:
        print(f"{len(problems)} problem(s); nothing written:\n", file=sys.stderr)
        for problem in problems:
            print("  " + problem, file=sys.stderr)
        return 1

    for code in wanted:
        flat = collected[code]
        path = I18N / f"{code}.json"
        covered = f"{len(flat)}/{len(english)}"
        if args.dry_run:
            print(f"{path.name}: would write {covered}")
            continue
        path.write_text(json.dumps(nest(flat), indent=2, ensure_ascii=False) + "\n",
                        encoding="utf8")
        print(f"{path.name}: {covered}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
