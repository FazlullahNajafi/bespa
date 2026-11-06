import { useEffect, useState } from 'react';

/**
 * The current time, as state that ticks.
 *
 * `Date.now()` called during render is an impure function call, and React Compiler
 * rejects it outright — rightly, because a component that reads the clock while
 * rendering produces a different tree on every render for reasons React cannot see.
 *
 * It matters beyond the lint. The seat map decides whether somebody else's hold has run
 * out, and a hold expires on its own with no server event to announce it. Reading the
 * clock in state means a seat that frees up at 10 minutes and 1 second **appears** free
 * on the next tick, rather than staying greyed out until something else happens to
 * trigger a re-render. The server applies the same rule on write, so the two agree.
 *
 * Default is five seconds: fast enough that a stale seat is never stale for long, slow
 * enough to be invisible on a 2 GB handset.
 */
export function useNow(intervalMs = 5000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
