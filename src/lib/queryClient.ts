import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';

import { cacheStorage } from './supabase';

const WEEK = 1000 * 60 * 60 * 24 * 7;

/**
 * Offline strategy (spec 02.3).
 *
 * The app assumes the network is absent, not present: village content is served from the
 * persisted cache first and revalidated in the background.
 *
 * The critical rule is the exception. Trips, seat maps and the live stand board are NEVER
 * restored from disk — a stale seat count is worse than no seat count, because it invites
 * a passenger to book a seat that is already gone. Those queries opt out by setting
 * `meta: { persist: false }`, and the persister below refuses to write them.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: WEEK,
      retry: 2,
      // Refetching on every focus is wasteful on metered 2G connections.
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      // Mutations go through the outbox, which owns retry semantics.
      retry: 0,
    },
  },
});

const persister = createAsyncStoragePersister({
  storage: cacheStorage,
  key: 'bespa.query-cache.v1',
  throttleTime: 2000,
});

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister,
  maxAge: WEEK,
  // Bump when a cached shape changes so old entries are dropped rather than mis-read.
  buster: 'v1',
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => {
      if (query.meta?.persist === false) return false;
      return query.state.status === 'success';
    },
  },
};
