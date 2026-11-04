import { Stack } from 'expo-router';

/**
 * The gallery, pushed over the tabs — same arrangement as `notices/` and `directory/`,
 * and for the same reason: `Screen` pays the status-bar inset itself, so a native header
 * would pay it twice.
 */
export default function GalleryLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
