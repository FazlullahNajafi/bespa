import { Stack } from 'expo-router';

/**
 * Edit and Privacy, pushed over the tabs.
 *
 * A route group outside `(tabs)` on purpose: these are full-screen tasks with a Save, not
 * destinations to switch between, and keeping the tab bar visible under a form invites a
 * tap that abandons unsaved edits.
 *
 * `headerShown: false` like every other group — `Screen` pays the status-bar inset
 * itself, and a native header would pay it a second time.
 */
export default function ProfileSettingsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
