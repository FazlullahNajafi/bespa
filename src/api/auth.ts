import { supabase } from '@/lib/supabase';
import { toErrorCode, type ErrorCode } from '@/lib/errors';

/**
 * Auth calls (spec 01.5, 10.0 #1).
 *
 * Screens never touch `supabase` directly — they call these, which return a discriminated
 * result rather than throwing. Auth failures are an expected outcome of a form, not an
 * exception, and a wrong password should not travel through an error boundary.
 *
 * Phone verification is deliberately absent here. It is a separate, later step against a
 * provider whose DLT registration has a multi-week lead time, and a user who cannot
 * receive an SMS must still be able to reach the app.
 */
export type AuthResult =
  | { ok: true; needsEmailConfirmation: boolean }
  | { ok: false; code: ErrorCode };

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) return { ok: false, code: toErrorCode(error) };
  return { ok: true, needsEmailConfirmation: false };
}

export async function signUp(
  email: string,
  password: string,
  fullName: string,
): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    // Read by the handle_new_user() trigger, which creates the profile, privacy and
    // private rows in one transaction — so there is no window where a signed-in user
    // has no profile.
    options: { data: { full_name: fullName.trim() } },
  });

  if (error) return { ok: false, code: toErrorCode(error) };

  // With email confirmation on, Supabase returns a user but no session.
  return { ok: true, needsEmailConfirmation: !data.session };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
