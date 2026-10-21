import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * One coordinate, once (spec 02.2, design `screens-location.jsx`).
 *
 * This exists for a single screen: the village picker, where someone standing in their
 * own village can skip a four-level cascade. Nothing else in Bespa asks where anyone is,
 * and nothing stores a coordinate — the fix is read, turned into a village *proposal*,
 * and dropped. That is the whole of the privacy story, and it is why the permission is
 * foreground-only and asked at the moment it is used rather than at launch.
 *
 * `expo-location` is loaded on first use and its absence is not an error, the same way
 * `push.ts` treats `expo-notifications`: the module is native, so a development build
 * made before it was added does not contain it, and a top-level import would take the
 * whole app down with "Cannot find native module 'ExpoLocation'" rather than disabling
 * one button.
 */

type LocationModule = typeof import('expo-location');

let cached: LocationModule | null | undefined;

function locationModule(): LocationModule | null {
  if (cached !== undefined) return cached;

  // Asked of the native side before importing the JS that assumes it. `requireNativeModule`
  // throws from inside the package's own module body, and catching a throw across that
  // boundary under Metro proved unreliable.
  if (!requireOptionalNativeModule('ExpoLocation')) {
    cached = null;
    return cached;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-location') as LocationModule;
  } catch {
    cached = null;
  }
  return cached;
}

/**
 * Whether the button should be offered at all. False on a build without the native
 * module — offering a shortcut that cannot work is worse than not offering one.
 */
export function canLocate(): boolean {
  return locationModule() !== null;
}

export type Fix = { lat: number; lon: number };

export type FixResult =
  | { status: 'ok'; fix: Fix }
  /** The user said no. Not an error: the cascade below still works. */
  | { status: 'denied' }
  /** No native module, or location is switched off on the handset. */
  | { status: 'unsupported' }
  | { status: 'failed' };

/**
 * Asks permission if needed and returns one coordinate.
 *
 * `Balanced` accuracy rather than `Highest`: a village is hundreds of metres across, and
 * the high-accuracy modes keep the GPS radio on for far longer — which on these handsets
 * is a visible battery cost for precision nobody needs. The last known position is
 * accepted when it is recent, because inside a stone house a fresh fix can take a minute
 * that the user will spend looking at a spinner.
 */
export async function getFix(): Promise<FixResult> {
  const location = locationModule();
  if (!location) return { status: 'unsupported' };

  try {
    const existing = await location.getForegroundPermissionsAsync();
    const granted =
      existing.granted || (await location.requestForegroundPermissionsAsync()).granted;
    if (!granted) return { status: 'denied' };

    // Location switched off at the system level: asking for a fix would hang.
    if (!(await location.hasServicesEnabledAsync())) return { status: 'unsupported' };

    const last = await location.getLastKnownPositionAsync({ maxAge: 1000 * 60 * 5 });
    const position =
      last ??
      (await location.getCurrentPositionAsync({
        accuracy: location.Accuracy.Balanced,
      }));

    return {
      status: 'ok',
      fix: { lat: position.coords.latitude, lon: position.coords.longitude },
    };
  } catch {
    // A fix fails routinely — indoors, in a narrow valley, with the radio cold. The
    // picker is the fallback and it is always right there.
    return { status: 'failed' };
  }
}
