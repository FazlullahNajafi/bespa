/**
 * The occupation list from spec 03.6, in the spec's order.
 *
 * Stored as these stable keys rather than as display text, so a profile written in
 * English still reads as "ཞིང་པ" / "کسان" when the Purgi and Urdu bundles land. The
 * column stays `text` rather than becoming an enum: spec 03.6 ends the list with "other +
 * free text", and an enum cannot hold the free text.
 *
 * Which is also how a stored value is read back — `labelFor` translates anything in this
 * list and shows anything else verbatim, because anything else *is* the user's own words.
 */
export const OCCUPATIONS = [
  'student',
  'farmer',
  'teacher',
  'shopkeeper',
  'local_trader',
  'hotel_owner',
  'driver',
  'islamic_scholar',
  'transport_operator',
  'government_employee',
  'health_worker',
  'engineer',
  'contractor',
  'digital_creator',
] as const;

export type Occupation = (typeof OCCUPATIONS)[number];

export function isKnownOccupation(value: string): value is Occupation {
  return (OCCUPATIONS as readonly string[]).includes(value);
}

/**
 * `t` is passed in rather than imported, because this runs inside components that already
 * hold one and in tests that hold none.
 */
export function labelFor(value: string | null, t: (key: string) => string): string | null {
  if (!value) return null;
  return isKnownOccupation(value) ? t(`profile.occupations.${value}`) : value;
}
