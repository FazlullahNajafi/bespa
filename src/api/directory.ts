import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { toErrorCode, type ErrorCode } from '@/lib/errors';
import { registerHandler, submit } from '@/lib/outbox';
import { keys } from './keys';

/**
 * The village directory (spec 03.4).
 *
 * Two queries and one deliberate non-query. The list comes from `directory_members`, a
 * view that has no phone column at all — so no amount of getting the client wrong can
 * leak a number through a list response. The number itself is fetched one at a time
 * through `get_member_contact`, which re-checks the owner's setting, writes a row the
 * *subject* can read, and refuses past 30 lookups in 24 hours.
 *
 * That reveal is a **mutation**, not a query, and the reason is the query cache: it is
 * AsyncStorage, unencrypted, persisted for a week, and shared handsets are normal here.
 * A query would cache someone else's number to disk. A mutation's result lives in memory
 * for as long as the screen does and is never written anywhere — the same rule
 * `useMyPrivate` follows for the user's own number, applied to numbers that are not even
 * theirs.
 */

export type DirectoryMember = {
  id: string;
  full_name: string;
  /** Null when hidden, or when there is none. Initials are the fallback either way. */
  avatar_path: string | null;
  /** A chosen illustration, behind the same `show_avatar` gate as the photograph. */
  avatar_preset: string | null;
  occupation: string | null;
  roles: string[];
  created_at: string;
  /** Whether to draw a call button. Says nothing about what the number is. */
  phone_available: boolean;
};

/**
 * Everyone listed in the caller's village.
 *
 * No village filter here: RLS on `profiles` already answers "whose rows may I see", and a
 * second copy of that rule in the client is one that can disagree with it. Spec 03.4's
 * "villagers means users whose village_id equals yours, never district-wide" is enforced
 * where it cannot be bypassed.
 */
export function useDirectory(villageId: string | null | undefined) {
  return useQuery({
    queryKey: keys.village.directory(villageId ?? 'mine'),
    enabled: Boolean(villageId),
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<DirectoryMember[]> => {
      const { data, error } = await supabase
        .from('directory_members')
        .select('id, full_name, avatar_path, avatar_preset, occupation, roles, created_at, phone_available')
        .order('full_name');

      if (error) throw error;
      return (data ?? []) as DirectoryMember[];
    },
  });
}

export type VillageContact = {
  id: string;
  name: string;
  designation: string;
  /** Public by definition of the office — not a villager's private number. */
  phone: string | null;
  sort_order: number;
};

/**
 * The sarpanch card and any panchayat numbers, pinned above the list.
 *
 * These carry their number in the row, unlike a villager's: spec 03.4 calls them "public
 * within the village by definition of the office". Someone holding an office has a number
 * people are entitled to have, and hiding it behind a lookup would be security theatre
 * applied to the one number that should be easy to find.
 */
export function useVillageContacts(villageId: string | null | undefined) {
  return useQuery({
    queryKey: keys.village.contacts(villageId ?? 'mine'),
    enabled: Boolean(villageId),
    // Office holders change with an election, not with the hour.
    staleTime: 1000 * 60 * 60,
    queryFn: async (): Promise<VillageContact[]> => {
      const { data, error } = await supabase
        .from('village_contacts')
        .select('id, name, designation, phone, sort_order')
        .order('sort_order')
        .order('name');

      if (error) throw error;
      return (data ?? []) as VillageContact[];
    },
  });
}

export type ContactResult =
  | { ok: true; phone: string | null; verified: boolean }
  | { ok: false; code: ErrorCode };

/**
 * Reveals one villager's number.
 *
 * Not through the outbox, unlike every write in this app: there is nothing to queue. It
 * is a read that happens to be audited, and a reveal that fires on reconnect three hours
 * later would log an access its viewer has forgotten asking for.
 */
export function useMemberContact() {
  return useMutation({
    mutationFn: async (memberId: string): Promise<ContactResult> => {
      const { data, error } = await supabase.rpc('get_member_contact', {
        member_id: memberId,
      });

      if (error) return { ok: false, code: toErrorCode(error) };

      const row = (data ?? [])[0] as { phone: string | null; phone_verified: boolean } | undefined;
      return { ok: true, phone: row?.phone ?? null, verified: row?.phone_verified ?? false };
    },
  });
}

// ---------------------------------------------------------------------------
// Maintaining the panchayat cards (spec 03.4)
// ---------------------------------------------------------------------------

export type ContactEdit = {
  /** Absent when adding; present when correcting an existing card. */
  id?: string;
  /** The village the card belongs to. Ignored on an edit — a card never moves. */
  geoUnitId: string;
  name: string;
  designation: string;
  /** E.164, or null. Public by virtue of the office, unlike a villager's number. */
  phone: string | null;
  sortOrder: number;
};

export type ContactWrite =
  | { ok: true }
  | { ok: false; code: ErrorCode }
  | { ok: false; queued: true };

const SAVE_CONTACT = 'save_village_contact';
const REMOVE_CONTACT = 'remove_village_contact';

/**
 * One handler for both adding and correcting, because to the outbox they are the same
 * kind of durable intent and the only difference is whether an id came with it.
 */
registerHandler<ContactEdit, true>(SAVE_CONTACT, async (edit) => {
  const { error } = edit.id
    ? await supabase.rpc('update_village_contact', {
        p_id: edit.id,
        p_name: edit.name,
        p_designation: edit.designation,
        p_phone: edit.phone ?? undefined,
        p_sort_order: edit.sortOrder,
      })
    : await supabase.rpc('publish_village_contact', {
        geo_unit: edit.geoUnitId,
        name: edit.name,
        designation: edit.designation,
        phone: edit.phone ?? undefined,
        sort_order: edit.sortOrder,
      });

  if (error) throw error;
  return true;
});

registerHandler<{ id: string }, true>(REMOVE_CONTACT, async ({ id }) => {
  const { error } = await supabase.rpc('delete_village_contact', { p_id: id });
  if (error) throw error;
  return true;
});

function toWrite(result: { status: string; code?: ErrorCode }): ContactWrite {
  if (result.status === 'done') return { ok: true };
  if (result.status === 'queued') return { ok: false, queued: true };
  return { ok: false, code: result.code ?? 'unknown' };
}

export function useSaveVillageContact() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (edit: ContactEdit): Promise<ContactWrite> => {
      // Keyed on the row for an edit and left unkeyed for an add: correcting the same
      // card twice is one intent, while adding two people called Ali is two.
      const result = await submit<true>({
        kind: SAVE_CONTACT,
        payload: edit,
        idempotencyKey: edit.id ? `${SAVE_CONTACT}:${edit.id}` : undefined,
      });
      return toWrite(result);
    },
    onSuccess: (result) => {
      if (result.ok) void client.invalidateQueries({ queryKey: ['village'] });
    },
  });
}

export function useRemoveVillageContact() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<ContactWrite> => {
      const result = await submit<true>({
        kind: REMOVE_CONTACT,
        payload: { id },
        idempotencyKey: `${REMOVE_CONTACT}:${id}`,
      });
      return toWrite(result);
    },
    onSuccess: (result) => {
      if (result.ok) void client.invalidateQueries({ queryKey: ['village'] });
    },
  });
}
