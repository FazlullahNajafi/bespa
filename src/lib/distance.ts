/**
 * "How far away is it" (spec 03.2), computed on the phone.
 *
 * The server could answer this — PostGIS is right there, and `places_near` already uses
 * it — but it would have to answer it per row, per render, keyed by a coordinate that
 * changes every time someone walks down the road. That turns a scrollable list into a
 * query. The arithmetic below is a dozen multiplications and runs on a cached list with
 * no connection at all, which is the case spec 02.3 is written for.
 *
 * Haversine on a spherical earth, not Vincenty on an ellipsoid. The error is about 0.3%,
 * which over the 2 km that separates one end of a Kargil village from the other is six
 * metres — and the number is rendered as "1.2 km" or "400 m" anyway. The far bigger
 * error is the GPS fix itself.
 */

const EARTH_RADIUS_M = 6_371_000;

export type Point = { lat: number; lon: number };

const toRad = (degrees: number) => (degrees * Math.PI) / 180;

/** Metres between two coordinates. */
export function metresBetween(a: Point, b: Point): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const latA = toRad(a.lat);
  const latB = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(latA) * Math.cos(latB) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * The distance as it is read out loud.
 *
 * Metres below a kilometre and rounded to the nearest 50, because a GPS fix in a stone
 * house is not accurate to the metre and "372 m" claims a precision the phone does not
 * have. Above that, one decimal to 10 km and then whole kilometres — nobody walking to
 * Drass needs "68.4".
 *
 * Returns the number and a unit key separately rather than a finished string: the unit
 * has to come from the translation file, and a formatter that bakes in "km" is a
 * formatter that cannot be translated.
 */
export function formatDistance(metres: number): { value: string; unit: 'm' | 'km' } {
  if (metres < 1000) {
    const rounded = Math.max(50, Math.round(metres / 50) * 50);
    return { value: String(rounded), unit: 'm' };
  }
  const km = metres / 1000;
  return { value: km < 10 ? km.toFixed(1) : String(Math.round(km)), unit: 'km' };
}
