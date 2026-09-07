import type { AuthError, PostgrestError } from '@supabase/supabase-js';

/**
 * Error mapping (spec 07.5).
 *
 * One rule, enforced here: a raw Postgres or GoTrue message never reaches a user. Those
 * strings are English-only, often leak schema detail, and read as a crash to someone
 * whose UI is in Urdu. Everything funnels through a stable machine string that maps to an
 * i18n key under `errors.*`.
 *
 * RPCs raise with their own machine strings (`seat_unavailable`, `hold_expired`,
 * `not_permitted`, `rate_limited`, `phone_unverified`); those pass straight through.
 */
export type ErrorCode =
  | 'offline'
  | 'invalid_credentials'
  | 'email_taken'
  | 'weak_password'
  | 'email_not_confirmed'
  | 'rate_limited'
  | 'not_permitted'
  | 'phone_unverified'
  | 'seat_unavailable'
  | 'hold_expired'
  | 'invalid_input'
  | 'unknown';

const KNOWN: ReadonlySet<string> = new Set<ErrorCode>([
  'offline',
  'invalid_credentials',
  'email_taken',
  'weak_password',
  'email_not_confirmed',
  'rate_limited',
  'not_permitted',
  'phone_unverified',
  'seat_unavailable',
  'hold_expired',
  'invalid_input',
  'unknown',
]);

/** GoTrue codes we have copy for. Anything else becomes `unknown`. */
const AUTH_CODES: Record<string, ErrorCode> = {
  invalid_credentials: 'invalid_credentials',
  user_already_exists: 'email_taken',
  email_exists: 'email_taken',
  weak_password: 'weak_password',
  email_not_confirmed: 'email_not_confirmed',
  over_request_rate_limit: 'rate_limited',
  over_email_send_rate_limit: 'rate_limited',
};

/**
 * Connectivity detection has to cope with three different shapes, because the raw fetch
 * failure never reaches us intact:
 *
 *   - The browser throws `TypeError: "Failed to fetch"`; React Native throws
 *     `TypeError: "Network request failed"`. Note the word order differs — matching one
 *     phrasing silently misses the other platform.
 *   - supabase-js wraps both in `AuthRetryableFetchError`, so `instanceof TypeError` is
 *     already false by the time the app sees it. That wrapper carries `status: 0`.
 *
 * Getting this wrong is not cosmetic: an internet shutdown is routine in this region, and
 * "you're offline, we'll retry" versus "something went wrong" is the difference between a
 * user waiting and a user uninstalling (spec 01.8 #2).
 */
function isOffline(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  if (typeof error !== 'object' || error === null) return false;

  const { name, message, status } = error as {
    name?: unknown;
    message?: unknown;
    status?: unknown;
  };

  // supabase-js uses status 0 for "the request never left the device".
  if (status === 0) return true;
  if (typeof name === 'string' && /RetryableFetchError/i.test(name)) return true;

  return (
    typeof message === 'string' &&
    /failed to fetch|fetch failed|network request failed|network error|timeout|connection refused/i.test(
      message,
    )
  );
}

export function toErrorCode(error: unknown): ErrorCode {
  if (!error) return 'unknown';
  if (isOffline(error)) return 'offline';

  const code = (error as AuthError | PostgrestError & { code?: string })?.code;

  if (typeof code === 'string') {
    if (AUTH_CODES[code]) return AUTH_CODES[code];
    // RPCs raise their machine string as the errcode; accept it when we have copy.
    if (KNOWN.has(code)) return code as ErrorCode;
    // 42501 is insufficient_privilege — an RLS refusal.
    if (code === '42501') return 'not_permitted';
    // 22023 invalid_parameter_value — an RPC rejected an argument the client sent.
    if (code === '22023') return 'invalid_input';
  }

  const status = (error as { status?: number })?.status;
  if (status === 429) return 'rate_limited';
  if (status === 401 || status === 403) return 'not_permitted';

  return 'unknown';
}

/** i18n key for an arbitrary error. Screens render `t(errorKey(e))`. */
export function errorKey(error: unknown): string {
  return `errors.${toErrorCode(error)}`;
}
