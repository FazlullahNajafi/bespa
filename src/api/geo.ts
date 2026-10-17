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
