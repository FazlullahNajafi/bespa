import { Linking } from 'react-native';

/**
 * Open the dialer on a number.
 *
 * No `canOpenURL` check: on Android 11+ it returns false for `tel:` unless the app
 * declares a `<queries>` entry for the intent, which made a call button disappear on
 * exactly the phones it was built for. Calling `openURL` directly works, and a handset
 * with no dialer is not a case worth code.
 *
 * It does **not** place the call — Android opens the dialer with the number filled in and
 * the person presses the green button. That is the right behaviour everywhere and it is
 * the only acceptable behaviour on the helplines screen, where a mis-tap must not ring
 * the police.
 */
export async function dial(number: string): Promise<void> {
  try {
    await Linking.openURL(`tel:${number.replace(/\s+/g, '')}`);
  } catch {
    // Nothing to dial with.
  }
}
