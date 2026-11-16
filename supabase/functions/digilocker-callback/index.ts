import { safeScheme } from '../_shared/sandbox.ts';

/**
 * Where DigiLocker returns the user after they consent — or decline.
 *
 * This exists only because `redirect_url` must be https, so it cannot be the app's own
 * scheme. Its whole job is to bounce the browser back into the app.
 *
 * It verifies nothing and writes nothing. Anyone can open it with any query string, so
 * trusting it would be trusting the user's browser; the app asks the server what actually
 * happened once it is back in the foreground. The parameters are carried across only so
 * the app knows which session to ask about.
 *
 * It must be deployed with `--no-verify-jwt`: the caller is a browser following a
 * redirect from a government site, with no Supabase session attached.
 *
 * **It cannot serve an HTML page, and the first version tried.** The Supabase edge
 * gateway rewrites a function's response to `Content-Type: text/plain` with
 * `X-Content-Type-Options: nosniff` and `Content-Security-Policy: default-src 'none';
 * sandbox` — so a page meant to carry the user onward is displayed as its own source,
 * with the meta refresh inert and the "tap here" link rendered as text. That is what a
 * driver saw after consenting: a screen of markup and no way back. A redirect carries no
 * body, so there is nothing for the gateway to neutralise.
 */

Deno.serve((req) => {
  const url = new URL(req.url);
  const scheme = safeScheme(url.searchParams.get('scheme'));

  // Passed through for the app's convenience. Treated as a hint, never as the answer.
  const params = new URLSearchParams();
  for (const key of ['session_id', 'code', 'status', 'error']) {
    const value = url.searchParams.get(key);
    if (value) params.set(key, value);
  }

  const target = `${scheme}://digilocker?${params.toString()}`;

  /**
   * An `intent://` URL rather than the bare scheme.
   *
   * Chrome — which is what a Custom Tab is — treats an unknown scheme in a redirect as an
   * external launch and blocks it in cases where it cannot see a user gesture. `intent://`
   * is the documented way to ask Chrome to start an Android activity, and naming the
   * package removes the ambiguity of three installed variants claiming related schemes.
   * `browser_fallback_url` is what a non-Chromium browser gets, and it is the plain scheme
   * URL, so a Firefox Custom Tab still has a chance of hopping across.
   */
  const pkg = { 'bespa-dev': 'com.bespa.app.dev', 'bespa-preview': 'com.bespa.app.preview' }[
    scheme
  ] ?? 'com.bespa.app';

  const intent =
    `intent://digilocker?${params.toString()}` +
    `#Intent;scheme=${scheme};package=${pkg};` +
    `S.browser_fallback_url=${encodeURIComponent(target)};end`;

  return new Response(null, {
    status: 302,
    headers: {
      Location: intent,
      // Nothing here is worth a second visit, and a cached redirect would outlive the
      // session id baked into it.
      'Cache-Control': 'no-store',
    },
  });
});
