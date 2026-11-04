#!/usr/bin/env python3
"""Generate src/components/icon.tsx from the design's line-icon set.

The design (`design/bespa_design/design-system.jsx`) draws its icons as inline SVG. Path
data is exactly the kind of thing that degrades when retyped, so it is copied across
mechanically. Re-run this after pulling a new export:

    python scripts/gen-icons.py

Only <path>, <circle> and <rect> appear in the source, and every attribute used
(d/cx/cy/r/x/y/width/height/rx) has the same name in react-native-svg, so the conversion
is a tag rename.
"""
from __future__ import annotations

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / "design" / "bespa_design" / "design-system.jsx"
TARGET = ROOT / "src" / "components" / "icon.tsx"

# Spec 08's `seatState` names three glyphs the design set does not carry. Drawn to match:
# same 24x24 box, same 1.7 stroke, same round caps.
# Redraws of imported glyphs. The design's own `car` is a closed trapezoid with two short
# verticals and two wheels -- a cabin roof floating above the wheels, with no lower body,
# which reads as half a vehicle at tab-bar size. Replaced with a full silhouette: roofline,
# beltline, body sides, wheels on the ground. Shape matters more here than elsewhere,
# because Transport is a tab icon seen at 22px.
OVERRIDE = {
    "car": '<><Path d="M4 16.5v-4l2-4.5h12l2 4.5v4" {...p}/>'
           '<Path d="M4 12.5h16" {...p}/>'
           '<Circle cx="7.8" cy="16.5" r="1.7" {...p}/>'
           '<Circle cx="16.2" cy="16.5" r="1.7" {...p}/></>',
}

