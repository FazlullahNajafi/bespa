/**
 * Sandbox (sandbox.co.in) — the aggregator in front of DigiLocker.
 *
 * Everything here runs in an edge function and nowhere else. The API secret authenticates
 * requests that can pull a person's government identity documents, so it must never reach
 * the app: an APK is a zip file, and anything bundled into one is extractable.
 *
 * "Sandbox" is the company's name, not an environment. The environment is a separate
 * axis, and the key prefix is what distinguishes them — which is why the base URL is
 * derived from the key rather than configured separately. Configuring them apart is how a
 * test key ends up pointed at production, or worse, a live key at a test run that someone
 * then treats as free.
 */

const KEY = Deno.env.get('SANDBOX_API_KEY') ?? '';
const SECRET = Deno.env.get('SANDBOX_API_SECRET') ?? '';

export function assertConfigured() {
  if (!KEY || !SECRET) {
    throw new Error('SANDBOX_API_KEY / SANDBOX_API_SECRET are not set on this project');
  }
}

/** Derived, never configured: a test key always talks to the test host. */
export function baseUrl(): string {
  return KEY.startsWith('key_test')
    ? 'https://test-api.sandbox.co.in'
    : 'https://api.sandbox.co.in';
}

export function isLiveKey(): boolean {
  return !KEY.startsWith('key_test');
}

/**
 * The access token lasts 24 hours. Cached for the life of the isolate — a best effort
 * only, since an edge function's isolate is short-lived and may be replaced at any time.
 * Re-authenticating is one extra call, not an error.
 */
let cached: { token: string; expiresAt: number } | null = null;

export async function accessToken(): Promise<string> {
  assertConfigured();

  if (cached && Date.now() < cached.expiresAt) return cached.token;

  const res = await fetch(`${baseUrl()}/authenticate`, {
    method: 'POST',
    headers: { 'x-api-key': KEY, 'x-api-secret': SECRET, 'x-api-version': '1.0' },
  });

  if (!res.ok) {
    throw new Error(`authenticate failed: ${res.status} ${await res.text()}`);
  }

  const body = await res.json();
  const token = body?.data?.access_token ?? body?.access_token;
  if (!token) throw new Error('authenticate returned no access_token');

  // Refreshed an hour early rather than at the stated 24, so a call cannot start just
  // before expiry and finish just after.
  cached = { token, expiresAt: Date.now() + 23 * 60 * 60 * 1000 };
  return token;
}

/**
 * A call to the DigiLocker API.
 *
 * The token is sent raw in `Authorization` — this provider does not use the `Bearer`
 * keyword, and adding it fails authentication with a message that does not say so.
 */
export async function digilocker(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<Response> {
  const token = await accessToken();

  return fetch(`${baseUrl()}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: token,
      'x-api-key': KEY,
      'x-api-version': '1.0',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  });
}

/**
 * The app schemes allowed as a redirect target after consent.
 *
 * A whitelist, not a parameter echoed back. The callback redirects a browser to whatever
 * it is told to, so accepting an arbitrary scheme from the client would make this an open
 * redirect carrying a freshly-consented session id.
 */
const SCHEMES = new Set(['bespa-dev', 'bespa-preview', 'bespa']);

export function safeScheme(candidate: unknown): string {
  const s = typeof candidate === 'string' ? candidate : '';
  return SCHEMES.has(s) ? s : 'bespa';
}

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
