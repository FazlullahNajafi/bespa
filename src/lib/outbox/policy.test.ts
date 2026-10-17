import { backoffMs, isExhausted, isPermanent, MAX_ATTEMPTS } from './policy';

/**
 * The outbox's retry decisions. These are cheap to get subtly wrong and expensive when
 * wrong: one direction retries a refusal forever, the other throws away work that would
 * have gone through on the next bar of signal.
 */

describe('isPermanent', () => {
  it('does not retry answers the server has already decided', () => {
    // A rate limit is not a network blip. Retrying it in the background for a week only
    // delays telling the user they changed village three days ago.
    expect(isPermanent('rate_limited')).toBe(true);
    expect(isPermanent('not_permitted')).toBe(true);
    expect(isPermanent('invalid_input')).toBe(true);
    expect(isPermanent('seat_unavailable')).toBe(true);
  });

  it('retries anything that might be the connection', () => {
    expect(isPermanent('offline')).toBe(false);
    // `unknown` covers unmapped 5xx responses, so it has to stay retryable — treating it
    // as final would discard a write because a server restarted mid-request.
    expect(isPermanent('unknown')).toBe(false);
  });
});

describe('backoffMs', () => {
  it('doubles from two seconds', () => {
    expect(backoffMs(0)).toBe(2_000);
    expect(backoffMs(1)).toBe(4_000);
    expect(backoffMs(2)).toBe(8_000);
    expect(backoffMs(3)).toBe(16_000);
  });

  it('caps at five minutes so a long outage does not spin the radio', () => {
    expect(backoffMs(10)).toBe(300_000);
    expect(backoffMs(MAX_ATTEMPTS)).toBe(300_000);
  });

  it('survives an attempt count large enough to overflow the shift', () => {
    // 2 ** 1000 is Infinity, and Math.min(Infinity, cap) is the cap — but 2 ** 1024
    // onwards combined with a multiply can produce NaN, which would be stored as a
    // next_attempt_at that never comes due and silently strand the row.
    expect(backoffMs(1_000)).toBe(300_000);
    expect(Number.isFinite(backoffMs(1_000))).toBe(true);
  });

  it('never returns a negative or zero delay', () => {
    expect(backoffMs(-5)).toBeGreaterThan(0);
    expect(backoffMs(0)).toBeGreaterThan(0);
  });
});

describe('isExhausted', () => {
  it('keeps retrying below the limit and stops at it', () => {
    expect(isExhausted(0)).toBe(false);
    expect(isExhausted(MAX_ATTEMPTS - 1)).toBe(false);
    expect(isExhausted(MAX_ATTEMPTS)).toBe(true);
  });
});
