import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { toErrorCode, type ErrorCode } from '@/lib/errors';
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

export type SetVillageResult = { ok: true } | { ok: false; code: ErrorCode };

export function useSetMyVillage() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      villageId: string;
      panchayatId?: string | null;
    }): Promise<SetVillageResult> => {
      const { error } = await supabase.rpc('set_my_village', {
        village: input.villageId,
        panchayat: input.panchayatId ?? undefined,
      });

      // Returned rather than thrown: "you changed village 3 days ago" is an answer the
      // form has to render, not an exception.
      if (error) return { ok: false, code: toErrorCode(error) };
      return { ok: true };
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
