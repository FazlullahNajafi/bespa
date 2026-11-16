import { createClient } from 'jsr:@supabase/supabase-js@2';
import { CORS, digilocker, json } from '../_shared/sandbox.ts';

/**
 * Settle a consent session: ask the provider what happened and, if it succeeded, store
 * the licence.
 *
 * Called by the app once it is back in the foreground. The session id arrives from the
 * client, which is why the first thing done with it is to look up who it belongs to —
 * and everything afterwards uses *that* user, not the caller's claim about themselves.
 *
 * The provider's file URL is presigned and lives about an hour, so the document is copied
 * into the private `documents` bucket rather than linked. A verification whose evidence
 * expires is not a verification.
 */

const BUCKET = 'documents';
const DOC = 'driving_license';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const auth = req.headers.get('Authorization') ?? '';
  if (!auth) return json({ error: 'not_permitted' }, 401);

  const asUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data: userData } = await asUser.auth.getUser();
  const caller = userData?.user;
  if (!caller) return json({ error: 'not_permitted' }, 401);

  let sessionId = '';
  try {
    sessionId = String((await req.json())?.session_id ?? '');
  } catch {
    return json({ error: 'invalid_input' }, 400);
  }
  if (!sessionId) return json({ error: 'invalid_input' }, 400);

  const asService = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: session } = await asService
    .from('digilocker_sessions')
    .select('session_id, user_id, status')
    .eq('session_id', sessionId)
    .maybeSingle();

  // Unknown session, or someone else's. Same answer either way: confirming that a
  // session exists but belongs to another person is itself a disclosure.
  if (!session || session.user_id !== caller.id) {
    return json({ error: 'not_permitted' }, 403);
  }
  if (session.status === 'succeeded') return json({ status: 'succeeded' });

  /**
   * Closing a session that succeeded at signing in but shared nothing.
   *
   * Not an error, and it must not be reported as one: DigiLocker answered, clearly, that
   * it has no driving licence to give. Either the licence is not in this person's
   * DigiLocker or they did not tick it on the consent screen, and both have the same
   * remedy — the photograph path, which is still open.
   */
  async function markNoDocument(why: string) {
    await asService
      .from('digilocker_sessions')
      .update({ status: 'no_document', finished_at: new Date().toISOString(), failure: why })
      .eq('session_id', sessionId);

    return json({ status: 'no_document' });
  }

  // 1. What does the provider say?
  let status = 'created';
  let consented: unknown[] = [];
  try {
    const res = await digilocker(`/kyc/digilocker/sessions/${sessionId}/status`);
    if (!res.ok) {
      console.error('status failed', res.status, await res.text());
      return json({ error: 'provider_failed' }, 502);
    }
    const body = await res.json();
    status = body?.data?.status ?? 'created';
    consented = Array.isArray(body?.data?.documents_consented)
      ? body.data.documents_consented
      : [];
  } catch (e) {
    console.error('status threw', e);
    return json({ error: 'provider_failed' }, 502);
  }

  if (status !== 'succeeded') {
    await asService
      .from('digilocker_sessions')
      .update({
        status,
        ...(status === 'created' ? {} : { finished_at: new Date().toISOString() }),
      })
      .eq('session_id', sessionId);

    // `created` means consent is still outstanding — the user may simply not have
    // finished yet, so this is not a failure to report as one.
    return json({ status });
  }

  // `succeeded` means the sign-in succeeded, which is not the same as having been given
  // anything. A session can come back succeeded with `documents_consented: []`, and the
  // document endpoint then answers "Consent for driving_license not provided" — which
  // read as a provider outage until this check existed.
  if (!consented.includes(DOC)) {
    return await markNoDocument(`${DOC} not consented`);
  }

  // 2. Fetch the document descriptor.
  let file: { url?: string; metadata?: Record<string, unknown> } | undefined;
  try {
    const res = await digilocker(`/kyc/digilocker/sessions/${sessionId}/documents/${DOC}`);
    if (!res.ok) {
      const detail = await res.text();
      console.error('document failed', res.status, detail);

      // The same answer by another route, in case a future response omits
      // `documents_consented` rather than returning it empty.
      if (res.status === 400 && /consent/i.test(detail)) {
        return await markNoDocument(detail.slice(0, 200));
      }
      return json({ error: 'provider_failed' }, 502);
    }
    file = (await res.json())?.data?.files?.[0];
  } catch (e) {
    console.error('document threw', e);
    return json({ error: 'provider_failed' }, 502);
  }

  if (!file?.url) return json({ error: 'provider_failed' }, 502);

  // 3. Copy it somewhere durable before the presigned URL expires.
  let bytes: ArrayBuffer;
  let contentType = String(file.metadata?.ContentType ?? 'application/octet-stream');
  try {
    const res = await fetch(file.url);
    if (!res.ok) return json({ error: 'provider_failed' }, 502);
    bytes = await res.arrayBuffer();
    contentType = res.headers.get('content-type') ?? contentType;
  } catch (e) {
    console.error('download threw', e);
    return json({ error: 'provider_failed' }, 502);
  }

  // The provider does not promise a format — XML for some issuers, PDF or JPEG for
  // others — so the extension follows what actually arrived rather than an assumption.
  const ext = contentType.includes('pdf')
    ? 'pdf'
    : contentType.includes('xml')
      ? 'xml'
      : contentType.includes('jpeg') || contentType.includes('jpg')
        ? 'jpg'
        : 'bin';

  const path = `${session.user_id}/licence/digilocker-${Date.now()}.${ext}`;

  const { error: uploadErr } = await asService.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType, upsert: true });

  if (uploadErr) {
    console.error('upload failed', uploadErr);
    return json({ error: 'unknown' }, 500);
  }

  // 4. Record it. The function re-checks that the session belongs to this driver, so the
  // ownership rule is enforced in the database as well as here.
  const { error: recordErr } = await asService.rpc('record_digilocker_licence', {
    driver: session.user_id,
    session: sessionId,
    storage_path: path,
    meta: file.metadata ?? {},
  });

  if (recordErr) {
    console.error('record failed', recordErr);
    return json({ error: 'unknown' }, 500);
  }

  return json({ status: 'succeeded' });
});
