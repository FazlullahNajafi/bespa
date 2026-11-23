#!/usr/bin/env python3
"""Flatten the English bundle into one CSV a translator can fill in a spreadsheet.

    python scripts/i18n-export.py                 # -> i18n.csv
    python scripts/i18n-export.py --out ~/pur.csv

There is no translation platform here and for one translator there should not be: an
account, a sync step and a web UI to learn, for a job that is a list of sentences. A
spreadsheet opens on a laptop or a phone, works with no signal, and can be mailed to
somebody for review. `i18n-import.py` reads the same file back.

**One sheet, all five columns, on purpose.** Purgi is three of them — the same sentence
in Latin, Perso-Arabic and Tibetan script — so they belong side by side where they are
transliterations of each other rather than three separate jobs. Spec 09.4 #6 asked which
script Purgi should use; the answer was all three.

Columns:

    key          the dotted path, e.g. `driver.digilocker.cta` — do not edit
    english      the string as it ships — do not edit
    note         ICU plurals, interpolations, and where it appears
    ur           Urdu
    bft-Latn     Purgi, Latin transliteration
    bft-Arab     Purgi, Perso-Arabic
    bft-Tibt     Purgi, Tibetan script

Anything already translated is carried across, so re-running this after new strings land
gives a sheet with the old work still in it and the new rows empty.

**Leave a cell empty rather than guessing.** i18next falls back to English per key, so an
empty cell ships the English string — which is correct and readable. A wrong translation
is neither, and nobody will catch it.

Write the file as UTF-8 CSV. Excel will offer "CSV UTF-8 (Comma delimited)"; the plain
"CSV" option mangles Arabic and Tibetan into question marks on the way out.
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

# `{{count}}` drives the plural form; `{{name}}` and friends are substituted at render.
PLACEHOLDER = re.compile(r"\{\{(\w+)\}\}")


def flatten(node, prefix: str = "") -> dict[str, str]:
    """`{a: {b: 'x'}}` -> `{'a.b': 'x'}`, which is how a screen names it."""
    out: dict[str, str] = {}
    for key, value in node.items():
        path = f"{prefix}{key}"
        if isinstance(value, dict):
            out.update(flatten(value, f"{path}."))
        else:
            out[path] = value
    return out


def note_for(key: str, text: str) -> str:
    """What a translator needs to know about this string without opening the app."""
    parts: list[str] = []

    if key.endswith("_other"):
        parts.append("PLURAL: used when the count is not 1")
    elif f"{key}_other" in note_for.plurals:  # type: ignore[attr-defined]
        parts.append("PLURAL: used when the count is exactly 1")

    names = PLACEHOLDER.findall(text)
    if names:
        parts.append("keep {{" + "}}, {{".join(names) + "}} exactly as written")

    # The first segment of the key is the screen or module it belongs to.
    parts.append(f"in: {key.split('.')[0]}")
    return " · ".join(parts)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default="i18n.csv", help="where to write (default i18n.csv)")
    args = ap.parse_args()

    english = flatten(json.loads((I18N / "en.json").read_text(encoding="utf8")))
    note_for.plurals = set(english)  # type: ignore[attr-defined]

    existing: dict[str, dict[str, str]] = {}
    for code in TARGETS:
        path = I18N / f"{code}.json"
        existing[code] = flatten(json.loads(path.read_text(encoding="utf8"))) if path.exists() else {}

    out = Path(args.out)
    # utf-8-sig: the BOM is what tells Excel the file is UTF-8. Without it, Arabic and
    # Tibetan open as mojibake and get "fixed" by hand into something unusable.
    with out.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["key", "english", "note", *TARGETS])
        for key, text in english.items():
            writer.writerow([key, text, note_for(key, text),
                             *(existing[code].get(key, "") for code in TARGETS)])

    done = {code: sum(1 for k in english if existing[code].get(k)) for code in TARGETS}
    print(f"{out}: {len(english)} strings")
    for code in TARGETS:
        print(f"  {code:<10} {done[code]:>4} translated, {len(english) - done[code]:>4} to go")
    return 0


if __name__ == "__main__":
    sys.exit(main())
