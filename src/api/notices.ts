import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { ErrorCode } from '@/lib/errors';
import { registerHandler, submit } from '@/lib/outbox';
import { keys } from './keys';

/**
 * Notices (spec 03.5).
 *
 * RLS does the scoping, not this file: a reader sees a notice when their village sits at
 * or beneath its geo unit, so one query returns both their own village's notices and the
 * district-wide ones mirrored from kargil.nic.in. There is deliberately no village
 * parameter to get wrong.
 */

export type NoticeSource = {
  key: string;
  label: string;
  homepage_url: string | null;
  /** Shown under a mirrored notice. Travels with the source, not hard-coded per screen. */
  disclaimer: string | null;
};

export type Notice = {
  id: string;
  title: string;
  body: string;
  category: 'vacation' | 'order' | 'event' | 'alert' | 'general';
  is_pinned: boolean;
  published_at: string;
  expires_at: string | null;
  source: string;
  source_url: string | null;
  notice_sources: NoticeSource | null;
};

const COLUMNS =
  'id, title, body, category, is_pinned, published_at, expires_at, source, source_url, ' +
  'notice_sources(key, label, homepage_url, disclaimer)';

/**
 * Current notices, pinned first then newest (spec 03.1 section 6).
 *
 * Expired ones are filtered here rather than archived. Spec 03.5 asks for an Archive
 * section; it is deliberately not built, because the authoritative archive is the
 * district's own — 138 pages of it, and we link to the original PDF of every mirrored
 * notice. Becoming a second, possibly stale record of a land-acquisition notice is a
 * liability rather than a feature. The rows are kept, so this is a filter and not a
 * deletion: an Archive remains a change of `lte` to `gt` whenever it earns its place.
 */
export function useNotices(enabled: boolean, limit?: number) {
  return useQuery({
    queryKey: limit ? [...keys.village.all('mine'), 'notices', limit] : [...keys.village.all('mine'), 'notices'],
    enabled,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<Notice[]> => {
      let query = supabase
        .from('notices')
        .select(COLUMNS)
        // `or` rather than two queries: a notice with no expiry never expires, which is
        // the normal case for a village notice that is simply standing information.
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order('is_pinned', { ascending: false })
        .order('published_at', { ascending: false });

      if (limit) query = query.limit(limit);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as Notice[];
    },
  });
}

export function useNotice(id: string | undefined) {
  return useQuery({
    queryKey: keys.village.notice('mine', id ?? ''),
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<Notice | null> => {
      const { data, error } = await supabase
        .from('notices')
        .select(COLUMNS)
        .eq('id', id!)
        .maybeSingle();

      if (error) throw error;
      return (data as unknown as Notice | null) ?? null;
    },
  });
}

/** True when the notice came from an official source rather than from a villager. */
export function isOfficial(notice: Pick<Notice, 'source'>) {
  return notice.source !== 'local';
}

// ---------------------------------------------------------------------------
// Publishing a village notice (spec 03.5)
// ---------------------------------------------------------------------------

export type NoticeCategory = Notice['category'];

export type NoticeDraft = {
  /** The geo unit to publish to — the author's own village, for a panchayat admin. */
  geoUnitId: string;
  title: string;
  body: string;
  category: NoticeCategory;
  isPinned: boolean;
  /** ISO timestamp, or null for a notice that is simply standing information. */
  expiresAt: string | null;
  /**
   * Generated once per draft, by the screen. It is the idempotency key, and it is the
   * reason a double tap on Publish cannot put a village's phones through two pushes for
   * one notice — the outbox is unique on it.
   */
  draftId: string;
};

const PUBLISH_NOTICE = 'publish_notice';

/**
 * Registered at module load rather than inside the hook, so a notice written on a road
 * with no signal still sends on the next cold start that finds one.
 *
 * The RPC decides everything that matters: `published_by` is the caller and `source` is
 * always `local`, so nothing written here can dress itself up as a government notice,
 * and `admins_geo` refuses a unit the author does not administer.
 */
registerHandler<NoticeDraft, string>(PUBLISH_NOTICE, async (draft) => {
  const { data, error } = await supabase.rpc('publish_notice', {
    geo_unit: draft.geoUnitId,
    title: draft.title,
    body: draft.body,
    category: draft.category,
    is_pinned: draft.isPinned,
    // `undefined` omits the argument so the function's own default applies; null would
    // be passed through as an explicit null, which happens to mean the same here but
    // would not if the default ever changed.
    expires_at: draft.expiresAt ?? undefined,
  });
  if (error) throw error;
  return data as string;
});

export type PublishResult =
  | { ok: true }
  | { ok: false; code: ErrorCode }
  /** Offline: written to the outbox, and it will send. */
  | { ok: false; queued: true };

export function usePublishNotice() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (draft: NoticeDraft): Promise<PublishResult> => {
      const result = await submit<string>({
        kind: PUBLISH_NOTICE,
        payload: draft,
        idempotencyKey: `${PUBLISH_NOTICE}:${draft.draftId}`,
      });

      if (result.status === 'done') return { ok: true };
      if (result.status === 'queued') return { ok: false, queued: true };
      return { ok: false, code: result.code };
    },
    onSuccess: (result) => {
      // Every notice list in the app is keyed under the village, so one invalidation
      // covers Home's three and the full list behind it.
      if (result.ok) void client.invalidateQueries({ queryKey: ['village'] });
    },
  });
}
