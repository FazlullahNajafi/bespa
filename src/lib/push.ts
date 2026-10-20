import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { supabase } from '@/lib/supabase';

/**
 * Push registration (spec 06.9, 07.3 `push-fanout`).
 *
 * Exists before anything sends a notification, because the first thing that will is
 * notices (spec 03.5) — and a notice is only worth writing if it reaches people who are
 * not currently looking at the app. That is the whole point of the module.
 *
 * Everything here fails soft. A villager who declines the permission prompt, or whose
 * phone has no Play Services, still gets a working app; they simply have to open it to
 * see what is new. Push is an enhancement, never a precondition.
 */

/**
 * How a notification behaves while the app is open. Without a handler the SDK shows
 * nothing at all, which looks like a delivery failure when it is a configuration gap.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    // Silent by default. These phones are carried into mosques, classrooms and shared
    // rooms; an alert tone for an ordinary notice is the kind of thing that gets an app
    // muted permanently, and a muted app delivers nothing. `alert` raises its own.
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Spec 03.5 renders `alert` notices in the warning colour and pushes them with high
 * priority, so they get their own channel — on Android the channel, not the message,
 * decides whether something may make a sound and bypass Do Not Disturb, and a channel's
 * importance cannot be raised after it is created.
 */
const CHANNELS = [
  { id: 'default', name: 'Village updates', importance: Notifications.AndroidImportance.DEFAULT },
  { id: 'alert', name: 'Urgent alerts', importance: Notifications.AndroidImportance.HIGH },
] as const;

export type PushResult =
  | { status: 'registered'; token: string }
  | { status: 'denied' }
  | { status: 'unsupported' }
  | { status: 'failed'; reason: string };

async function ensureChannels() {
  if (Platform.OS !== 'android') return;
  for (const c of CHANNELS) {
    await Notifications.setNotificationChannelAsync(c.id, {
      name: c.name,
      importance: c.importance,
    });
  }
}

/**
 * Asks for permission if needed, gets an Expo push token, and records it against the
 * signed-in user. Safe to call on every launch: `register_my_device` is idempotent and
 * re-points the token at whoever is signed in now, which is what a shared handset needs.
 */
export async function registerForPush(): Promise<PushResult> {
  // An emulator has no push transport, and asking produces a confusing failure rather
  // than a prompt.
  if (!Device.isDevice) return { status: 'unsupported' };

  try {
    // Channels BEFORE the permission request: on Android 13+ the OS prompt does not
    // appear until at least one channel exists.
    await ensureChannels();

    const existing = await Notifications.getPermissionsAsync();
    const granted =
      existing.granted ||
      (await Notifications.requestPermissionsAsync()).granted;

    // Not an error. Someone who said no has said no, and the app carries on.
    if (!granted) return { status: 'denied' };

    // `projectId` is passed explicitly rather than left to be inferred: the inference
    // reads `extra.eas.projectId`, and this project has already been bitten once by
    // config that resolves locally and not on a build server.
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    if (!projectId) return { status: 'failed', reason: 'no EAS project id' };

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    const { error } = await supabase.rpc('register_my_device', {
      token,
      platform: Platform.OS,
      locale: Constants.expoConfig?.extra?.locale ?? null,
    });
    if (error) return { status: 'failed', reason: error.message };

    return { status: 'registered', token };
  } catch (error) {
    // Deliberately swallowed. `getExpoPushTokenAsync` makes a network request, so this
    // throws routinely on the connections this app is written for — and a village that
    // cannot reach Expo's servers must still reach its own notices by opening the app.
    return { status: 'failed', reason: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Drops this handset's token. Called from sign-out, so the next notice for that account
 * does not arrive on a phone its owner has handed back.
 */
export async function unregisterPush(): Promise<void> {
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const token = projectId
      ? (await Notifications.getExpoPushTokenAsync({ projectId })).data
      : null;
    // `undefined` rather than null, so the argument is omitted and the function's own
    // `default null` applies: without a token, clear every device for this user rather
    // than leave a live one behind — err towards no notifications, never towards the
    // wrong recipient.
    await supabase.rpc('forget_my_devices', { token: token ?? undefined });
  } catch {
    // Best effort: a failure here must not block signing out.
  }
}