EXTRA = {
    # Weather conditions (spec 03.1). The design set has `sun` and `cloud` but nothing for
    # precipitation, which will not do for a district where snow decides whether the road
    # to Drass is open.
    "rain": '<><Path d="M7 15.5a3.6 3.6 0 0 1 .5-7.2 5 5 0 0 1 9.6 1 3 3 0 0 1 .4 6" {...p}/>'
            '<Path d="M9 18.5l-1 2M13 18.5l-1 2M17 18.5l-1 2" {...p}/></>',
    "snow": '<><Path d="M7 14.5a3.6 3.6 0 0 1 .5-7.2 5 5 0 0 1 9.6 1 3 3 0 0 1 .4 6" {...p}/>'
            '<Path d="M9 18v2.5M7.8 18.7l2.4 1.1M10.2 18.7l-2.4 1.1" {...p}/>'
            '<Path d="M15 18v2.5M13.8 18.7l2.4 1.1M16.2 18.7l-2.4 1.1" {...p}/></>',
    "circle-outline": '<><Circle cx="12" cy="12" r="7.5" {...p}/></>',
    "check": '<><Path d="M5 12.5l4.5 4.5L19 7.5" {...p}/></>',
    "lock": '<><Rect x="5.5" y="10.5" width="13" height="9" rx="2" {...p}/>'
            '<Path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" {...p}/></>',
    # A town, which the design set has no glyph for: it draws rural places and the app
    # drew both with `home`. A village and the district headquarters cannot share a
    # picture in a list that holds both (spec 08.6 — the icon has to do work, not sit
    # beside the word). Two blocks of different heights with windows, against `home`'s
    # single pitched roof.
    "town": '<><Path d="M4 20V11l5-3v12" {...p}/>'
            '<Path d="M9 20V7.5l6.5-3.5V20" {...p}/>'
            '<Path d="M15.5 20v-7l4.5 2v5" {...p}/>'
            '<Path d="M3 20h18" {...p}/>'
            '<Path d="M12 9.5v1.5M12 14v1.5" {...p}/></>',
    # Two glyphs for the occupation grid (spec 03.6, design `screens-profile.jsx`). The
    # design's own grid reused existing icons because its list was eleven generic roles;
    # the spec's list is fourteen specific ones, and an Islamic scholar drawn as a
    # crescent or a contractor drawn as a cog is the kind of near-miss that makes a
    # low-literacy grid harder to read than no icons at all (spec 08.6 asks for icon AND
    # word, which only helps when the icon is right).
    "book": '<><Path d="M12 7v12" {...p}/>'
            '<Path d="M12 7c-1.8-1.4-4.1-2.1-6.6-2.1v12c2.5 0 4.8.7 6.6 2.1" {...p}/>'
            '<Path d="M12 7c1.8-1.4 4.1-2.1 6.6-2.1v12c-2.5 0-4.8.7-6.6 2.1" {...p}/></>',
    "bricks": '<><Rect x="4" y="7.5" width="16" height="9.5" rx="1.6" {...p}/>'
              '<Path d="M4 12.25h16M9.3 7.5v4.75M14.7 12.25V17" {...p}/></>',
    # Android's share glyph -- three dots joined by two lines. The design set has `send`
    # (a paper plane), which was used first and read as "send a message to someone"
    # rather than "pass this on". The platform's own shape is the one people recognise,
    # and this action opens the platform's own share sheet. Dots at r=2.4; the lines stop
    # on the circles rather than at their centres, or the strokes show through them.
    "share": '<><Circle cx="6" cy="12" r="2.4" {...p}/>'
             '<Circle cx="17" cy="6" r="2.4" {...p}/>'
             '<Circle cx="17" cy="18" r="2.4" {...p}/>'
             '<Path d="M8.1 10.9l6.8-3.8M8.1 13.1l6.8 3.8" {...p}/></>',
    # ---------------------------------------------------------------------------
    # Place categories (spec 03.2). Nine of the twelve needed a glyph of their own.
    #
    # Spec 08.6 asks for an icon *and* a word, which only helps when the icon is right:
    # on a filter chip row the icon is what a reader who does not read English scans, so
    # two categories drawn the same are worse than no icons. `school` reuses `book`,
    # `tourist` reuses `mountain` and `other` reuses `pin`; the rest are below.
    #
    # The three religious categories are the ones that had to be got right rather than
    # approximated, because in Kargil they are three different kinds of building and the
    # distinction is not a detail. Each is drawn from the feature a resident would point
    # at: a mosque's dome between two minarets, an imambargah's alam on its pole above
    # the hall, a khanqah's tiered wooden spire.
    "mosque": '<><Path d="M3.5 20h17" {...p}/>'
              '<Path d="M6 20v-9.8M18 20v-9.8" {...p}/>'
              '<Path d="M6 10.2V8.8M18 10.2V8.8" {...p}/>'
              '<Path d="M8.5 20v-4.6c0-2 1.6-3.6 3.5-3.6s3.5 1.6 3.5 3.6V20" {...p}/>'
              '<Path d="M12 11.8V9.3" {...p}/></>',
    "imambargah": '<><Path d="M3.5 20h17" {...p}/>'
                  '<Rect x="5" y="11.5" width="14" height="8.5" rx="1.4" {...p}/>'
                  '<Path d="M12 11.5V4.5" {...p}/>'
                  '<Path d="M12 5h4.5l-1.6 1.9L16.5 8.8H12" {...p}/></>',
    "khanqah": '<><Path d="M3.5 20h17" {...p}/>'
               '<Path d="M12 3.5l4.5 4.3h-9L12 3.5z" {...p}/>'
               '<Path d="M12 7.8l7 5.2H5l7-5.2z" {...p}/>'
               '<Path d="M7.5 13v7h9v-7" {...p}/></>',
    # A building with a cross. The red-cross glyph alone reads as first aid; a hospital
    # here is a building people walk to.
    "hospital": '<><Rect x="4.5" y="7" width="15" height="13" rx="2" {...p}/>'
                '<Path d="M12 10.5v6M9 13.5h6" {...p}/></>',
    # The civic building: pediment over columns. This is the shape a bank usually gets as
    # well, which is why `bank` below is a rupee instead -- the two must not collide.
    "office": '<><Path d="M3.5 20h17" {...p}/>'
              '<Path d="M4 10.5l8-4.5 8 4.5H4z" {...p}/>'
              '<Path d="M6.5 10.5V20M10 10.5V20M14 10.5V20M17.5 10.5V20" {...p}/></>',
    "bank": '<><Rect x="4.5" y="5" width="15" height="14" rx="2" {...p}/>'
            '<Path d="M9.5 8.8h5M9.5 11.1h5" {...p}/>'
            '<Path d="M9.8 8.8c3 0 3.5 4.6-.3 4.6h1.1l3.4 3.2" {...p}/></>',
    # A droplet, not a tap. A water point in a Ladakhi village is as often a spring or a
    # standpipe as a fitted tap, and the droplet covers all three.
    "water": '<><Path d="M12 3.8c0 0 5.2 5.9 5.2 9.3a5.2 5.2 0 0 1-10.4 0c0-3.4 5.2-9.3 5.2-9.3z" {...p}/></>',
    # A shop under its awning -- the shape of every storefront on the Kargil main bazaar.
    "market": '<><Path d="M3.5 20h17" {...p}/>'
              '<Path d="M4 9.5l1.5-3.5h13L20 9.5H4z" {...p}/>'
              '<Path d="M5.5 9.5V20h13V9.5" {...p}/>'
              '<Path d="M9.5 20v-5h5v5" {...p}/></>',
    "sports": '<><Circle cx="12" cy="12" r="7.5" {...p}/>'
              '<Path d="M4.8 9.8c4.2 1.3 10.2 1.3 14.4 0" {...p}/>'
              '<Path d="M12 4.6c-2.6 4.5-2.6 10.3 0 14.8" {...p}/></>',
}

