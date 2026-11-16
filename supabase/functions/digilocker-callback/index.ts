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

  // A meta-refresh page rather than a bare 302. Custom-scheme redirects from a 302 are
  // unreliable in Android's Custom Tabs, and a user left on a blank error page has no
  // idea the consent they just gave was recorded. The link is there for when the
  // automatic hop does not fire.
  return new Response(
    `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="0; url=${target}">
<title>Returning to Bespa</title>
<style>
  body { font-family: system-ui, sans-serif; background: #F6EFE4; color: #1A2238;
         display: grid; place-items: center; height: 100vh; margin: 0; text-align: center; }
  a { color: #2B3A6B; font-weight: 600; }
</style>
<p>Returning to Bespa…<br><a href="${target}">Tap here if nothing happens</a></p>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
});
