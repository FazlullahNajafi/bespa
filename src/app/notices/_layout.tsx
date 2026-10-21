import { Stack } from 'expo-router';

/**
 * Notices, pushed over the tabs — same arrangement as `profile/`, and for the same
 * reason: `Screen` pays the status-bar inset itself, so a native header would pay it
 * twice.
 */
export default function NoticesLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
