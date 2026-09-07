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
  },
  ios: {
    bundleIdentifier: ids.id,
    supportsTablet: false,
    icon: './assets/expo.icon',
  },
  android: {
    package: ids.id,
    adaptiveIcon: {
      backgroundColor: '#EAF4FB',
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
        backgroundColor: '#1B6FA8',
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
