import { createClient } from 'jsr:@supabase/supabase-js@2';
import { CORS, digilocker, isLiveKey, json, safeScheme } from '../_shared/sandbox.ts';

/**
 * Begin a DigiLocker consent session for the signed-in driver.
 *
 * Returns the URL to send them to. Which user the session belongs to is decided here,
 * from their JWT, and written down — never accepted from the client later. A session id
 * is a key to someone's identity documents, so if the client could name the owner,
 * learning an id would be enough to attach a stranger's licence to your own profile.
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const auth = req.headers.get('Authorization') ?? '';
  if (!auth) return json({ error: 'not_permitted' }, 401);

  // Anon key + the caller's JWT: this client is the user, so it sees exactly what they
  // see. The service key is used further down, only for the write they may not make.
  const asUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } },
  );

  const { data: userData, error: userErr } = await asUser.auth.getUser();
  const user = userData?.user;
  if (userErr || !user) return json({ error: 'not_permitted' }, 401);

  let scheme = 'bespa';
  try {
    const body = await req.json();
    scheme = safeScheme(body?.scheme);
  } catch {
    // No body is fine; the default scheme is the production one.
  }

  const functionsBase = `${Deno.env.get('SUPABASE_URL')}/functions/v1`;

  let created: { authorization_url?: string; session_id?: string };
  try {
    // `redirect_url` must be https, so it cannot be the app's own scheme. It points at
    // the callback function, which deep-links onward once DigiLocker is done.
    const res = await digilocker('/kyc/digilocker/sessions/init', {
      method: 'POST',
      body: {
        '@entity': 'in.co.sandbox.kyc.digilocker.session.request',
        flow: 'signin',
        redirect_url: `${functionsBase}/digilocker-callback?scheme=${scheme}`,
        doc_types: ['driving_license'],
        purpose: 'Driver verification',
        requestor_name: 'Bespa',
      },
    });

    if (!res.ok) {
      console.error('init failed', res.status, await res.text());
      return json({ error: 'provider_failed' }, 502);
    }

    const body = await res.json();
    created = body?.data ?? {};
  } catch (e) {
    console.error('init threw', e);
    return json({ error: 'provider_failed' }, 502);
  }

  if (!created.session_id || !created.authorization_url) {
    return json({ error: 'provider_failed' }, 502);
  }

  // Written with the service key: the user may read their own sessions but may not
  // create one, because creating one is what binds a session id to an identity.
  const asService = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { error: insertErr } = await asService
    .from('digilocker_sessions')
    .insert({ session_id: created.session_id, user_id: user.id });

  if (insertErr) {
    console.error('could not record session', insertErr);
    return json({ error: 'unknown' }, 500);
  }

  return json({
    session_id: created.session_id,
    authorization_url: created.authorization_url,
    // Surfaced so the app can say so plainly. A live key means this consent is real and
    // billable, which is not something to discover from an invoice.
    live: isLiveKey(),
  });
});
