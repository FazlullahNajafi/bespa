import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * What a reader can do with a place: get directions to it, or ring it.
 *
 * Both hand off to another app rather than doing the work here. Bespa is not a navigation
 * app and must not pretend to be one — the phone already has Google Maps, it already
 * knows the roads, and it works with the screen off in a jeep.
 */

/**
 * Whether a map can be drawn at all.
 *
 * `react-native-maps` with no API key renders a blank grey rectangle and logs nothing, so
 * a screen that cannot tell the difference shows a broken map and calls it a map. The
 * flag is set in `app.config.ts` from whether the key was present when the native build
 * was made — which is a build-time fact, so reading it at runtime is exactly right.
 *
 * Note this is *not* the same question as "is the native module present". A JS-only
 * update can reach a build made before `react-native-maps` existed; `Maps` is loaded
 * lazily in `place-map.tsx` for that reason, the same shape as `location.ts`.
 */
export function canShowMap(): boolean {
  return Constants.expoConfig?.extra?.mapsEnabled === true;
}

/**
 * Opens the handset's own maps app at a coordinate, with the place's name as the label.
 *
 * `geo:` is the Android intent and is what should run here; the https fallback exists for
 * the web target and for a handset with no maps app registered, where `geo:` resolves to
 * nothing and `openURL` throws. The name goes in the query rather than only as a label
 * because a bare `geo:lat,lon` opens some apps at the coordinate with no pin at all.
 */
export async function openDirections(
  lat: number,
  lon: number,
  name: string,
): Promise<void> {
  const label = encodeURIComponent(name);
  const web = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
  const native =
    Platform.OS === 'android' ? `geo:${lat},${lon}?q=${lat},${lon}(${label})` : web;

  try {
    await Linking.openURL(native);
  } catch {
    try {
      await Linking.openURL(web);
    } catch {
      // No maps app and no browser. Nothing useful to say about it.
    }
  }
}

/**
 * Dials a place's number.
 *
 * No `canOpenURL` check: on Android 11+ it returns false for `tel:` unless the app
 * declares a `<queries>` entry for it, which made the button disappear on exactly the
 * phones it was built for. Calling `openURL` directly works, and a handset with no dialer
 * is not a case worth code.
 */
export async function callPlace(phone: string): Promise<void> {
  try {
    await Linking.openURL(`tel:${phone}`);
  } catch {
    // Nothing to dial with.
  }
}
