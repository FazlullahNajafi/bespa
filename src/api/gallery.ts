import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { ErrorCode } from '@/lib/errors';
import { registerHandler, submit } from '@/lib/outbox';
import { signedUrl, uploadToBucket } from '@/lib/images';
import { keys } from './keys';

/**
 * The village gallery (spec 03.3).
 *
 * The upload goes **through the outbox**, which is not ceremony — it is the measured
 * consequence of the Phase 1 spike. A resized photo is 184 KB, which is about a second on
 * wifi and the better part of a minute on 2G, and spec 02.3 is written for 2G. Nobody
 * should watch a spinner for that, so the screen hands the local file to the queue and
 * says it will go; the outbox uploads the bytes and records the row when there is a
 * connection, which may be tomorrow.
 *
 * `mediaPaths` has been on `submit()` since Phase 0 and unused until now. This is what it
 * was for: the payload is small and JSON, the files are listed separately, and the
 * handler is what turns one into the other.
 */

export type GalleryStatus = 'pending' | 'approved' | 'rejected';
/** Spec 03.3's three tabs. The enum has existed since the first migration. */
export type GalleryKind = 'place' | 'festival' | 'general';

export type GalleryImage = {
  id: string;
  storage_path: string;
  caption: string | null;
  status: GalleryStatus;
  kind: GalleryKind;
  banner_position: number | null;
  reject_reason: string | null;
  uploaded_by: string;
  created_at: string;
  /** Spec 03.3 shows the contributor. A name is always visible (spec 03.4). */
  uploader: { full_name: string } | null;
};

// `gallery_images` has two foreign keys to `profiles` — uploaded_by and reviewed_by — so
// the embed has to name the constraint or PostgREST cannot tell which one is meant.
const COLUMNS =
  'id, storage_path, caption, status, kind, banner_position, reject_reason, ' +
  'uploaded_by, created_at, uploader:profiles!gallery_images_uploaded_by_fkey(full_name)';

/**
 * What the village may see, plus whatever belongs to the caller.
 *
 * The policy does the deciding — approved for the village, always for the uploader,
 * always for an admin — so this asks for rows and renders what comes back rather than
 * reasoning about visibility a second time on the client.
 */
export function useGallery(villageId: string | null | undefined) {
  return useQuery({
    queryKey: keys.village.gallery(villageId ?? 'mine'),
    enabled: Boolean(villageId),
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<GalleryImage[]> => {
      const { data, error } = await supabase
        .from('gallery_images')
        .select(COLUMNS)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as GalleryImage[];
    },
  });
}

/** Only what is waiting for a decision, for the moderation queue. */
export function usePendingGallery(villageId: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: keys.village.galleryPending(villageId ?? 'mine'),
    enabled: Boolean(villageId) && enabled,
    staleTime: 1000 * 60,
    queryFn: async (): Promise<GalleryImage[]> => {
      const { data, error } = await supabase
        .from('gallery_images')
        .select(COLUMNS)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as GalleryImage[];
    },
  });
}

/**
 * Signed URLs for a page of images, one query each.
 *
 * Per-image rather than one batch call so that a single expired or missing object leaves
 * a gap in the grid instead of emptying it, and so each URL can be cached and refreshed
 * on its own. They last an hour; the query is kept well inside that.
 */
export function useImageUrls(paths: string[]) {
  return useQueries({
    queries: paths.map((path) => ({
      queryKey: keys.village.imageUrl(path),
      staleTime: 1000 * 60 * 45,
      queryFn: () => signedUrl(path),
    })),
  });
}

// ---------------------------------------------------------------------------
// Contributing
// ---------------------------------------------------------------------------

export type GalleryDraft = {
  villageId: string;
  caption: string | null;
};

export type GalleryWrite =
  | { ok: true }
  | { ok: false; code: ErrorCode }
  /** Offline, which for a photo is the normal case rather than the exception. */
  | { ok: false; queued: true };

const SUBMIT_IMAGES = 'submit_gallery_images';

registerHandler<GalleryDraft, true>(SUBMIT_IMAGES, async (draft, mediaPaths) => {
  // From the stored session rather than the payload: a photo queued before a phone was
  // handed to someone else must upload as whoever is signed in when it drains, or not at
  // all — and the storage policy would refuse it anyway.
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user.id;
  if (!uid) {
    // 42501 is permanent in outbox/policy.ts, so the row is dropped rather than retried
    // forever against a session that is gone.
    throw Object.assign(new Error('no session'), { code: '42501' });
  }

  for (const uri of mediaPaths) {
    const path = await uploadToBucket(uri, draft.villageId, uid);
    const { error } = await supabase.rpc('submit_gallery_image', {
      geo_unit: draft.villageId,
      storage_path: path,
      caption: draft.caption ?? undefined,
    });
    if (error) throw error;
  }

  return true;
});

