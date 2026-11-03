import { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useTranslation } from '@/i18n';
import { Avatar } from '@/components/avatar';
import { BackLink } from '@/components/back-link';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import {
  useDirectory,
  useMemberContact,
  useVillageContacts,
  type DirectoryMember,
} from '@/api/directory';
import { useMyAdminUnits, useMyProfile } from '@/api/profile';
import { useSession } from '@/store/session';
import { labelFor } from '@/lib/occupations';
import { fontFamily, layout, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * The village directory (spec 03.4).
 *
 * The reason to open this is rarely "who lives here" — it is "who drives", "who teaches",
 * "who runs the shop". Hence the occupation filter is the first control and not a buried
 * one, and why the occupation step was added to onboarding to feed it.
 *
 * **A number is never on this screen.** The list carries no phone column at all, and the
 * call button does not reveal one to read — it fetches the number and hands it straight to
 * the dialer, so the thing that leaves the server is used once and never rendered,
 * screenshotted or copied out. `get_member_contact` re-checks the owner's setting, logs
 * the access where its *subject* can read it, and refuses past 30 lookups a day.
 *
 * Only registered users appear (spec 03.4): Bespa keeps no census of people who have not
 * joined, which is also why an empty directory is honest rather than embarrassing.
 */

function initialsName(member: DirectoryMember) {
  return member.full_name.trim() || '?';
}

export default function DirectoryScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();

  const { session } = useSession();
  const profile = useMyProfile(session?.user.id);
  const villageId = profile.data?.village_id ?? null;

  const adminUnits = useMyAdminUnits(session?.user.id);
  const members = useDirectory(villageId);
  const contacts = useVillageContacts(villageId);
  const reveal = useMemberContact();

/**
 * Whether to draw the admin affordance. The grant decides, not the role array: since
 * migration 20261103090000 a `panchayat_admin` with no grant administers nothing, and a
 * grant names the village rather than following its holder. `super_admin` holds no
 * scoped grant and is ORed in.
 *
 * The server re-checks every write with `admins_geo`, so this governs buttons and never
 * permission — being wrong here shows a button that then refuses.
 */
  const canManage =
    Boolean(villageId) &&
    ((adminUnits.data ?? []).length > 0 ||
      (profile.data?.roles ?? []).includes('super_admin'));

  const [search, setSearch] = useState('');
  const [occupation, setOccupation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [calling, setCalling] = useState<string | null>(null);

  /**
   * Only the occupations that are actually in this village, in the order they are most
   * common. A fixed list of fourteen chips over a directory of nine people is a filter
   * that mostly filters to nothing.
   */
  const occupations = useMemo(() => {
    const counts = new Map<string, number>();
    for (const member of members.data ?? []) {
      if (member.occupation) counts.set(member.occupation, (counts.get(member.occupation) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([key]) => key);
  }, [members.data]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (members.data ?? []).filter((member) => {
      if (occupation && member.occupation !== occupation) return false;
      if (!needle) return true;
      return member.full_name.toLowerCase().includes(needle);
    });
  }, [members.data, search, occupation]);

  /**
   * Fetch the number and dial it, without ever putting it on screen.
   *
   * `tel:` rather than placing the call: Android's dialer opens with the number filled in
   * and the person presses the green button themselves. An app that dials on its own is an
   * app that can call someone by accident, and a misdial in a village of this size is a
   * social event.
   */
  /**
   * Opens the dialler, without asking Android first whether it can.
   *
   * `canOpenURL('tel:…')` answers **false** on this phone — and on any Android 11 or
   * later — unless the app declares the scheme in a `<queries>` manifest block, because
   * package visibility hides the dialler from apps that have not said they want to see
   * it. The call itself works perfectly; only the question fails. Asking produced "This
   * phone cannot place calls" on a handset with a SIM and signal, which is the sort of
   * message that teaches someone the feature is broken.
   *
   * So: try, and let the failure be the answer. The `<queries>` entry would also work,
   * but it costs a native rebuild to ask a question we do not need the answer to.
   */
  async function dial(phone: string) {
    try {
      await Linking.openURL(`tel:${phone}`);
    } catch {
      setError('directory.noDialer');
    }
  }

  async function call(member: DirectoryMember) {
    setError(null);
    setCalling(member.id);
    try {
      const result = await reveal.mutateAsync(member.id);

      if (!result.ok) {
        setError(`errors.${result.code}`);
        return;
      }
      if (!result.phone) {
        // Permitted, but there is nothing there: a profile with the setting on and no
        // number saved. Not an error, and not worth a red banner.
        setError('directory.noNumber');
        return;
      }

      await dial(result.phone);
    } catch {
      setError('errors.unknown');
    } finally {
      setCalling(null);
    }
  }

  return (
    <Screen
      footer={
        canManage ? (
          <Button
            label={t('contacts.manage')}
            variant="secondary"
            onPress={() => router.push('/directory/contacts')}
            accessibilityHint={t('contacts.manageHint')}
          />
        ) : undefined
      }
    >
      <BackLink />

      <Text style={[type.display, { color: colors.text }]}>{t('directory.title')}</Text>

      {/* The panchayat's own numbers, pinned above the villagers — these are offices, and
          public within the village by virtue of the office (spec 03.4). */}
      {(contacts.data ?? []).length > 0 ? (
        <View style={styles.group}>
          <Text style={[type.caption, styles.heading, { color: colors.textSecondary }]}>
            {t('directory.panchayat')}
          </Text>
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
                  </Text>
                </View>
                {contact.phone ? (
                  <Pressable
                    onPress={() => void dial(contact.phone!)}
                    accessibilityRole="button"
                    accessibilityLabel={t('directory.callName', { name: contact.name })}
                    style={({ pressed }) => [styles.call, { opacity: pressed ? 0.6 : 1 }]}
                  >
                    <Icon name="phone" size={18} color={colors.primary} />
                    <Text style={[type.caption, styles.callText, { color: colors.primary }]}>
                      {t('directory.call')}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      <TextField
        label={t('directory.search')}
        value={search}
        onChangeText={setSearch}
        autoCapitalize="words"
        autoCorrect={false}
      />

      {occupations.length > 1 ? (
        <View style={styles.chips}>
          {occupations.map((key) => (
            <Chip
              key={key}
              label={labelFor(key, t) ?? key}
              selected={occupation === key}
              // Tapping the lit one clears it: there is no "all" chip to hunt for.
              onPress={() => setOccupation(occupation === key ? null : key)}
            />
          ))}
        </View>
      ) : null}

      {error ? (
        <Banner
          message={t(error)}
          tone={error === 'errors.rate_limited' || error.startsWith('directory.') ? 'info' : 'danger'}
        />
      ) : null}

      {members.isPending ? (
        <ActivityIndicator accessibilityLabel={t('common.loading')} color={colors.primary} />
      ) : members.isError ? (
        <Banner
          message={t('errors.unknown')}
          action={
            <Button
              label={t('common.retry')}
              variant="secondary"
              onPress={() => void members.refetch()}
            />
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon="people"
          message={
            (members.data ?? []).length === 0 ? t('directory.empty') : t('directory.noMatches')
          }
        />
      ) : (
        <View style={styles.group}>
          {visible.map((member) => (
            <Card key={member.id}>
              <View style={styles.row}>
                <Avatar name={initialsName(member)} size={40} />
                <View style={styles.rowText}>
                  <Text style={[type.bodySmall, styles.name, { color: colors.text }]}>
                    {member.full_name}
                  </Text>
                  {member.occupation ? (
                    <Text style={[type.caption, { color: colors.textSecondary }]}>
                      {labelFor(member.occupation, t)}
                    </Text>
                  ) : null}
                </View>

                {/* Drawn from `phone_available`, which says whether a number may be had —
                    never what it is. */}
                {member.phone_available ? (
                  <Pressable
                    onPress={() => void call(member)}
                    disabled={calling !== null}
                    accessibilityRole="button"
                    accessibilityLabel={t('directory.callName', { name: member.full_name })}
                    accessibilityHint={t('directory.callHint')}
                    style={({ pressed }) => [
                      styles.call,
                      { opacity: pressed || calling === member.id ? 0.6 : 1 },
                    ]}
                  >
                    {calling === member.id ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      <>
                        <Icon name="phone" size={18} color={colors.primary} />
                        <Text style={[type.caption, styles.callText, { color: colors.primary }]}>
                          {t('directory.call')}
                        </Text>
                      </>
                    )}
                  </Pressable>
                ) : null}
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.sm },
  heading: { textTransform: 'uppercase', letterSpacing: 0.6, fontFamily: fontFamily.semibold },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rowText: { flex: 1, gap: 2 },
  name: { fontFamily: fontFamily.semibold, fontWeight: '600' },
  call: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    minHeight: layout.tap,
    minWidth: layout.tap,
    paddingHorizontal: space.sm,
  },
  callText: { fontFamily: fontFamily.semibold },
});
