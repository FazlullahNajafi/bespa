import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { ErrorCode } from '@/lib/errors';
import { registerHandler, submit } from '@/lib/outbox';
import { uploadToBucket } from '@/lib/images';
import { keys } from './keys';

/**
 * The village's own page and its statistics (spec 03.1 §3, §5).
 *
 * `keys.village.profile` and `keys.village.stats` have been in the key factory since the
 * first week and unused until now. This is what they were reserved for.
 *
 * **Stats come back as rows and are reduced here, not in SQL.** The table holds one row
 * per metric per year — 2011 and 2026 populations side by side — and "the current figure"
 * is just the newest year. A view could do that reduction, but the full-stats screen
 * wants the older years too, and asking twice for the same handful of rows on a 2G
 * connection to save a `reduce` is the wrong trade.
 */

export type VillageProfile = {
  geo_unit_id: string;
  description: string | null;
  history_note: string | null;
  cover_path: string | null;
  updated_at: string;
};

export type VillageStat = {
  metric_key: string;
  value: number;
  year: number;
  /** Never null — the server refuses a figure without one (spec 03.1). */
  source: string;
};

export function useVillageProfile(villageId: string | null | undefined) {
  return useQuery({
    queryKey: keys.village.profile(villageId ?? 'mine'),
    enabled: Boolean(villageId),
    // A description changes about never. This is also a cold-start query on Home, so the
    // cheapest thing it can do is come from cache.
    staleTime: 1000 * 60 * 60,
    queryFn: async (): Promise<VillageProfile | null> => {
      const { data, error } = await supabase
        .from('village_profiles')
        .select('geo_unit_id, description, history_note, cover_path, updated_at')
        .maybeSingle();

      if (error) throw error;
      return (data as VillageProfile | null) ?? null;
    },
  });
}

export function useVillageStats(villageId: string | null | undefined) {
  return useQuery({
    queryKey: keys.village.stats(villageId ?? 'mine'),
    enabled: Boolean(villageId),
    staleTime: 1000 * 60 * 60,
    queryFn: async (): Promise<VillageStat[]> => {
      const { data, error } = await supabase
        .from('village_stats')
        .select('metric_key, value, year, source')
        .order('metric_key')
        .order('year', { ascending: false });

      if (error) throw error;
      return (data ?? []) as VillageStat[];
    },
  });
}

/**
 * The newest year published for each metric — what Home and the headline figures show.
 *
 * The rows arrive sorted by year descending, so the first of each key wins. Keeping this
 * a plain function rather than a hook means the full-stats screen can call it on the same
 * cached array it is already rendering the history from.
 */
export function latestByMetric(rows: VillageStat[]): VillageStat[] {
  const seen = new Set<string>();
  const out: VillageStat[] = [];
  for (const row of rows) {
    if (seen.has(row.metric_key)) continue;
    seen.add(row.metric_key);
    out.push(row);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Writing — admins only; the server refuses anyone else
// ---------------------------------------------------------------------------

export type VillageWrite =
  | { ok: true }
  | { ok: false; code: ErrorCode }
  | { ok: false; queued: true };

function toWrite(result: { status: string; code?: ErrorCode }): VillageWrite {
  if (result.status === 'done') return { ok: true };
  if (result.status === 'queued') return { ok: false, queued: true };
  return { ok: false, code: result.code ?? 'unknown' };
}

const SET_PROFILE = 'set_village_profile';
const SET_STAT = 'set_village_stat';
const DELETE_STAT = 'delete_village_stat';

export type ProfileDraft = {
  villageId: string;
  description: string | null;
  historyNote: string | null;
};

registerHandler<ProfileDraft, true>(SET_PROFILE, async (draft, mediaPaths) => {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user.id;
  if (!uid) throw Object.assign(new Error('no session'), { code: '42501' });

  // At most one cover, and only when the admin picked a new one. Sending no path leaves
  // whatever is there — the server reads a null `cover_path` as "leave it alone", which
  // is what lets this screen save text without re-uploading the photo every time.
  const cover = mediaPaths[0]
    ? await uploadToBucket(mediaPaths[0], draft.villageId, uid)
    : undefined;

  const { error } = await supabase.rpc('set_village_profile', {
    geo_unit: draft.villageId,
    description: draft.description ?? undefined,
    history_note: draft.historyNote ?? undefined,
    cover_path: cover,
  });
  if (error) throw error;
  return true;
});

registerHandler<{ villageId: string; metricKey: string; value: number; year: number; source: string }, true>(
  SET_STAT,
  async ({ villageId, metricKey, value, year, source }) => {
    const { error } = await supabase.rpc('set_village_stat', {
      geo_unit: villageId,
      metric_key: metricKey,
      value,
      year,
      source,
    });
    if (error) throw error;
    return true;
  },
);

registerHandler<{ villageId: string; metricKey: string; year: number }, true>(
  DELETE_STAT,
  async ({ villageId, metricKey, year }) => {
    const { error } = await supabase.rpc('delete_village_stat', {
      geo_unit: villageId,
      metric_key: metricKey,
      year,
    });
    if (error) throw error;
    return true;
  },
);

export function useSetVillageProfile() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      draft: ProfileDraft;
      coverUri?: string | null;
    }): Promise<VillageWrite> => {
      const result = await submit<true>({
        kind: SET_PROFILE,
        payload: args.draft,
        mediaPaths: args.coverUri ? [args.coverUri] : [],
        // One description per village: the last save wins and a retry re-applies the same
        // end state rather than stacking edits.
        idempotencyKey: `${SET_PROFILE}:${args.draft.villageId}`,
      });
      return toWrite(result);
    },
    onSuccess: (result) => {
      if (result.ok) void client.invalidateQueries({ queryKey: ['village'] });
    },
  });
}

export function useSetVillageStat() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      villageId: string;
      metricKey: string;
      value: number;
      year: number;
      source: string;
    }): Promise<VillageWrite> => {
      const result = await submit<true>({
        kind: SET_STAT,
        payload: args,
        // Keyed by metric *and* year, exactly like the table: correcting 2026 must not
        // collapse into the pending write that published 2011.
        idempotencyKey: `${SET_STAT}:${args.villageId}:${args.metricKey}:${args.year}`,
      });
      return toWrite(result);
    },
    onSuccess: (result) => {
      if (result.ok) void client.invalidateQueries({ queryKey: ['village'] });
    },
  });
}

export function useDeleteVillageStat() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      villageId: string;
      metricKey: string;
      year: number;
    }): Promise<VillageWrite> => {
      const result = await submit<true>({
        kind: DELETE_STAT,
        payload: args,
        idempotencyKey: `${DELETE_STAT}:${args.villageId}:${args.metricKey}:${args.year}`,
      });
      return toWrite(result);
    },
    onSuccess: (result) => {
      if (result.ok) void client.invalidateQueries({ queryKey: ['village'] });
    },
  });
}
