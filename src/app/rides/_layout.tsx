import { Stack } from 'expo-router';

/**
 * Rides, pushed over the tabs — same arrangement as every other stack here: `Screen`
 * pays the status-bar inset itself, so a native header would pay it twice.
 */
export default function RidesLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
