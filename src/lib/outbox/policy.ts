import type { ErrorCode } from '@/lib/errors';

/**
 * When the outbox retries, and when it gives up.
 *
 * Split out of `index.ts` so it can be tested on its own: that module reaches for SQLite
 * and crypto at import time, and this is the part where a wrong answer is expensive —
 * retrying a permanent refusal forever, or dropping work that would have succeeded.
 */

/**
 * Codes that will never succeed on a retry. A rate limit, a permission denial or invalid
 * input is the server's final answer; retrying it in the background for a week only
 * delays telling the user. Everything else — no connection, a 5xx, an unmapped failure —
 * is treated as transient, because the cost of being wrong is a delay rather than lost
 * work.
 */
const PERMANENT: ReadonlySet<ErrorCode> = new Set<ErrorCode>([
  'not_permitted',
  'rate_limited',
  'invalid_input',
  'phone_unverified',
  'seat_unavailable',
  'hold_expired',
  'email_taken',
  'weak_password',
  'invalid_credentials',
  'email_not_confirmed',
]);

export function isPermanent(code: ErrorCode): boolean {
  return PERMANENT.has(code);
}

export const MAX_ATTEMPTS = 8;
const BASE_DELAY_MS = 2_000;
const MAX_DELAY_MS = 5 * 60_000;

/** 2s, 4s, 8s … capped at five minutes, so a long outage does not spin the radio. */
export function backoffMs(attempts: number): number {
  if (attempts < 0) return BASE_DELAY_MS;
  // Shifting by a large `attempts` overflows into nonsense before Math.min can clamp it,
  // so the exponent is bounded first.
  const exponent = Math.min(attempts, 20);
  return Math.min(BASE_DELAY_MS * 2 ** exponent, MAX_DELAY_MS);
}

/** True once automatic retries should stop. The row is kept; it just stops being due. */
export function isExhausted(attempts: number): boolean {
  return attempts >= MAX_ATTEMPTS;
}
