import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';

// Side-effect import: initialises i18next before any screen calls useTranslation().
import '@/i18n';
import { persistOptions, queryClient } from '@/lib/queryClient';
import { useSession } from '@/store/session';
import { useMyProfile } from '@/api/profile';
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

export default function RootLayout() {
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <SafeAreaProvider>
        <RootNavigator />
      </SafeAreaProvider>
    </PersistQueryClientProvider>
  );
}
