import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import Constants from 'expo-constants';

import type { Database } from './database.types';

const extra = Constants.expoConfig?.extra ?? {};
const supabaseUrl = (extra.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL) as string;

/**
 * Named `anon` for the legacy key, but the hosted project issues the newer
 * `sb_publishable_…` format and both go in this variable. They behave the same from here:
 * low-privilege, mapped to the `anon` Postgres role, and governed entirely by RLS — which
 * is why the column grants in migration `20261019120000` matter. The difference is that
 * the new format is not a JWT, so anything that tries to decode it will fail.
 *
 * Either is safe in the bundle and in a public repo. The `sb_secret_…` key is not, and
 * must never reach this file: it maps to `service_role` and bypasses every policy.
 */
const supabaseAnonKey = (extra.supabaseAnonKey ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.',
  );
}

/**
 * Session storage (spec 10.4 step 3).
 *
 * Phones are routinely shared in the target region, so a session token sitting in
 * AsyncStorage in the clear is the wrong default. SecureStore is backed by the Keychain /
 * Android Keystore — but it warns above ~2 KB per item, and a Supabase session (two JWTs
 * plus user metadata) regularly exceeds that. So we chunk: the value is split across
 * numbered SecureStore keys, with an index entry recording how many chunks exist.
 *
 * A read that finds a partially-written record deletes what it has and returns null,
 * which logs the user out rather than handing the client a corrupt session.
 */
const CHUNK_SIZE = 1800;

const chunkKey = (key: string, i: number) => `${key}.${i}`;
const countKey = (key: string) => `${key}.count`;

async function clearChunks(key: string, count: number) {
  await Promise.all([
    SecureStore.deleteItemAsync(countKey(key)),
    ...Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(chunkKey(key, i))),
  ]);
}

export const chunkedSecureStore: SupportedStorage = {
  async getItem(key) {
    const rawCount = await SecureStore.getItemAsync(countKey(key));
    if (!rawCount) return null;

    const count = Number.parseInt(rawCount, 10);
    if (!Number.isInteger(count) || count < 1) {
      await clearChunks(key, 0);
      return null;
    }

    const parts = await Promise.all(
      Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(chunkKey(key, i))),
    );

    if (parts.some((part) => part === null)) {
      // Torn write — a crash between chunk writes. Drop it; the user signs in again.
      await clearChunks(key, count);
      return null;
    }

    return parts.join('');
  },

  async setItem(key, value) {
    const previous = await SecureStore.getItemAsync(countKey(key));
    if (previous) await clearChunks(key, Number.parseInt(previous, 10) || 0);

    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }

    await Promise.all(chunks.map((chunk, i) => SecureStore.setItemAsync(chunkKey(key, i), chunk)));
    // Written last: until the count exists, the record does not exist.
    await SecureStore.setItemAsync(countKey(key), String(chunks.length));
  },

  async removeItem(key) {
    const rawCount = await SecureStore.getItemAsync(countKey(key));
    await clearChunks(key, rawCount ? Number.parseInt(rawCount, 10) || 0 : 0);
  },
};

/**
 * Storage has to answer two questions, not one: which platform, and — on web — whether
 * this code is running in a browser at all.
 *
 * SecureStore is a native module with no web implementation. On web the obvious
 * substitute is AsyncStorage (localStorage under the hood), and that is fine in a real
 * browser: the web target exists for layout work, and a browser has no Keychain anyway.
 *
 * But `Platform.OS === 'web'` is ALSO true inside Node during a prerender or a test, and
 * there AsyncStorage reaches for `window` and throws at import time. So the browser check
 * is a capability check, not a platform check, and Node falls back to an in-memory store:
 * no session survives the process, which is exactly right for a render pass.
 *
 * Native builds — the only ones that ship — always get the chunked SecureStore adapter.
 */
const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

function createMemoryStorage(): SupportedStorage {
  const store = new Map<string, string>();
  return {
    getItem: async (key) => store.get(key) ?? null,
    setItem: async (key, value) => void store.set(key, value),
    removeItem: async (key) => void store.delete(key),
  };
}

export const sessionStorage: SupportedStorage =
  Platform.OS === 'web'
    ? isBrowser
      ? AsyncStorage
      : createMemoryStorage()
    : chunkedSecureStore;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: sessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    // No URL session detection: this is a native app, not a browser.
    detectSessionInUrl: false,
  },
  global: {
    headers: { 'x-bespa-client': 'mobile' },
  },
});

/**
 * Non-sensitive cache storage. The TanStack Query persister writes here — village
 * content, notices, helplines. Deliberately NOT SecureStore: it is large, it is not
 * secret, and Keychain round-trips would make hydration slow.
 *
 * Same Node caveat as above: outside a browser there is nothing to persist to, and a
 * throwaway map keeps the persister happy without reaching for `window`.
 */
export const cacheStorage =
  Platform.OS === 'web' && !isBrowser ? createMemoryStorage() : AsyncStorage;