export function useSubmitGallery() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      draft: GalleryDraft;
      uris: string[];
    }): Promise<GalleryWrite> => {
      // No idempotency key: two submissions of the same photo are two intents, and the
      // storage path is generated per upload so a retry of the *same* queued row reuses
      // nothing. `storage_path` is unique server-side, which is the real guard.
      const result = await submit<true>({
        kind: SUBMIT_IMAGES,
        payload: args.draft,
        mediaPaths: args.uris,
      });

      if (result.status === 'done') return { ok: true };
      if (result.status === 'queued') return { ok: false, queued: true };
      return { ok: false, code: result.code };
    },
    onSuccess: (result) => {
      if (result.ok) void client.invalidateQueries({ queryKey: ['village'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Moderating
// ---------------------------------------------------------------------------

const REVIEW_IMAGE = 'review_gallery_image';
const WITHDRAW_IMAGE = 'withdraw_gallery_image';

registerHandler<{ id: string; approve: boolean; reason: string | null }, true>(
  REVIEW_IMAGE,
  async ({ id, approve, reason }) => {
    const { error } = await supabase.rpc('review_gallery_image', {
      image_id: id,
      approve,
      reason: reason ?? undefined,
    });
    if (error) throw error;
    return true;
  },
);

registerHandler<{ id: string }, true>(WITHDRAW_IMAGE, async ({ id }) => {
  const { data, error } = await supabase.rpc('withdraw_gallery_image', { image_id: id });
  if (error) throw error;

  // The row is gone; take the bytes with it. Failing here leaves an orphaned object,
  // which is untidy rather than unsafe — nothing can reach it without a row.
  if (typeof data === 'string') {
    await supabase.storage.from('images').remove([data]);
  }
  return true;
});

function toWrite(result: { status: string; code?: ErrorCode }): GalleryWrite {
  if (result.status === 'done') return { ok: true };
  if (result.status === 'queued') return { ok: false, queued: true };
  return { ok: false, code: result.code ?? 'unknown' };
}

export function useReviewImage() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      id: string;
      approve: boolean;
      reason?: string;
    }): Promise<GalleryWrite> => {
      const result = await submit<true>({
        kind: REVIEW_IMAGE,
        payload: { id: args.id, approve: args.approve, reason: args.reason ?? null },
        // One decision per photo. A double tap must not approve and then reject.
        idempotencyKey: `${REVIEW_IMAGE}:${args.id}`,
      });
      return toWrite(result);
    },
    onSuccess: (result) => {
      if (result.ok) void client.invalidateQueries({ queryKey: ['village'] });
    },
  });
}

export function useWithdrawImage() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<GalleryWrite> => {
      const result = await submit<true>({
        kind: WITHDRAW_IMAGE,
        payload: { id },
        idempotencyKey: `${WITHDRAW_IMAGE}:${id}`,
      });
      return toWrite(result);
    },
    onSuccess: (result) => {
      if (result.ok) void client.invalidateQueries({ queryKey: ['village'] });
    },
  });
}

/**
 * The village's Home carousel: at most five approved photos, in the order an admin set.
 *
 * Separate from `useGallery` and not filtered out of it, because Home must not pay for
 * the whole gallery to show five pictures — this is a cold-start query on a 2 GB phone,
 * and spec 03.1 wants first paint under four seconds.
 */
export function useVillageBanner(villageId: string | null | undefined) {
  return useQuery({
    queryKey: keys.village.banner(villageId ?? 'mine'),
    enabled: Boolean(villageId),
    // The banner changes when an admin changes it, which is rarely.
    staleTime: 1000 * 60 * 30,
    queryFn: async (): Promise<GalleryImage[]> => {
      const { data, error } = await supabase
        .from('gallery_images')
        .select(COLUMNS)
        .not('banner_position', 'is', null)
        .order('banner_position');

      if (error) throw error;
      return (data ?? []) as unknown as GalleryImage[];
    },
  });
}

const SET_BANNER = 'set_village_banner';
const SET_KIND = 'set_gallery_kind';

registerHandler<{ villageId: string; ids: string[] }, true>(
  SET_BANNER,
  async ({ villageId, ids }) => {
    const { error } = await supabase.rpc('set_village_banner', {
      geo_unit: villageId,
      image_ids: ids,
    });
    if (error) throw error;
    return true;
  },
);

registerHandler<{ id: string; kind: GalleryKind }, true>(SET_KIND, async ({ id, kind }) => {
  const { error } = await supabase.rpc('set_gallery_kind', { image_id: id, new_kind: kind });
  if (error) throw error;
  return true;
});

export function useSetBanner() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (args: { villageId: string; ids: string[] }): Promise<GalleryWrite> => {
      const result = await submit<true>({
        kind: SET_BANNER,
        payload: args,
        // The banner is one sequence, not five edits: the last intent wins and a retry
        // re-applies the same end state.
        idempotencyKey: `${SET_BANNER}:${args.villageId}`,
      });
      return toWrite(result);
    },
    onSuccess: (result) => {
      if (result.ok) void client.invalidateQueries({ queryKey: ['village'] });
    },
  });
}

export function useSetKind() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (args: { id: string; kind: GalleryKind }): Promise<GalleryWrite> => {
      const result = await submit<true>({
        kind: SET_KIND,
        payload: args,
        idempotencyKey: `${SET_KIND}:${args.id}`,
      });
      return toWrite(result);
    },
    onSuccess: (result) => {
      if (result.ok) void client.invalidateQueries({ queryKey: ['village'] });
    },
  });
}
