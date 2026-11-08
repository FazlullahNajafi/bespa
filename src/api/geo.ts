import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { ErrorCode } from '@/lib/errors';
import { registerHandler, submit } from '@/lib/outbox';
import { keys } from './keys';

export type GeoType =
  | 'ut'
  | 'district'
  | 'block'
  | 'village'
  | 'town'
  | 'panchayat'
  | 'municipality';

export type GeoNode = {
  id: string;
  type: GeoType;
  name_en: string;
  name_ur: string | null;
  name_bft: string | null;
  slug: string;
  has_children: boolean;
};

/** The levels a user picks through during onboarding, in order. */
export const PICKER_LEVELS: GeoType[] = ['ut', 'district', 'block', 'village'];

/** Levels at which a selection is a valid tenancy key (spec 02.2). */
export function isTenancyLevel(type: GeoType): boolean {
  return type === 'village' || type === 'town';
}

export function useGeoChildren(parentId: string | null, enabled = true) {
  return useQuery({
    queryKey: keys.geo.children(parentId),
    enabled,
    // Geography is reference data — it changes when boundaries are redrawn, not daily.
    staleTime: 1000 * 60 * 60 * 24,
    queryFn: async (): Promise<GeoNode[]> => {
      const { data, error } = await supabase.rpc('geo_children', { parent: parentId ?? undefined });
      if (error) throw error;
      return (data ?? []) as GeoNode[];
    },
  });
}

/**
 * One geo unit by id — the signed-in user's own village, for the Home greeting.
 *
 * Separate from the profile query rather than joined into it: the profile is read on every
 * cold start to decide routing, and it has no business waiting on a name only one screen
 * shows. Geography is also reference data, so this caches for a day while the profile
 * stays at five minutes.
 */
export function useGeoUnit(id: string | null | undefined) {
  return useQuery({
    queryKey: keys.geo.unit(id ?? ''),
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 60 * 24,
    queryFn: async (): Promise<GeoNode | null> => {
      const { data, error } = await supabase
        .from('geo_units')
        .select('id, type, name_en, name_ur, name_bft, slug')
        .eq('id', id!)
        .maybeSingle();

      if (error) throw error;
      return data ? ({ ...data, has_children: false } as GeoNode) : null;
    },
  });
}

/**
 * A village and the two units above it, in one request.
 *
 * Home's header wants "Gongma Minjee · Sankoo block, Kargil" (spec 03.1 §1), which is
 * three rows of `geo_units` joined to each other. PostgREST can follow a self-reference
 * when the constraint is named, so this is one round trip rather than three — on a cold
 * start over 2G that difference is the header appearing with the screen or a second
 * after it.
 *
 * Cached for a day, like `useGeoUnit`: a village does not change block very often, and
 * when it does the 2026 district split showed that a migration is what moves it.
 */
export type VillageChain = {
  name_en: string;
  name_bft: string | null;
  /** The block, when the village has one. */
  block: string | null;
  district: string | null;
};

export function useVillageChain(id: string | null | undefined) {
  return useQuery({
    queryKey: keys.geo.chain(id ?? ''),
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 60 * 24,
    queryFn: async (): Promise<VillageChain | null> => {
      const { data, error } = await supabase.rpc('village_chain', { unit: id! });
      if (error) throw error;
      return ((data as VillageChain[] | null)?.[0]) ?? null;
    },
  });
}

/**
 * Setting a village is a mutation, so it goes through the outbox like every other one
 * (spec 10.3). It is registered at module load rather than inside the hook, so a row
 * queued offline can still be drained on a cold start before any screen has mounted.
 */
const SET_VILLAGE = 'set_my_village';

registerHandler<{ villageId: string; panchayatId?: string | null }, true>(
  SET_VILLAGE,
  async ({ villageId, panchayatId }) => {
    const { error } = await supabase.rpc('set_my_village', {
      village: villageId,
      panchayat: panchayatId ?? undefined,
    });
    if (error) throw error;
    return true;
  },
);

export type SetVillageResult =
  | { ok: true }
  | { ok: false; code: ErrorCode }
  /** Offline: accepted locally, will send on reconnect. */
  | { ok: false; queued: true };

export function useSetMyVillage() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      villageId: string;
      panchayatId?: string | null;
    }): Promise<SetVillageResult> => {
      // The outbox answers synchronously when there is a connection, so the picker still
      // renders "you changed village 3 days ago" rather than silently queueing a write
      // the server was always going to refuse.
      const result = await submit<true>({
        kind: SET_VILLAGE,
        payload: input,
        // One village choice per user: a double tap must not enqueue twice.
        idempotencyKey: `${SET_VILLAGE}:${input.villageId}`,
      });

      if (result.status === 'done') return { ok: true };
      if (result.status === 'queued') return { ok: false, queued: true };
      return { ok: false, code: result.code };
    },
    onSuccess: (result) => {
      // Changing village changes what every village-scoped query is allowed to see, so
      // the safe move is to drop all of it rather than reason about which keys survive.
      if (result.ok) {
        void client.invalidateQueries({ queryKey: keys.me.all });
        void client.removeQueries({ queryKey: ['village'] });
      }
    },
  });
}

/**
 * The "use my location" shortcut (spec 02.2, design `screens-location.jsx`).
 *
 * A mutation rather than a query: it is something the user *does*, once, by tapping a
 * button — there is no key worth caching it under, and a cached coordinate is a stale
 * one.
 *
 * `geo_nearest` answers with the whole chain from the root down to the match, so the
 * picker can jump a four-level cascade in one round trip. It deliberately refuses to
 * name a village when the nearest one it has a centroid for is too far to believe, and
 * returns the block instead — 50 of 129 villages have no centroid, and a wrong village
 * is a wrong tenancy. See the migration for that reasoning.
 */
export type GeoMatch = {
  /** Root-first, the way the picker walks: UT, district, block, then the match. */
  chain: GeoNode[];
  /** Metres from the caller to the matched unit. */
  distanceM: number | null;
  /** The deepest node — a village or town when it could be named, else a block. */
  match: GeoNode | null;
};

export function useGeoNearest() {
  return useMutation({
    mutationFn: async (fix: { lat: number; lon: number }): Promise<GeoMatch> => {
      const { data, error } = await supabase.rpc('geo_nearest', {
        lat: fix.lat,
        lon: fix.lon,
      });
      if (error) throw error;

      const rows = (data ?? []) as (GeoNode & { distance_m: number | null })[];
      const chain = rows.map(({ distance_m: _distance, ...node }) => node);

      return {
        chain,
        distanceM: rows.find((r) => r.distance_m !== null)?.distance_m ?? null,
        match: chain.at(-1) ?? null,
      };
    },
  });
}
