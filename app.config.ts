import type { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * Three build variants live side by side on one device (spec 10.7):
 *   development -> Bespa (dev)     com.bespa.app.dev
 *   preview     -> Bespa (preview) com.bespa.app.preview
 *   production  -> Bespa           com.bespa.app
 * Set APP_VARIANT in the EAS build profile; it defaults to development locally.
 */
type Variant = 'development' | 'preview' | 'production';
const variant = (process.env.APP_VARIANT ?? 'development') as Variant;

/**
 * `scheme` is per variant for the same reason `id` is: all three can be installed at
 * once, and Android lets any number of apps claim the same URL scheme, then picks one
 * arbitrarily. With a shared `bespa://` a dev-client deep link opened whichever build
 * Android felt like — observed 2026-10-20, where it opened preview and the dev client
 * could only be reached with `am start -p com.bespa.app.dev`.
 *
 * That is a nuisance for the dev loop and a real defect later: spec 03.5 shares notices
 * to WhatsApp as deep links, and on any phone carrying two variants half of those links
 * would open the wrong app against the wrong database.
 *
 * Production keeps the bare `bespa`, because that is the scheme that will exist in links
 * out in the world and it must not change under them.
 */
const ids = {
  development: { id: 'com.bespa.app.dev', name: 'Bespa (dev)', scheme: 'bespa-dev' },
  preview: { id: 'com.bespa.app.preview', name: 'Bespa (preview)', scheme: 'bespa-preview' },
  production: { id: 'com.bespa.app', name: 'Bespa', scheme: 'bespa' },
}[variant];

/**
 * The EAS project id. Hard-coded on purpose: EAS Build evaluates this file on its own
 * servers, where a local `.env` does not exist, so reading it only from the environment
 * would silently drop the `updates` block from every build. It is not a secret — it ships
 * inside the published app.
 *
 * `eas init` could not write it here itself: it only edits a static app.json.
 */
const easProjectId = process.env.EAS_PROJECT_ID ?? '38b1dd9a-ff70-4697-822c-1031700383b1';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: ids.name,
  slug: 'bespa',
  version: '0.1.0',
  orientation: 'portrait',
  scheme: ids.scheme,
  userInterfaceStyle: 'automatic',
  icon: './assets/images/icon.png',
  // Kargil runs on Asia/Kolkata; timestamps are stored UTC and rendered in IST.
  extra: {
    variant,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    // Not a secret: it ships in the bundle and only permits writing events. Mirrored here
    // so `Constants.expoConfig.extra` can serve it when the env var is absent at runtime,
    // the same arrangement as the Supabase pair above.
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
  },

  /**
   * `appVersion`, not `fingerprint`.
   *
   * Fingerprint is the better policy in principle — it changes whenever anything touching
   * the native runtime changes, so an update can never reach a build that cannot run it.
   * It does not work here: EAS runs PREBUILD *before* it calculates the runtime version,
   * so the server fingerprints a tree that now contains a generated `android/` and counts
   * the project as bare, while this machine fingerprints the managed tree without it. The
   * two hashes disagree and the build fails in CONFIGURE_EXPO_UPDATES.
   *
   * The cost is that bumping `version` is now what separates incompatible builds, so a
   * native change must come with a version bump. Worth revisiting on a newer eas-cli.
   */
  runtimeVersion: { policy: 'appVersion' },

  ...(easProjectId
    ? { updates: { url: `https://u.expo.dev/${easProjectId}` } }
    : {}),
  ios: {
    bundleIdentifier: ids.id,
    supportsTablet: false,
    icon: './assets/expo.icon',
  },
  android: {
    package: ids.id,
    // Firebase's Android config. It carries the OAuth client ids Google Sign-In needs;
    // Expo's guidance is that it holds no sensitive values, so it is committed rather
    // than injected as an EAS secret. One file per package name — `.preview` and
    // production will each need their own Firebase app and their own SHA-1.
    googleServicesFile: './google-services.json',
    adaptiveIcon: {
      backgroundColor: '#DFE3EE', // primarySoft, Suru Dawn
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    // 'single' (SPA), not 'static'. Static output prerenders every route in Node, which
    // for this app means running the auth gate and the Supabase client in an environment
    // with no `window`. There is nothing to gain in return: every route sits behind a
    // session, and the web target exists only as a fast loop for layout work — the
    // shipped artefacts are the native builds.
    output: 'single',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    /**
     * Sentry's config plugin exists for one job: uploading source maps during the native
     * build, so a stack trace reads as `outbox/index.ts:93` instead of
     * `index.android.bundle:1:284513`. A minified trace from a Kargil phone is not
     * actionable, which is most of the reason to run Sentry at all.
     *
     * The slugs are hard-coded for the same reason as `easProjectId` above, and the first
     * version of this got it wrong: it read them from the environment only, and gated the
     * whole plugin on their presence. They live in `.env`, which EAS does not have — so
     * on the server the condition was false, the plugin was dropped from prebuild
     * entirely, and preview build `a29955ed` finished green while logging "Sentry native
     * configuration is missing from your prebuilt Android project" three times and
     * uploading nothing. Locally it looked perfect.
     *
     * Neither slug is a secret. The token that is — SENTRY_AUTH_TOKEN — stays in the
     * environment (`.env.local` here, an EAS environment variable with sensitive
     * visibility there); without it the build still succeeds and simply skips the upload.
     */
    [
      '@sentry/react-native/expo',
      {
        url: 'https://sentry.io/',
        organization: process.env.SENTRY_ORG || 'najafi-cm',
        project: process.env.SENTRY_PROJECT || 'bespa',
      },
    ] as [string, Record<string, unknown>],
    /**
     * Notices are the reason this is here (spec 03.5): an announcement nobody is told
     * about only reaches whoever happens to open the app that day.
     *
     * No custom icon or sound yet — Android falls back to the app icon, and spec 08
     * has no notification asset. `defaultChannel` is deliberately omitted: the channels
     * are created at runtime in `src/lib/push.ts`, where the alert channel can be given
     * HIGH importance, and a channel's importance cannot be changed once it exists.
     */
    [
      'expo-notifications',
      {
        color: '#2B3A6B', // primary, Suru Dawn — the tint behind the tray icon
      },
    ] as [string, Record<string, unknown>],
    // Adds native code, so changing this requires a new development build — the JS
    // bundle alone cannot carry it.
    '@react-native-google-signin/google-signin',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#2B3A6B', // primary, Suru Dawn
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
