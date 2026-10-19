import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';

import { supabase } from '@/lib/supabase';
import { toErrorCode, type ErrorCode } from '@/lib/errors';

/**
 * Google sign-in (spec 10.5, Phase 0).
 *
 * The native flow, not a browser redirect: `@react-native-google-signin` shows Android's
 * own account picker, Google returns an ID token, and that token is handed to Supabase.
 * Expo's SDK 57 docs deprecate the `expo-auth-session` Google path in favour of this.
 *
 * `webClientId` is the **web** OAuth client, which is deliberate and the part that reads
 * oddly: it is the audience Google stamps into the ID token, and the value Supabase
 * verifies against. The Android client exists only so Google will issue a token for this
 * package and signing certificate at all — it is never named here and never reaches
 * Supabase.
 *
 * Because this adds native code, it cannot run in Expo Go; a development build is
 * required, and changing the library means rebuilding rather than reloading.
 */

const WEB_CLIENT_ID =
  '11297837666-uauvgi8ubrf0ph28pnauimhg31iutnrn.apps.googleusercontent.com';

let configured = false;

function configure() {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    // Without this the library returns an access token but no ID token, and Supabase has
    // nothing to verify.
    offlineAccess: false,
  });
  configured = true;
}

export type GoogleSignInResult =
  | { ok: true }
  /** The user backed out of the account picker. Not an error worth showing. */
  | { ok: false; cancelled: true }
  | { ok: false; code: ErrorCode };

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  configure();

  try {
    // Surfaces a fixable message on devices without Play Services rather than throwing
    // something opaque from deeper in the native layer.
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    const response = await GoogleSignin.signIn();

    // v16 returns a discriminated result rather than throwing on cancellation.
    if (response.type === 'cancelled') return { ok: false, cancelled: true };

    const idToken = response.data?.idToken;
    if (!idToken) {
      // No token means the configuration is wrong — usually a webClientId that does not
      // match the project, or a SHA-1 Google does not recognise for this package.
      return { ok: false, code: 'unknown' };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });
    if (error) return { ok: false, code: toErrorCode(error) };

    // The session lands through onAuthStateChange, which the session store already
    // listens to, so the auth gate routes from here without this function navigating.
    return { ok: true };
  } catch (error) {
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        return { ok: false, cancelled: true };
      }
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return { ok: false, code: 'offline' };
      }
    }
    return { ok: false, code: toErrorCode(error) };
  }
}
