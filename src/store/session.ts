import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

type SessionState = {
  session: Session | null;
  /** False until the persisted session has been read from SecureStore. */
  ready: boolean;
  signOut: () => Promise<void>;
};

export const useSession = create<SessionState>((set) => ({
  session: null,
  ready: false,
  signOut: async () => {
    await supabase.auth.signOut();
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
