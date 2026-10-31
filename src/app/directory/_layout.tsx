import { Stack } from 'expo-router';

/**
 * The directory, pushed over the tabs — same arrangement as `notices/` and `profile/`,
 * and for the same reason: `Screen` pays the status-bar inset itself, so a native header
 * would pay it twice.
 */
export default function DirectoryLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
