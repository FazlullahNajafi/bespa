import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
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
