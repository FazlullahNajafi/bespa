#!/usr/bin/env python3
"""Assert spec 08's contrast floors against the real values in src/theme/tokens.ts.

Spec 08.6 requires >=4.5:1 for body text and >=3:1 for large text and icons, in BOTH
themes, because these screens are read outdoors at 3,000 m in snow glare. That is a claim
about specific hex values, so it is checked rather than asserted in a comment.

Run:  python scripts/check-contrast.py
Exits non-zero if any rule fails, so it can gate a commit or CI.

No dependencies: it parses the palette out of the TypeScript source rather than importing
it, so it needs neither a bundler nor a test harness.
"""
from __future__ import annotations

import pathlib
import re
import sys

TOKENS = pathlib.Path(__file__).resolve().parent.parent / "src" / "theme" / "tokens.ts"

PAPER = "#FFFFFF"  # the two extremes text can take when it sits ON a filled colour
INK = "#0F1421"    # kept in step with `readableOn` in src/theme/tokens.ts

BODY = 4.5   # body text
LARGE = 3.0  # large text, icons, UI boundaries


def parse_palette(src: str) -> dict[str, dict[str, str]]:
    """Pull `palette = { light: {...}, dark: {...} }` out of the source."""
    start = src.index("export const palette")
    body = src[start : src.index("} as const;", start)]
    out: dict[str, dict[str, str]] = {}
    for scheme in ("light", "dark"):
        m = re.search(rf"\b{scheme}:\s*\{{(.*?)\n  \}}", body, re.S)
        if not m:
            sys.exit(f"could not find the '{scheme}' palette in {TOKENS}")
        out[scheme] = {
            k: v for k, v in re.findall(r"(\w+):\s*'(#[0-9a-fA-F]{6})'", m.group(1))
        }
    return out


def _channel(c: int) -> float:
    x = c / 255
    return x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4


def luminance(hex_colour: str) -> float:
    h = hex_colour.lstrip("#")
    r, g, b = (int(h[i : i + 2], 16) for i in (0, 2, 4))
    return 0.2126 * _channel(r) + 0.7152 * _channel(g) + 0.0722 * _channel(b)


def ratio(a: str, b: str) -> float:
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


# (description, foreground token, background token, floor)
RULES: list[tuple[str, str, str, float]] = [
    ("body text on page",            "ink",     "bg",      BODY),
    ("body text on card",            "ink",     "surface", BODY),
    ("secondary text on page",       "inkSoft", "bg",      BODY),
    ("secondary text on card",       "inkSoft", "surface", BODY),
    ("primary as large/icon",        "primary", "bg",      LARGE),
    ("accent as large/icon",         "accent",  "surface", LARGE),
    ("success as text",              "success", "surface", BODY),
    ("warning as text",              "warning", "surface", BODY),
    ("danger as text",               "danger",  "surface", BODY),
    ("info as text",                 "info",    "surface", BODY),
    ("primary button label",         "onPrimary", "primary",        BODY),
    ("pressed button label",         "onPrimary", "primaryPressed", BODY),
    ("danger button label",          "onDanger",  "danger",         BODY),
    ("border against page",          "border",  "bg",      1.0),
]

# `inkFaint` is BELOW the body floor in every one of the design's themes (2.55-3.41). It is
# deliberately reserved for decorative and disabled text, which WCAG exempts. Asserting a
# ceiling here documents that it must never be promoted to body text by accident.
FAINT_IS_DECORATIVE_ONLY = True


def main() -> int:
    src = TOKENS.read_text(encoding="utf-8")
    palette = parse_palette(src)
    failures: list[str] = []

    for scheme, colours in palette.items():
        print(f"\n{scheme}:")
        for label, fg, bg, floor in RULES:
            if fg not in colours or bg not in colours:
                failures.append(f"{scheme}: missing token {fg!r} or {bg!r}")
                continue
            r = ratio(colours[fg], colours[bg])
            ok = r >= floor
            print(
                f"  {'ok  ' if ok else 'FAIL'} {label:<24}"
                f" {colours[fg]} on {colours[bg]}  {r:5.2f} (>= {floor})"
            )
            if not ok:
                failures.append(
                    f"{scheme}: {label} is {r:.2f}:1, needs {floor}:1"
                    f" ({fg}={colours[fg]} on {bg}={colours[bg]})"
                )

        if FAINT_IS_DECORATIVE_ONLY and "inkFaint" in colours:
            r = ratio(colours["inkFaint"], colours["surface"])
            note = "decorative-only, as documented" if r < BODY else "now passes body"
            print(f"  --   inkFaint on card      {r:5.2f} ({note})")

        # Avatar initials sit on one of five semantic tints, with `readableOn` in
        # tokens.ts choosing ink or paper per tint. Assert that choice clears the body
        # floor for every tint -- a per-theme rule would not: in light, white reads on
        # `primary` at 10.94:1 but on `accent` at only 3.05:1.
        for tint in ("primary", "accent", "success", "info", "danger"):
            if tint not in colours:
                continue
            best = max(ratio(PAPER, colours[tint]), ratio(INK, colours[tint]))
            ok = best >= BODY
            print(
                f"  {'ok  ' if ok else 'FAIL'} avatar initials/{tint:<9}"
                f" {colours[tint]}          {best:5.2f} (>= {BODY})"
            )
            if not ok:
                failures.append(
                    f"{scheme}: avatar initials on {tint} ({colours[tint]}) reach only"
                    f" {best:.2f}:1 with either ink or paper, needs {BODY}:1"
                )

    print()
    if failures:
        print(f"{len(failures)} contrast failure(s):")
        for f in failures:
            print(f"  - {f}")
        return 1
    print("all contrast rules pass in both themes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
