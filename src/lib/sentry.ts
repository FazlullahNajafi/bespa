import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';

/**
 * Crash reporting (spec 10.5, Phase 0).
 *
 * The thing this buys: a crash on a phone in Kargil is otherwise invisible. Nobody files
 * a bug report — they uninstall, and the first sign is the Play Store rating. This sends
 * the stack trace, the screen, the device and the Android version instead.
 *
 * The DSN is not a secret. It ships inside the app and only permits *writing* events, so
 * it lives in app config like `supabaseUrl` rather than in SecureStore. The thing that
 * *is* secret is `SENTRY_AUTH_TOKEN`, which uploads source maps at build time and never
 * enters the bundle — it is in `.env.local` locally and must be an EAS environment
 * variable with sensitive visibility for builds.
 *
 * Absent a DSN this is a no-op, deliberately: the app has to run for someone who has
 * cloned the repo and has no Sentry account, and a crash reporter that throws on startup
 * is worse than none.
 */

const dsn =
  process.env.EXPO_PUBLIC_SENTRY_DSN ??
  (Constants.expoConfig?.extra?.sentryDsn as string | undefined);

export const sentryEnabled = Boolean(dsn);

/** Forces reporting on in a dev build, where it is off by default. See `enabled` below. */
const debug = process.env.EXPO_PUBLIC_SENTRY_DEBUG === '1';

export function initSentry() {
  if (!dsn) return;

  Sentry.init({
    dsn,
    /**
     * Off, against the SDK's own default of on.
     *
     * `sendDefaultPii` attaches the IP address, cookies and user record to every event.
     * Spec 02.4 scopes personal data to the village it belongs to, and a crash report is
     * not a reason to ship a villager's IP to a third country. The report that matters —
     * the stack trace and the device — does not need it.
     */
    sendDefaultPii: false,

    /**
     * Traces off entirely rather than sampled down. Performance tracing sends a span for
     * every navigation and request, which on a metered 2G connection is the user paying
     * for our telemetry. Revisit when there is a performance question worth the data.
     */
    tracesSampleRate: 0,

    // Which build a report came from. `variant` separates the three app variants, so a
    // dev-client crash is not filed against production.
    environment: (Constants.expoConfig?.extra?.variant as string | undefined) ?? 'development',

    // A crash in a dev build is already on the console in front of whoever caused it, and
    // sending it burns the free tier's 5,000 events on noise.
    //
    // The override exists because without it there is no way to prove the pipeline works:
    // a DSN typo, a blocked egress or a misconfigured project all look exactly like "no
    // crashes yet". Set EXPO_PUBLIC_SENTRY_DEBUG=1, run `captureTestEvent()`, and look for
    // it in the dashboard.
    enabled: !__DEV__ || debug,

    // The SDK's own verbose logging, under the same flag. Without it `captureMessage`
    // is silent on success and on failure alike, which is the opposite of what a
    // "prove it works" switch is for.
    debug,
  });

  // One event per launch while debugging, so "did it arrive" has an answer within
  // seconds rather than waiting for a real crash.
  if (debug) captureTestEvent('startup');
}

/**
 * Sends one event on purpose, to prove the DSN and the network path work end to end.
 * Returns the event id Sentry assigned, which is what to search the dashboard for.
 */
export function captureTestEvent(note: string): string | undefined {
  if (!dsn) return undefined;
  return Sentry.captureMessage(`Bespa test event: ${note}`, 'info');
}

/**
 * Re-exported so screens never import `@sentry/react-native` directly — which is what
 * keeps "is Sentry configured" answerable in one file.
 */
export const wrapRoot = Sentry.wrap;
