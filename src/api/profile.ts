import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { ErrorCode } from '@/lib/errors';
import { registerHandler, submit } from '@/lib/outbox';
import { keys } from './keys';

export type MyProfile = {
  id: string;
  full_name: string;
  avatar_path: string | null;
  occupation: string | null;
  bio: string | null;
  village_id: string | null;
  panchayat_id: string | null;
  roles: string[];
  created_at: string;
  /** Null until the user has been through the onboarding privacy step (spec 03.4). */
  privacy_reviewed_at: string | null;
};

/**
 * The signed-in user's own profile row.
 *
 * `village_id` is the tenancy key, so this query gates onboarding: a session with no
 * village cannot see any village-scoped content, because every RLS policy compares
 * against it. The auth gate reads this to decide whether to route to the picker.
 *
 * `privacy_reviewed_at` rides along for the same reason — it is the second gate state,
 * and the gate must not pay a second round trip before first paint to learn it.
 */
export function useMyProfile(userId: string | undefined) {
  return useQuery({
    queryKey: keys.me.profile(),
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<MyProfile | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, full_name, avatar_path, occupation, bio, village_id, panchayat_id, roles, created_at, privacy_reviewed_at',
        )
        .eq('id', userId!)
        .maybeSingle();

      if (error) throw error;
      return (data as MyProfile | null) ?? null;
    },
  });
}

/**
 * The owner-only half of the profile (spec 06.3's `profile_private`).
 *
 * Separate query, not a join, because it is separate *access*: nobody but the owner has a
 * select policy on that table, and the number reaches a co-villager only through
 * `get_member_contact`. Keeping the two apart in the client makes it hard to widen one by
 * accident while editing the other.
 *
 * Never persisted to disk: a phone number on a shared phone is exactly what spec 10.4
 * step 4's `meta.persist` opt-out exists for.
 */
export type MyPrivate = {
  phone: string | null;
  phone_verified: boolean;
};

export function useMyPrivate(userId: string | undefined) {
  return useQuery({
    queryKey: keys.me.private(),
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 5,
    meta: { persist: false },
    queryFn: async (): Promise<MyPrivate | null> => {
      const { data, error } = await supabase
        .from('profile_private')
        .select('phone, phone_verified')
        .eq('user_id', userId!)
        .maybeSingle();

      if (error) throw error;
      return (data as MyPrivate | null) ?? null;
    },
  });
}

export type PrivacyLevel = 'villagers' | 'officials' | 'nobody';

export type MyPrivacy = {
  show_phone: PrivacyLevel;
  show_avatar: PrivacyLevel;
  show_occupation: PrivacyLevel;
  in_directory: boolean;
};

export function useMyPrivacy(userId: string | undefined) {
  return useQuery({
    queryKey: keys.me.privacy(),
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<MyPrivacy | null> => {
      const { data, error } = await supabase
        .from('privacy_settings')
        .select('show_phone, show_avatar, show_occupation, in_directory')
        .eq('user_id', userId!)
        .maybeSingle();

      if (error) throw error;
      return (data as MyPrivacy | null) ?? null;
    },
  });
}

/** What every mutation here answers with. `queued` is offline, not failure. */
export type WriteResult =
  | { ok: true }
  | { ok: false; code: ErrorCode }
  | { ok: false; queued: true };

function toWriteResult(result: { status: string; code?: ErrorCode }): WriteResult {
  if (result.status === 'done') return { ok: true };
  if (result.status === 'queued') return { ok: false, queued: true };
  return { ok: false, code: result.code ?? 'unknown' };
}

// ---------------------------------------------------------------------------
// Editing the profile
// ---------------------------------------------------------------------------

export type ProfileEdit = {
  full_name: string;
  occupation: string | null;
  bio: string | null;
  /** E.164, or null to clear it. Omit the field entirely to leave the number alone. */
  phone?: string | null;
};

const UPDATE_PROFILE = 'update_my_profile';

/**
 * Registered at module load, not inside the hook, so an edit queued offline still drains
 * on a cold start before any screen has mounted.
 *
 * Two statements against two tables, which is not atomic — the name can land while the
 * number does not. That is tolerable here in a way it would not be for a booking,
 * because both writes are plain assignments of the values in the payload: a retry
 * re-applies the same end state rather than compounding. The row is only removed from the
 * queue once both have succeeded.
 *
 * It is not a transaction-shaped problem worth an RPC either, since there is no invariant
 * spanning the two — unlike `set_my_privacy`, where "saved" and "step complete" must not
 * be able to disagree.
 */
registerHandler<ProfileEdit, true>(UPDATE_PROFILE, async (edit) => {
  // From the stored session, not `getUser()`, which is a round trip to GoTrue — this
  // handler runs on reconnect, where the first thing it should do is the write.
  //
  // Read here rather than carried in the payload: a row queued before a device was handed
  // to someone else must write to whoever is signed in when it drains, or not at all.
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user.id;
  if (!uid) {
    // 42501 maps to 'not_permitted', which outbox/policy.ts treats as permanent — so the
    // row is dropped rather than retried forever against a session that is gone.
    throw Object.assign(new Error('no session'), { code: '42501' });
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: edit.full_name,
      occupation: edit.occupation,
      bio: edit.bio,
    })
    .eq('id', uid);
  if (error) throw error;

  if ('phone' in edit) {
    const { error: phoneError } = await supabase
      .from('profile_private')
      .update({ phone: edit.phone })
      .eq('user_id', uid);
    if (phoneError) throw phoneError;
  }

  return true;
});

export function useUpdateMyProfile() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (edit: ProfileEdit): Promise<WriteResult> => {
      // No stable idempotency key, unlike the village choice. Two edits are two
      // different intents, and the table is unique on that key — a shared one would make
      // the *second*, newer edit the one that gets dropped. Rows drain oldest-first, so
      // the last thing the user typed is the last thing written.
      const result = await submit<true>({ kind: UPDATE_PROFILE, payload: edit });
      return toWriteResult(result);
    },
    onSuccess: (result) => {
      if (result.ok) void client.invalidateQueries({ queryKey: keys.me.all });
    },
  });
}

// ---------------------------------------------------------------------------
// Privacy
// ---------------------------------------------------------------------------

const SET_PRIVACY = 'set_my_privacy';

registerHandler<MyPrivacy, true>(SET_PRIVACY, async (settings) => {
  const { error } = await supabase.rpc('set_my_privacy', {
    show_phone: settings.show_phone,
    show_avatar: settings.show_avatar,
    show_occupation: settings.show_occupation,
    in_directory: settings.in_directory,
  });
  if (error) throw error;
  return true;
});

export function useSetMyPrivacy() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (settings: MyPrivacy): Promise<WriteResult> => {
      const result = await submit<true>({ kind: SET_PRIVACY, payload: settings });
      return toWriteResult(result);
    },
    onSuccess: (result) => {
      if (result.ok) void client.invalidateQueries({ queryKey: keys.me.all });
    },
  });
}
