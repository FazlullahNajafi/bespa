import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { keys } from './keys';

export type MyProfile = {
  id: string;
  full_name: string;
  avatar_path: string | null;
  occupation: string | null;
  village_id: string | null;
  panchayat_id: string | null;
  roles: string[];
};

/**
 * The signed-in user's own profile row.
 *
 * `village_id` is the tenancy key, so this query gates onboarding: a session with no
 * village cannot see any village-scoped content, because every RLS policy compares
 * against it. The auth gate reads this to decide whether to route to the picker.
 */
export function useMyProfile(userId: string | undefined) {
  return useQuery({
    queryKey: keys.me.profile(),
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<MyProfile | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_path, occupation, village_id, panchayat_id, roles')
        .eq('id', userId!)
        .maybeSingle();

      if (error) throw error;
      return (data as MyProfile | null) ?? null;
    },
  });
}
