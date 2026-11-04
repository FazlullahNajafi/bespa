import type { IconName } from '@/components/icon';
import type { PlaceCategory } from '@/api/places';

/**
 * A glyph for each of spec 03.2's twelve categories.
 *
 * Spec 08.6 asks for an icon *and* a word for every category, for readers who do not read
 * English — which only helps if the icon is right. On a row of filter chips the icon is
 * what gets scanned, so two categories drawn alike are worse than no icons at all; nine
 * of these are drawings of their own, added to `scripts/gen-icons.py`.
 *
 * The three religious categories are three different kinds of building here and the
 * distinction is not a nicety: a mosque, an imambargah and a khanqah are drawn from what
 * a resident would point at — the dome between minarets, the alam on its pole, the tiered
 * wooden spire.
 *
 * The map lives apart from `PLACE_CATEGORIES` so the enum stays the server's list and
 * this stays a presentation choice.
 */
const ICONS: Record<PlaceCategory, IconName> = {
  school: 'book',
  hospital: 'hospital',
  mosque: 'mosque',
  imambargah: 'imambargah',
  khanqah: 'khanqah',
  government_office: 'office',
  bank_atm: 'bank',
  water_point: 'water',
  // The designer's own glyph. Kargil's tourist places are the Suru valley, Mulbekh and
  // the Zanskar road — a mountain is not a stand-in for them, it is what they are.
  tourist: 'mountain',
  market: 'market',
  sports: 'sports',
  other: 'pin',
};

export function categoryIcon(category: PlaceCategory): IconName {
  return ICONS[category];
}
