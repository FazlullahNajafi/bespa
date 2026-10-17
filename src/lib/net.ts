import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';

/**
 * Connectivity and Lite mode (spec 02.3, 08.7).
 *
 * TanStack Query assumes a browser: on React Native its `onlineManager` never changes
 * state unless something feeds it, so `refetchOnReconnect: true` in the query client was
 * configured but inert — nothing told it a reconnect had happened. Wiring it here is what
 * makes that setting real, and what wakes the outbox.
 */

export type Connectivity = {
  online: boolean;
  /**
   * True on 2g/slow-2g, which auto-enables Lite mode (spec 08.7): no banner carousel,
   * initials instead of avatars, static image instead of the map, no decorative motion.
   */
  slow: boolean;
};

const SLOW_GENERATIONS = new Set(['2g', '3g']);

function read(state: NetInfoState): Connectivity {
  // `isInternetReachable` is null while unknown. Treating unknown as offline would block
  // writes on every cold start before the first probe resolves, so unknown counts as
  // online and a failed request is what proves otherwise.
  const online = state.isConnected !== false && state.isInternetReachable !== false;

  const generation =
    state.type === 'cellular' ? (state.details?.cellularGeneration ?? null) : null;

  return { online, slow: generation !== null && SLOW_GENERATIONS.has(generation) };
}

let current: Connectivity = { online: true, slow: false };
const listeners = new Set<() => void>();

/**
 * Called once from the root layout. Feeds `onlineManager` so query refetching and the
 * outbox drain both react to the same signal rather than each polling their own.
 */
export function startConnectivityWatch() {
  return NetInfo.addEventListener((state) => {
    const next = read(state);
    if (next.online === current.online && next.slow === current.slow) return;

    current = next;
    onlineManager.setOnline(next.online);
    listeners.forEach((fn) => fn());
  });
}

export function getConnectivity(): Connectivity {
  return current;
}

export function useConnectivity(): Connectivity {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
    () => current,
  );
}

/** Runs `fn` whenever the device comes back online, never on the way down. */
export function useOnReconnect(fn: () => void) {
  const { online } = useConnectivity();
  useEffect(() => {
    if (online) fn();
    // `fn` is deliberately not a dependency: callers pass inline closures, and including
    // it would re-run the effect on every render rather than only on a reconnect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);
}
