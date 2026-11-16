import { toErrorCode, toFunctionErrorCode } from './errors';

/**
 * What a user is told when something fails.
 *
 * Worth a test because the failure mode is silent: every unmapped code resolves to
 * `unknown` — "Something went wrong. Please try again." — which looks like working copy
 * and is wrong advice. A driver whose licence is not in DigiLocker should be told to send
 * a photograph instead; "try again" sends them round the same loop.
 */

describe('toErrorCode', () => {
  it('passes through a machine string an RPC raised', () => {
    expect(toErrorCode({ code: 'seat_unavailable' })).toBe('seat_unavailable');
    expect(toErrorCode({ code: 'provider_failed' })).toBe('provider_failed');
  });

  it('maps the SQLSTATEs that reach a client', () => {
    expect(toErrorCode({ code: '42501' })).toBe('not_permitted');
    expect(toErrorCode({ code: '22023' })).toBe('invalid_input');
    expect(toErrorCode({ code: 'PT409' })).toBe('seat_unavailable');
  });

  it('falls back to the HTTP status, then to unknown', () => {
    expect(toErrorCode({ status: 429 })).toBe('rate_limited');
    expect(toErrorCode({ status: 403 })).toBe('not_permitted');
    expect(toErrorCode({ status: 500 })).toBe('unknown');
    expect(toErrorCode(null)).toBe('unknown');
  });
});

describe('toFunctionErrorCode', () => {
  it('reads the code an edge function put in its body', () => {
    expect(toFunctionErrorCode({ error: 'provider_failed' }, 502)).toBe('provider_failed');
    expect(toFunctionErrorCode({ error: 'not_permitted' }, 403)).toBe('not_permitted');
  });

  // The body is the function's claim about itself. A code we have no copy for would
  // otherwise reach a screen as a machine string.
  it('ignores a code it has no copy for and uses the status', () => {
    expect(toFunctionErrorCode({ error: 'method_not_allowed' }, 405)).toBe('unknown');
    expect(toFunctionErrorCode({ error: 'something_new' }, 403)).toBe('not_permitted');
  });

  it('survives a body that is missing or not an object', () => {
    expect(toFunctionErrorCode(null, 401)).toBe('not_permitted');
    expect(toFunctionErrorCode('<html>', 502)).toBe('unknown');
    expect(toFunctionErrorCode(undefined, undefined)).toBe('unknown');
  });
});
