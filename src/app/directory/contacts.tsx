import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { Avatar } from '@/components/avatar';
import { BackLink } from '@/components/back-link';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { PendingChip } from '@/components/pending-chip';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import {
  useRemoveVillageContact,
  useSaveVillageContact,
  useVillageContacts,
  type VillageContact,
} from '@/api/directory';
import { useMyProfile } from '@/api/profile';
import { useGeoUnit } from '@/api/geo';
import { useSession } from '@/store/session';
import { COUNTRY_CODE, fromE164, isValidNational, toE164 } from '@/lib/phone';
import { fontFamily, layout, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * The panchayat's own cards (spec 03.4), and who may change them.
 *
 * These are the one thing that makes a directory useful on the day it has no other
 * members: a village where nobody has signed up still has a sarpanch, and his number is
 * the number people actually want. Spec 03.4 calls these "public within the village by
 * definition of the office" — which is why they carry their number in the row, while a
 * villager's is locked behind a lookup and an audit log.
 *
 * They have existed in the database since the directory shipped and there has never been
 * a way to add one, so the section above the directory has never appeared for anyone.
 * This is that way.
 *
 * Correcting and removing matter as much as adding, and the reason is in the migration:
 * an office changes hands, and a card still showing last year's holder is worse than no
 * card at all, because people ring it.
 */

type Draft = {
  id?: string;
  name: string;
  designation: string;
  phone: string;
};

const EMPTY: Draft = { name: '', designation: '', phone: '' };

export default function VillageContactsScreen() {
  const { t } = useTranslation();
  const colors = useColors();

  const { session } = useSession();
  const profile = useMyProfile(session?.user.id);
  const villageId = profile.data?.village_id ?? null;
  const village = useGeoUnit(villageId);

  const contacts = useVillageContacts(villageId);
  const save = useSaveVillageContact();
  const remove = useRemoveVillageContact();

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [queued, setQueued] = useState(false);

  const name = draft.name.trim();
  const designation = draft.designation.trim();
  const phoneOk = !draft.phone.trim() || isValidNational(draft.phone);
  const ready = Boolean(name && designation && phoneOk && villageId);

  function edit(contact: VillageContact) {
    setError(null);
    setQueued(false);
    setDraft({
      id: contact.id,
      name: contact.name,
      designation: contact.designation,
      phone: fromE164(contact.phone),
    });
  }

  async function onSave() {
    if (!ready || !villageId) return;
    setError(null);
    setQueued(false);

    const result = await save.mutateAsync({
      id: draft.id,
      geoUnitId: villageId,
      name,
      designation,
      phone: toE164(draft.phone),
      // New cards go to the end. There is no reordering control yet, so the order people
      // add them in is the order the village sees — which in practice means the sarpanch
      // first, because he is who anyone sets this up for.
      sortOrder: draft.id
        ? (contacts.data?.find((c) => c.id === draft.id)?.sort_order ?? 0)
        : (contacts.data?.length ?? 0) * 10,
    });

    if (result.ok) {
      setDraft(EMPTY);
      return;
    }
    if ('queued' in result) {
      setQueued(true);
      setDraft(EMPTY);
      return;
    }
    setError(`errors.${result.code}`);
  }

  async function onRemove(contact: VillageContact) {
    setError(null);
    setQueued(false);
    const result = await remove.mutateAsync(contact.id);
    if (result.ok) {
      if (draft.id === contact.id) setDraft(EMPTY);
      return;
    }
    if ('queued' in result) {
      setQueued(true);
      return;
    }
    setError(`errors.${result.code}`);
  }

  const busy = save.isPending || remove.isPending;

  return (
    <Screen
      footer={
        <>
          <Button
            label={t(draft.id ? 'contacts.saveChanges' : 'contacts.add')}
            onPress={() => void onSave()}
            loading={save.isPending}
            disabled={!ready || busy}
          />
          {draft.id ? (
            <Button
              label={t('common.cancel')}
              variant="ghost"
              onPress={() => setDraft(EMPTY)}
              disabled={busy}
            />
          ) : null}
        </>
      }
    >
      <BackLink />
      <PendingChip />

      <View style={styles.header}>
        <Text style={[type.display, { color: colors.text }]}>{t('contacts.title')}</Text>
        <Text style={[type.body, { color: colors.textSecondary }]}>
          {t('contacts.subtitle', { village: village.data?.name_en ?? '' })}
        </Text>
      </View>

      {contacts.isPending ? (
        <ActivityIndicator accessibilityLabel={t('common.loading')} color={colors.primary} />
      ) : (contacts.data ?? []).length === 0 ? (
        <Card>
          <EmptyState icon="people" message={t('contacts.empty')} />
        </Card>
      ) : (
        <View style={styles.list}>
          {(contacts.data ?? []).map((contact) => (
            <Card key={contact.id}>
              <View style={styles.row}>
                <Avatar name={contact.name} size={40} />
                <View style={styles.rowText}>
                  <Text style={[type.bodySmall, styles.name, { color: colors.text }]}>
                    {contact.name}
                  </Text>
                  <Text style={[type.caption, { color: colors.textSecondary }]}>
                    {contact.designation}
                    {contact.phone ? ` · ${contact.phone}` : ''}
                  </Text>
                </View>
              </View>
              <View style={styles.actions}>
                <Pressable
                  onPress={() => edit(contact)}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={t('contacts.editName', { name: contact.name })}
                  style={({ pressed }) => [styles.action, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <Icon name="edit" size={16} color={colors.primary} />
                  <Text style={[type.caption, styles.actionText, { color: colors.primary }]}>
                    {t('common.edit')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => void onRemove(contact)}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={t('contacts.removeName', { name: contact.name })}
                  style={({ pressed }) => [styles.action, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <Icon name="close" size={16} color={colors.danger} />
                  <Text style={[type.caption, styles.actionText, { color: colors.danger }]}>
                    {t('common.remove')}
                  </Text>
                </Pressable>
              </View>
            </Card>
          ))}
        </View>
      )}

      <View style={styles.form}>
        <Text style={[type.bodySmall, styles.formLabel, { color: colors.textSecondary }]}>
          {t(draft.id ? 'contacts.editing' : 'contacts.addHeading')}
        </Text>

        <TextField
          label={t('contacts.name')}
          value={draft.name}
          onChangeText={(value) => setDraft({ ...draft, name: value })}
          autoCapitalize="words"
          maxLength={80}
        />

        <TextField
          label={t('contacts.designation')}
          hint={t('contacts.designationHint')}
          value={draft.designation}
          onChangeText={(value) => setDraft({ ...draft, designation: value })}
          autoCapitalize="words"
          maxLength={80}
        />

        {/* The number IS the point of the card, and it is published to the whole village
            on purpose — so it is typed the same way as a profile's, ten digits after a
            fixed +91, and checked before it can be saved. */}
        <TextField
          label={t('contacts.phone')}
          hint={t('contacts.phoneHint')}
          value={draft.phone}
          onChangeText={(value) => setDraft({ ...draft, phone: value })}
          error={phoneOk ? undefined : t('profile.edit.phoneInvalid')}
          prefix={COUNTRY_CODE}
          keyboardType="phone-pad"
          maxLength={16}
        />
      </View>

      {queued ? <Banner message={t('errors.queued')} tone="info" /> : null}
      {error ? <Banner message={t(error)} tone="danger" /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.xs },
  list: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rowText: { flex: 1, gap: 2 },
  name: { fontFamily: fontFamily.semibold, fontWeight: '600' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    minHeight: layout.tap,
    minWidth: layout.tap,
    paddingHorizontal: space.sm,
  },
  actionText: { fontFamily: fontFamily.semibold },
  form: { gap: space.md },
  formLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontFamily: fontFamily.semibold,
  },
});
