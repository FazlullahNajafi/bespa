import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { useTranslation } from '@/i18n';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { PendingChip } from '@/components/pending-chip';
import { PrivacyForm } from '@/components/privacy-form';
import { Screen } from '@/components/screen';
import { keys } from '@/api/keys';
import { useMyPrivacy, useSetMyPrivacy, type MyPrivacy, type MyProfile } from '@/api/profile';
import { useSession } from '@/store/session';
import { space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * The privacy step, as its own onboarding screen (spec 03.4).
 *
 * "Onboarding presents these settings explicitly on a dedicated screen, not buried in
 * Settings" is the spec's wording, and the reason is that the defaults are generous: a
 * new profile is visible to the whole village, phone number included. Someone who would
 * not have chosen that should be told before it is true of them, not after.
 *
 * It sits after the village picker because every option on it is phrased in terms of a
 * village, and until one is chosen there is nobody for "my village" to mean.
 */

/** What `handle_new_user` writes, so the form can render before the query resolves. */
const DEFAULTS: MyPrivacy = {
  show_phone: 'villagers',
  show_avatar: 'villagers',
  show_occupation: 'villagers',
  in_directory: true,
};

export default function PrivacyStepScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const client = useQueryClient();

  const { session } = useSession();
  const privacy = useMyPrivacy(session?.user.id);
  const save = useSetMyPrivacy();

  const [edited, setEdited] = useState<MyPrivacy | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The server's own defaults as the fallback, not a guess: if the query cannot be
  // reached, those four values are what is actually in force, so the form is showing the
  // truth rather than an optimistic blank.
  const value = edited ?? privacy.data ?? DEFAULTS;

  async function onContinue() {
    setError(null);
    const result = await save.mutateAsync(value);

    if (result.ok) return; // The gate routes onward once the profile refetches.

    if ('queued' in result) {
      // Offline. The write is durable in the outbox and will send, but the gate reads
      // `privacy_reviewed_at` from the server — so without this the user is held on this
      // screen until a connection returns, having already made their choice.
      //
      // Marking it locally is safe in a way it would not be for most writes: the row's
      // current values are already in force server-side, the user's deltas are only ever
      // more restrictive than the defaults, and nothing reads privacy yet — the directory
      // is Phase 1. The PendingChip stays visible while it waits.
      client.setQueryData<MyProfile | null>(keys.me.profile(), (current) =>
        current ? { ...current, privacy_reviewed_at: new Date().toISOString() } : current,
      );
      client.setQueryData<MyPrivacy>(keys.me.privacy(), value);
      return;
    }

    setError(`errors.${result.code}`);
  }

  return (
    <Screen
      footer={
        <Button
          label={t('common.continue')}
          onPress={onContinue}
          loading={save.isPending}
          disabled={privacy.isPending}
        />
      }
    >
      <PendingChip />

      <View style={styles.header}>
        <Text style={[type.display, { color: colors.text }]}>{t('privacy.title')}</Text>
        <Text style={[type.body, { color: colors.textSecondary }]}>
          {t('privacy.subtitle')}
        </Text>
      </View>

      {privacy.isPending ? (
        <ActivityIndicator accessibilityLabel={t('common.loading')} color={colors.primary} />
      ) : (
        <PrivacyForm value={value} onChange={setEdited} busy={save.isPending} />
      )}

      {error ? <Banner message={t(error)} tone="danger" /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.xs },
});
