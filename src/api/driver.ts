import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { toErrorCode, type ErrorCode } from '@/lib/errors';
import { keys } from './keys';

/**
 * Driver verification (spec 04.5, design `screens-driver-verify`).
 *
 * The design's own note is the scope: *"We only confirm that they ARE a taxi driver — no
 * Aadhaar / KYC, no vehicle paperwork chase."* Three documents the RTO already issues,
 * and nothing else is asked for.
 *
 * **These uploads go to `documents`, not `images`.** The gallery bucket is readable by
 * the whole village, which is right for a photograph of a bridge and catastrophic for a
 * licence carrying a name, an address and a date of birth. `documents` is private to its
 * owner and a district reviewer.
 */

/** The three in the design, in the order it lists them. */
export const DRIVER_DOCS = ['licence', 'permit', 'badge'] as const;
export type DriverDocKind = (typeof DRIVER_DOCS)[number];

/** The design's four states. "Not uploaded" is the absence of a row. */
export type DocState = 'notUploaded' | 'reviewing' | 'verified' | 'rejected';

export type DriverDocument = {
  kind: DriverDocKind;
  storage_path: string;
  status: 'pending' | 'approved' | 'rejected';
  reject_reason: string | null;
  submitted_at: string;
};

export function stateOf(doc: DriverDocument | undefined): DocState {
  if (!doc) return 'notUploaded';
  if (doc.status === 'approved') return 'verified';
  if (doc.status === 'rejected') return 'rejected';
  return 'reviewing';
}

export function useMyDriverDocuments(enabled: boolean) {
  return useQuery({
    queryKey: keys.driver.documents(),
    enabled,
    staleTime: 1000 * 60,
    queryFn: async (): Promise<DriverDocument[]> => {
      const { data, error } = await supabase
        .from('driver_documents')
        .select('kind, storage_path, status, reject_reason, submitted_at');
      if (error) throw error;
      return (data ?? []) as DriverDocument[];
    },
  });
}

/** Whether this user may post a trip or go live. The licence alone — see the migration. */
export function useAmVerifiedDriver(enabled: boolean) {
  return useQuery({
    queryKey: keys.driver.verified(),
    enabled,
    staleTime: 1000 * 60,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc('is_verified_driver');
      if (error) throw error;
      return data === true;
    },
  });
}

/**
 * Which of these drivers carry the badge.
 *
 * Asked per screen rather than embedded in the trip row, so a licence withdrawn today
 * stops vouching for a trip posted last week. A cached badge is the one that keeps
 * vouching after the vouching stopped.
 */
export function useVerifiedDrivers(ids: string[]) {
  const key = [...new Set(ids)].sort();
  return useQuery({
    queryKey: keys.driver.badges(key),
    enabled: key.length > 0,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase.rpc('verified_drivers', { ids: key });
      if (error) throw error;
      return new Set(((data ?? []) as { user_id: string }[]).map((r) => r.user_id));
    },
  });
}

export type QueueRow = {
  user_id: string;
  full_name: string | null;
  kind: DriverDocKind;
  storage_path: string;
  submitted_at: string;
};

export function useDriverQueue(enabled: boolean) {
  return useQuery({
    queryKey: keys.driver.queue(),
    enabled,
    staleTime: 1000 * 30,
    queryFn: async (): Promise<QueueRow[]> => {
      const { data, error } = await supabase.rpc('driver_review_queue');
      if (error) throw error;
      return (data ?? []) as QueueRow[];
    },
  });
}

export type DriverWrite = { ok: true } | { ok: false; code: ErrorCode };

/**
 * Upload one document and file it.
 *
 * Direct rather than through the outbox, like the ride calls and for a related reason:
 * this is a short, deliberate, foreground act with a visible result, and a licence
 * sitting in a queue for a day while the screen says "verified soon" would be a lie the
 * driver cannot see through.
 */
export function useSubmitDriverDocument() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      kind: DriverDocKind;
      uri: string;
    }): Promise<DriverWrite> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user.id;
      if (!uid) return { ok: false, code: 'not_permitted' };

      const path = `${uid}/${args.kind}/${Date.now()}.jpg`;
      const bytes = await fetch(args.uri).then((r) => r.arrayBuffer());

      const upload = await supabase.storage
        .from('documents')
        .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
      if (upload.error) return { ok: false, code: toErrorCode(upload.error) };

      const { error } = await supabase.rpc('submit_driver_document', {
        kind: args.kind,
        storage_path: path,
      });
      if (error) return { ok: false, code: toErrorCode(error) };
      return { ok: true };
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: ['driver'] }),
  });
}

export function useReviewDriverDocument() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      driver: string;
      kind: DriverDocKind;
      approve: boolean;
      reason?: string;
    }): Promise<DriverWrite> => {
      const { error } = await supabase.rpc('review_driver_document', {
        driver: args.driver,
        kind: args.kind,
        approve: args.approve,
        reason: args.reason ?? undefined,
      });
      if (error) return { ok: false, code: toErrorCode(error) };
      return { ok: true };
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: ['driver'] }),
  });
}

/** A signed URL for a document, valid briefly. Never public. */
export function useDocumentUrl(path: string | null) {
  return useQuery({
    queryKey: keys.driver.docUrl(path ?? ''),
    enabled: Boolean(path),
    staleTime: 1000 * 60 * 10,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(path as string, 60 * 15);
      if (error) return null;
      return data?.signedUrl ?? null;
    },
  });
}