HEADER = '''import type { ComponentProps } from 'react';
import { View, type ColorValue } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * The design's line-icon set (`design/bespa_design/design-system.jsx`), ported to
 * react-native-svg.
 *
 * GENERATED by `scripts/gen-icons.py` — edit that, not this. The path data is copied
 * mechanically so the drawings are the designer's exactly.
 *
 * Three glyphs are additions, not imports: spec 08's `seatState` names `circle-outline`,
 * `check` and `lock`, which the design set does not carry. They are drawn to match.
 *
 * The set is deliberately stroke-only and inherits no colour: React Native has no
 * `currentColor`, so callers pass `color` explicitly.
 */

type IconProps = {
  name: IconName;
  size?: number;
  /**
   * Required: there is no `currentColor` in React Native.
   *
   * `ColorValue` rather than `string` so a caller can pass React Navigation's tab tint or
   * a `PlatformColor` straight through; both are opaque objects, not strings.
   */
  color: ColorValue;
  strokeWidth?: number;
  /**
   * Leave unset for the common case. Spec 08.6 pairs every category icon with a word, so
   * the icon is usually decorative and announcing it would just repeat the adjacent label.
   * Set it only when an icon carries meaning no nearby text does.
   */
  label?: string;
};

type Stroke = Pick<
  ComponentProps<typeof Path>,
  'fill' | 'stroke' | 'strokeWidth' | 'strokeLinecap' | 'strokeLinejoin'
>;

const paths = (p: Stroke) => ({
'''

FOOTER = '''});

export type IconName = keyof ReturnType<typeof paths>;

export function Icon({ name, size = 22, color, strokeWidth = 1.7, label }: IconProps) {
  const p: Stroke = {
    fill: 'none',
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };

  // `aria-hidden`, not `accessibilityElementsHidden`/`importantForAccessibility`: this
  // version of react-native-web forwards those two to the DOM, where React warns about
  // them as unknown attributes. `aria-hidden` is understood on web and mapped to the
  // native equivalents by React Native.
  return (
    <View
      accessibilityRole={label ? 'image' : undefined}
      accessibilityLabel={label}
      // Decorative by default, so a screen reader does not read the icon and then the
      // word beside it that says the same thing.
      aria-hidden={label ? undefined : true}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {paths(p)[name]}
      </Svg>
    </View>
  );
}
'''


def to_rn(jsx: str) -> str:
    for a, b in (("<path", "<Path"), ("<circle", "<Circle"), ("<rect", "<Rect")):
        jsx = jsx.replace(a, b)
    return jsx


def main() -> int:
    if not SOURCE.exists():
        sys.exit(f"design source missing: {SOURCE}")
    src = SOURCE.read_text(encoding="utf-8")

    anchor = "  const paths = {"
    block = src[src.index(anchor) : src.index("\n  };", src.index(anchor))]
    entries = re.findall(r"\n    (\w+):\s*(<>.*?</>),", block, re.S)
    if not entries:
        sys.exit("no icons parsed — has the design's Icon component changed shape?")

    unsupported = set(re.findall(r"<(\w+)\s", block)) - {"path", "circle", "rect"}
    if unsupported:
        sys.exit(f"unsupported SVG elements in the source: {sorted(unsupported)}")

    lines = []
    overridden = 0
    for name, jsx in entries:
        key = name if re.fullmatch(r"[A-Za-z_$][\w$]*", name) else f"'{name}'"
        if name in OVERRIDE:
            lines.append(f"  {key}: ({OVERRIDE[name]}),")
            overridden += 1
        else:
            lines.append(f"  {key}: ({to_rn(jsx.strip())}),")
    for name, jsx in EXTRA.items():
        lines.append(f"  '{name}': ({jsx}),")

    TARGET.write_text(HEADER + "\n".join(lines) + "\n" + FOOTER, encoding="utf-8", newline="\n")
    print(
        f"wrote {TARGET.relative_to(ROOT)}: {len(entries)} imported "
        f"({overridden} redrawn) + {len(EXTRA)} added"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
