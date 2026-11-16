import { Redirect } from 'expo-router';

/**
 * Where the DigiLocker consent flow lands when it comes back into the app.
 *
 * `openAuthSessionAsync` normally swallows this: it is listening for exactly this URL,
 * and it closes the browser tab and resolves as soon as it arrives. But the link is a
 * real deep link into a real app, and the router gets it too — so without a route here a
 * driver who has just consented is shown "Unmatched Route", which reads like the thing
 * they did has failed.
 *
 * It carries no logic on purpose. Nothing in the URL is trusted (see
 * `functions/digilocker-callback`), the session is settled by asking the server, and that
 * is already in flight by the time this renders. The driver belongs back on the screen
 * they started from, which is where this puts them.
 */

export default function DigiLockerReturn() {
  return <Redirect href="/driver" />;
}
