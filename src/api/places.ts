import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { ErrorCode } from '@/lib/errors';
import { registerHandler, submit } from '@/lib/outbox';
import { signedUrl, uploadToBucket } from '@/lib/images';
import { keys } from './keys';

/**
 * Places (spec 03.2): a visual directory of the physical village — the school, the
 * dispensary, the mosque, the shop that sells kerosene.
 *
 * Built on the same three pieces as the gallery, because the problem is the same one:
 * photos that have to be moderated before a stranger's picture reaches other people's
 * screens, carried by the outbox because a 184 KB upload is the better part of a minute
 * on 2G and nobody should watch that.
 *
 * **What is new here is the duplicate prompt.** Spec 03.2 asks that a second place of the
 * same category within 150 m be questioned, not refused — two mosques really can stand a
 * hundred metres apart. So `useNearbyPlaces` is a *read* the submit screen performs
 * before it submits, and `submit_place` takes an acknowledgement rather than making the
 * decision itself. The pair only works if both sides are looking at the same set, which
 * is why the server scopes its own check to the submitter's village.
 *
 * That prompt is also why submitting is **not** fire-and-forget the way a gallery upload
 * is: the screen has to be able to show the refusal. The photos still go through the
 * outbox, so the bytes survive a dead connection, but the screen waits for the answer
 * when there is one to wait for.
 */

export type PlaceStatus = 'pending' | 'approved' | 'rejected';

/** Spec 03.2's twelve categories. The enum has existed since the first migration. */
export const PLACE_CATEGORIES = [
  'school',
  'hospital',
  'mosque',
  'imambargah',
  'khanqah',
  'government_office',
  'bank_atm',
  'water_point',
  'tourist',
  'market',
  'sports',
  'other',
] as const;

export type PlaceCategory = (typeof PLACE_CATEGORIES)[number];

export type Place = {
  id: string;
  category: PlaceCategory;
  name_en: string;
  name_bft: string | null;
  description: string | null;
  lat: number;
  lon: number;
  photo_paths: string[];
  phone: string | null;
  timings: string | null;
  status: PlaceStatus;
  reject_reason: string | null;
  submitted_by: string;
  created_at: string;
  /** Spec 03.2 credits the contributor by name — "Added by Nasreen". */
  submitter: { full_name: string } | null;
};

// `places` has two foreign keys to `profiles` — submitted_by and reviewed_by — so the
// embed has to name the constraint or PostgREST cannot tell which one is meant. The
// coordinate comes back as `lat`/`lon` generated columns rather than as the geography,
// which PostgREST would hand over as WKB hex.
const COLUMNS =
  'id, category, name_en, name_bft, description, lat, lon, photo_paths, phone, timings, ' +
  'status, reject_reason, submitted_by, created_at, ' +
  'submitter:profiles!places_submitted_by_fkey(full_name)';

/**
 * Every place the caller may see: approved ones in their village, plus their own at any
 * stage. The policy does the deciding, so this asks for rows and renders what comes back
 * rather than reasoning about visibility a second time here.
 */
export function usePlaces(villageId: string | null | undefined) {
  return useQuery({
    queryKey: keys.village.places(villageId ?? 'mine'),
    enabled: Boolean(villageId),
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<Place[]> => {
      const { data, error } = await supabase
        .from('places')
        .select(COLUMNS)
        .order('name_en');

      if (error) throw error;
      return (data ?? []) as unknown as Place[];
    },
  });
}

/** Only what is waiting for a decision, for the moderation queue. */
export function usePendingPlaces(villageId: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: keys.village.placesPending(villageId ?? 'mine'),
    enabled: Boolean(villageId) && enabled,
    staleTime: 1000 * 60,
    queryFn: async (): Promise<Place[]> => {
      const { data, error } = await supabase
        .from('places')
        .select(COLUMNS)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as Place[];
    },
  });
}

/** Signed URLs for a set of photos, one query each — same arrangement as the gallery. */
export function usePlacePhotos(paths: string[]) {
  return useQueries({
    queries: paths.map((path) => ({
      queryKey: keys.village.imageUrl(path),
      staleTime: 1000 * 60 * 45,
      queryFn: () => signedUrl(path),
    })),
  });
}

export type NearbyPlace = { id: string; name_en: string; distance_m: number };

/**
 * What is already here (spec 03.2's duplicate control).
 *
 * Asked at the moment the submitter has chosen a category and a coordinate and not
 * before — the answer depends on both, and there is nothing to warn about until there
 * is. `enabled` is what keeps it from firing on every pin drag.
 */
export function useNearbyPlaces(
  category: PlaceCategory | null,
  point: { lat: number; lon: number } | null,
) {
  return useQuery({
    queryKey: keys.village.placesNear(category, point?.lat ?? null, point?.lon ?? null),
    enabled: Boolean(category && point),
    // Short: the submitter may be walking while the screen is open.
    staleTime: 1000 * 30,
    queryFn: async (): Promise<NearbyPlace[]> => {
      const { data, error } = await supabase.rpc('places_near', {
        category: category as PlaceCategory,
        lat: point?.lat as number,
        lon: point?.lon as number,
      });
      if (error) throw error;
      return (data ?? []) as NearbyPlace[];
    },
  });
}

