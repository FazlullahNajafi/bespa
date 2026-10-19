import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { BackLink } from '@/components/back-link';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { PendingChip } from '@/components/pending-chip';
import { PrivacyForm } from '@/components/privacy-form';
import { Screen } from '@/components/screen';
import { useMyPrivacy, useSetMyPrivacy, type MyPrivacy } from '@/api/profile';
import { useSession } from '@/store/session';
import { space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * Privacy, from the profile (spec 03.6's "Privacy" section).
 *
 * The same `PrivacyForm` the onboarding step shows. The difference is only what happens
 * after Save: onboarding hands the user onward through the gate, and this stays put and
 * confirms, because the user came here deliberately to change one thing.
 */
export default function PrivacySettingsScreen() {
  const { t } = useTranslation();
  const colors = useColors();

  const { session } = useSession();
  const privacy = useMyPrivacy(session?.user.id);
  const save = useSetMyPrivacy();

  const [edited, setEdited] = useState<MyPrivacy | null>(null);
  const [status, setStatus] = useState<{ key: string; tone: 'info' | 'danger' } | null>(null);

  const value = edited ?? privacy.data ?? null;

  async function onSave() {
    if (!value) return;
    setStatus(null);

    const result = await save.mutateAsync(value);

    if (result.ok) {
      setStatus({ key: 'common.saved', tone: 'info' });
      return;
    }
    if ('queued' in result) {
      setStatus({ key: 'errors.queued', tone: 'info' });
      return;
    }
    setStatus({ key: `errors.${result.code}`, tone: 'danger' });
  }

  return (
    <Screen
      footer={
        <Button
          label={t('common.save')}
          onPress={onSave}
          loading={save.isPending}
          disabled={!value}
        />
      }
    >
      <BackLink />
      <PendingChip />

      <View style={styles.header}>
        <Text style={[type.display, { color: colors.text }]}>{t('privacy.title')}</Text>
      </View>

      {privacy.isPending ? (
        <ActivityIndicator accessibilityLabel={t('common.loading')} color={colors.primary} />
      ) : value ? (
        <PrivacyForm value={value} onChange={setEdited} busy={save.isPending} />
      ) : (
        // No fallback to the defaults here, unlike the onboarding step: a returning user's
        // real settings are not the defaults, and showing those as if they were would
        // invite them to save a widening of their own privacy by accident.
        <Banner
          message={t('errors.unknown')}
          action={
            <Button
              label={t('common.retry')}
              variant="secondary"
              onPress={() => void privacy.refetch()}
            />
          }
        />
      )}

      {status ? <Banner message={t(status.key)} tone={status.tone} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.xs },
});
