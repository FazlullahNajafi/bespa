import { Stack } from 'expo-router';

/**
 * Driver verification, pushed over the tabs — `Screen` pays the status-bar inset
 * itself, so a native header would pay it twice.
 */
export default function DriverLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
