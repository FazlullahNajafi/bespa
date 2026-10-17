import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';

// Side-effect import: initialises i18next before any screen calls useTranslation().
import '@/i18n';
import { persistOptions, queryClient } from '@/lib/queryClient';
import { useSession } from '@/store/session';
import { useMyProfile } from '@/api/profile';
import { startConnectivityWatch, useOnReconnect } from '@/lib/net';
import { drain } from '@/lib/outbox';
import { useScheme } from '@/theme/use-scheme';
import { semantic } from '@/theme/tokens';

void SplashScreen.preventAutoHideAsync();

/**
 * Auth gate. Runs after the persisted session has been read, so a returning user goes
 * straight to Home without a flash of the sign-in screen — which matters more here than
 * usual, because cold starts on a 2 GB Android are slow enough for a flash to register.
 *
 * Three states, not two: signed out, signed in without a village, and signed in. The
 * middle one exists because `village_id` is the tenancy key — a session without one can
 * see nothing, since every village-scoped RLS policy compares against it.
 */
function useAuthRedirect() {
  const { session, ready } = useSession();
  const profile = useMyProfile(session?.user.id);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;

    const group = segments[0];
    const inAuthGroup = group === '(auth)';
    const inOnboarding = group === '(onboarding)';

    if (!session) {
      if (!inAuthGroup) router.replace('/(auth)/sign-in');
      void SplashScreen.hideAsync();
      return;
    }

    // Hold the decision until the profile resolves. Deciding early would bounce a
    // returning user through onboarding on every cold start, while the query is still
    // in flight.
    if (profile.isPending) return;

    // If the profile could not be fetched at all — offline, most likely — assume the
    // user is set up rather than trapping them in onboarding they cannot complete.
    const needsVillage = profile.data ? profile.data.village_id === null : false;

    if (needsVillage && !inOnboarding) {
      router.replace('/(onboarding)/pick-village');
    } else if (!needsVillage && (inAuthGroup || inOnboarding)) {
      router.replace('/(tabs)');
    }

    void SplashScreen.hideAsync();
  }, [ready, session, profile.isPending, profile.data, segments, router]);
}

/**
 * Split from RootLayout on purpose: the gate reads the profile through TanStack Query, so
 * it has to run *inside* the provider, not in the component that renders it.
 */
function RootNavigator() {
  const scheme = useScheme();
  const colors = semantic(scheme);

  useAuthRedirect();

  // One connectivity source for the whole app: it drives TanStack's onlineManager (which
  // makes the already-configured `refetchOnReconnect` actually fire) and wakes the
  // outbox. Started here rather than at module load so it is torn down with the tree.
  useEffect(() => startConnectivityWatch(), []);

  // Drains at start and on every reconnect, so work queued offline leaves without the
  // user having to revisit the screen that created it.
  useOnReconnect(() => void drain());

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}

/**
 * `useFonts` rather than the `expo-font` config plugin, which the SDK 57 docs otherwise
 * prefer. The plugin does not run on web, and more importantly it derives the family name
 * per platform — from the filename on Android, from the font's own metadata on iOS — so
 * `DMSans-SemiBold` on one platform is `DM Sans` on the other. Loading at runtime makes
 * the key here the family name everywhere, which is what `theme/tokens` relies on.
 */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'DMSans-Regular': require('../../assets/fonts/DMSans-Regular.ttf'),
    'DMSans-Medium': require('../../assets/fonts/DMSans-Medium.ttf'),
    'DMSans-SemiBold': require('../../assets/fonts/DMSans-SemiBold.ttf'),
    'DMSans-Bold': require('../../assets/fonts/DMSans-Bold.ttf'),
  });

  // Hold behind the splash rather than render in a fallback face and reflow. A load
  // *failure* is different: proceed on system fonts instead of trapping the user behind a
  // splash screen forever over a typeface.
  if (!fontsLoaded && !fontError) return null;

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <SafeAreaProvider>
        <RootNavigator />
      </SafeAreaProvider>
    </PersistQueryClientProvider>
  );
}
