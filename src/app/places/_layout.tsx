import { Stack } from 'expo-router';

/**
 * Places, pushed over the tabs — the same arrangement as `gallery/`, `notices/` and
 * `directory/`, and for the same reason: `Screen` pays the status-bar inset itself, so a
 * native header would pay it twice.
 */
export default function PlacesLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
