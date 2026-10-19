import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import { queryClient } from '@/lib/queryClient';

type SessionState = {
  session: Session | null;
  /** False until the persisted session has been read from SecureStore. */
  ready: boolean;
  signOut: () => Promise<void>;
};

export const useSession = create<SessionState>(() => ({
  session: null,
  ready: false,
  /**
   * Signing out drops the query cache as well as the session.
   *
   * Not tidiness: the cache is persisted for a week (spec 02.3), and phones are shared in
   * this region — which is the same reason the session lives in SecureStore rather than
   * AsyncStorage. Without this, the next person to sign in on the same handset sees the
   * previous user's name, village and profile until each query revalidates.
   */
  signOut: async () => {
    await supabase.auth.signOut();
    queryClient.clear();
  },
}));

/**
 * Wire the store to Supabase once, at module load.
 *
 * `getSession()` resolves from storage, so `ready` flips only after the chunked
 * SecureStore read completes — the root layout holds the splash screen until then, which
 * is what stops a signed-in user seeing a flash of the sign-in screen on every cold start.
 */
void supabase.auth.getSession().then(({ data }) => {
  useSession.setState({ session: data.session, ready: true });
});

supabase.auth.onAuthStateChange((_event, session) => {
  useSession.setState({ session, ready: true });
});
