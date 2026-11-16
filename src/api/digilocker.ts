import { useMutation, useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '@/lib/supabase';
import { toErrorCode, toFunctionErrorCode, type ErrorCode } from '@/lib/errors';

/**
 * Verifying a licence through DigiLocker (spec 04.5).
 *
 * A second route to `approved`, not a replacement for the first. A licence issued
 * digitally can be fetched from the issuer and needs no human at all; one that exists
 * only on paper still goes through the photograph-and-review path, which is why that
 * path stays exactly as it was and this sits beside it.
 *
 * **Nothing here talks to the provider.** The API secret authenticates calls that pull a
 * person's government documents, and an APK is a zip file — so every call goes to an edge
 * function, and this module only ever speaks to our own backend.
 *
 * The shape is three steps because consent happens in a browser:
 *
 *   1. `digilocker-start` creates the session and says where to send the user. The
 *      session is bound to their id *there*, from their JWT, never from anything sent
 *      afterwards.
 *   2. The consent page opens in a Custom Tab. It returns through the callback function,
 *      which bounces back into the app's scheme.
 *   3. `digilocker-finish` asks the provider what actually happened. The browser's claim
 *      about the outcome is a hint and is not read.
 */

/**
 * `cancelled` is not a failure, and the distinction matters: the user is standing in
 * front of a screen that must not tell them something broke when they simply changed
 * their mind, or when DigiLocker did not have their licence.
 */
export type DigiLockerOutcome =
  | { status: 'verified' }
  | { status: 'cancelled' }
  | { status: 'failed'; code: ErrorCode };

/**
 * Which app is asking — `bespa-dev`, `bespa-preview` or `bespa`.
 *
 * All three can be installed at once, so the scheme is the only thing that returns the
 * user to the build they started in. The server keeps its own whitelist and ignores
 * anything else, because the callback redirects a browser wherever it is told to.
 */
function appScheme(): string {
  const declared = Constants.expoConfig?.scheme;
  const scheme = Array.isArray(declared) ? declared[0] : declared;
  return typeof scheme === 'string' && scheme ? scheme : 'bespa';
}

/**
 * The code an edge function sent, rather than "something went wrong".
 *
 * The parsing of the body lives here and the mapping lives in `lib/errors.ts`, so the
 * part worth testing is reachable without a `Response` to fake.
 */
async function codeFrom(error: unknown): Promise<ErrorCode> {
  const context = (error as { context?: Response })?.context;
  if (!context || typeof context.json !== 'function') return toErrorCode(error);

  try {
    return toFunctionErrorCode(await context.json(), context.status);
  } catch {
    // A body that is not JSON tells us nothing; the status is all there is.
    return toFunctionErrorCode(null, context.status);
  }
}

export function useVerifyLicenceWithDigiLocker() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<DigiLockerOutcome> => {
      const scheme = appScheme();

      const started = await supabase.functions.invoke<{
        session_id: string;
        authorization_url: string;
        live: boolean;
      }>('digilocker-start', { body: { scheme } });

      if (started.error) return { status: 'failed', code: await codeFrom(started.error) };
      if (!started.data?.session_id || !started.data?.authorization_url) {
        return { status: 'failed', code: 'provider_failed' };
      }

      // A live key means this consent is real and billable. Not shown to the user — a
      // driver in Kargil has no use for it — but it should not take an invoice to find
      // out which key a build is pointed at.
      if (__DEV__) {
        console.log(`[digilocker] session ${started.data.session_id}, live=${started.data.live}`);
      }

      // `openAuthSessionAsync`, not `openBrowserAsync`: it closes the tab itself when the
      // redirect arrives and resolves here, so the app is in the foreground and knows the
      // moment consent ended. Its answer is only used to decide whether to ask the
      // server, never as the outcome.
      try {
        await WebBrowser.openAuthSessionAsync(
          started.data.authorization_url,
          `${scheme}://digilocker`,
        );
      } catch {
        // The tab failed to open, or the platform has no browser. The session exists
        // either way, so fall through and let the server say it is unfinished.
      }

      // Asked even when the tab was dismissed. A user who consents and then swipes the
      // tab away has still consented, and the provider — not the browser — is what knows.
      const finished = await supabase.functions.invoke<{ status: string }>(
        'digilocker-finish',
        { body: { session_id: started.data.session_id } },
      );

      if (finished.error) return { status: 'failed', code: await codeFrom(finished.error) };

      const status = finished.data?.status;
      if (status === 'succeeded') return { status: 'verified' };

      // `created` is consent still outstanding — they backed out, or never finished.
      // Anything else is DigiLocker declining, which is not the app's error to report as
      // one: the photograph path is still open and the screen says so.
      return { status: 'cancelled' };
    },

    onSuccess: (outcome) => {
      if (outcome.status === 'verified') {
        void client.invalidateQueries({ queryKey: ['driver'] });
      }
    },
  });
}
