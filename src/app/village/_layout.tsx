import { Stack } from 'expo-router';

/**
 * The village page, pushed over the tabs — same arrangement as `places/`, `gallery/`,
 * `notices/` and `directory/`, and for the same reason: `Screen` pays the status-bar
 * inset itself, so a native header would pay it twice.
 */
export default function VillageLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