// ---------------------------------------------------------------------------
// Contributing
// ---------------------------------------------------------------------------

export type PlaceDraft = {
  villageId: string;
  category: PlaceCategory;
  nameEn: string;
  nameBft: string | null;
  description: string | null;
  lat: number;
  lon: number;
  phone: string | null;
  timings: string | null;
  /** Set once the submitter has been shown what is already within 150 m. */
  duplicateAcknowledged: boolean;
};

export type PlaceWrite =
  | { ok: true }
  | { ok: false; code: ErrorCode }
  /** Offline. For a place with photos this is the normal case, not the exception. */
  | { ok: false; queued: true };

const SUBMIT_PLACE = 'submit_place';

registerHandler<PlaceDraft, true>(SUBMIT_PLACE, async (draft, mediaPaths) => {
  // From the stored session rather than the payload: a place queued before the phone was
  // handed to someone else must go up as whoever is signed in when it drains, or not at
  // all — and the storage policy would refuse it anyway.
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user.id;
  if (!uid) {
    // 42501 is permanent in outbox/policy.ts, so the row is dropped rather than retried
    // for ever against a session that is gone.
    throw Object.assign(new Error('no session'), { code: '42501' });
  }

  // Every photo first: the row cannot exist without at least one, and `submit_place`
  // checks that each path sits under this user's own folder.
  const paths: string[] = [];
  for (const uri of mediaPaths) {
    paths.push(await uploadToBucket(uri, draft.villageId, uid));
  }

  const { error } = await supabase.rpc('submit_place', {
    geo_unit: draft.villageId,
    category: draft.category,
    name_en: draft.nameEn,
    lat: draft.lat,
    lon: draft.lon,
    photo_paths: paths,
    description: draft.description ?? undefined,
    name_bft: draft.nameBft ?? undefined,
    phone: draft.phone ?? undefined,
    timings: draft.timings ?? undefined,
    duplicate_acknowledged: draft.duplicateAcknowledged,
  });
  if (error) throw error;

  return true;
});

function toWrite(result: { status: string; code?: ErrorCode }): PlaceWrite {
  if (result.status === 'done') return { ok: true };
  if (result.status === 'queued') return { ok: false, queued: true };
  return { ok: false, code: result.code ?? 'unknown' };
}

export function useSubmitPlace() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (args: { draft: PlaceDraft; uris: string[] }): Promise<PlaceWrite> => {
      // No idempotency key: two submissions are two intents, and a retry of the *same*
      // queued row re-uploads under a fresh object name. The 150 m prompt is what stops
      // the duplicate that actually matters.
      const result = await submit<true>({
        kind: SUBMIT_PLACE,
        payload: args.draft,
        mediaPaths: args.uris,
      });
      return toWrite(result);
    },
    onSuccess: (result) => {
      if (result.ok) void client.invalidateQueries({ queryKey: ['village'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Moderating
// ---------------------------------------------------------------------------

const REVIEW_PLACE = 'review_place';
const WITHDRAW_PLACE = 'withdraw_place';

registerHandler<{ id: string; approve: boolean; reason: string | null }, true>(
  REVIEW_PLACE,
  async ({ id, approve, reason }) => {
    const { error } = await supabase.rpc('review_place', {
      place_id: id,
      approve,
      reason: reason ?? undefined,
    });
    if (error) throw error;
    return true;
  },
);

registerHandler<{ id: string }, true>(WITHDRAW_PLACE, async ({ id }) => {
  const { data, error } = await supabase.rpc('withdraw_place', { place_id: id });
  if (error) throw error;

  // The row is gone; take the bytes with it. Failing here leaves orphaned objects, which
  // is untidy rather than unsafe — nothing can reach them without a row.
  if (Array.isArray(data) && data.length > 0) {
    await supabase.storage.from('images').remove(data as string[]);
  }
  return true;
});

export function useReviewPlace() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      id: string;
      approve: boolean;
      reason?: string;
    }): Promise<PlaceWrite> => {
      const result = await submit<true>({
        kind: REVIEW_PLACE,
        payload: { id: args.id, approve: args.approve, reason: args.reason ?? null },
        // One decision per place. A double tap must not approve and then reject.
        idempotencyKey: `${REVIEW_PLACE}:${args.id}`,
      });
      return toWrite(result);
    },
    onSuccess: (result) => {
      if (result.ok) void client.invalidateQueries({ queryKey: ['village'] });
    },
  });
}

export function useWithdrawPlace() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<PlaceWrite> => {
      const result = await submit<true>({
        kind: WITHDRAW_PLACE,
        payload: { id },
        idempotencyKey: `${WITHDRAW_PLACE}:${id}`,
      });
      return toWrite(result);
    },
    onSuccess: (result) => {
      if (result.ok) void client.invalidateQueries({ queryKey: ['village'] });
    },
  });
}
