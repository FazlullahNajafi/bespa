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

const ids = {
  development: { id: 'com.bespa.app.dev', name: 'Bespa (dev)' },
  preview: { id: 'com.bespa.app.preview', name: 'Bespa (preview)' },
  production: { id: 'com.bespa.app', name: 'Bespa' },
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
  scheme: 'bespa',
  userInterfaceStyle: 'automatic',
  icon: './assets/images/icon.png',
  // Kargil runs on Asia/Kolkata; timestamps are stored UTC and rendered in IST.
  extra: {
    variant,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
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
