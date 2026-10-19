import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import i18n, { useTranslation } from '@/i18n';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { ListRow } from '@/components/list-row';
import { PendingChip } from '@/components/pending-chip';
import { Screen } from '@/components/screen';
import { StatusPill } from '@/components/status-pill';
import { useGeoUnit } from '@/api/geo';
import { useMyPrivate, useMyProfile } from '@/api/profile';
import { labelFor } from '@/lib/occupations';
import { useSession } from '@/store/session';
import { fontFamily, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * Profile (spec 03.6).
 *
 * Spec 03.6 lists nine sections. Two are here — Edit profile and Privacy — because the
 * other seven have nothing behind them yet: bookings, reported issues and contributions
 * arrive with Transport and Civic, Language has no screen, and Delete account is an edge
 * function in Phase 3 (spec 10.8). A row that leads nowhere is the fake data spec 01.8 #4
 * rules out, so they land as their features do.
 *
 * Sign out is not in the spec's list. It is here because there was no way to leave a
 * session at all, which on a shared phone is not a missing convenience.
 */
export default function ProfileScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();

  const { session, signOut } = useSession();
  const profile = useMyProfile(session?.user.id);
  const priv = useMyPrivate(session?.user.id);
  const village = useGeoUnit(profile.data?.village_id);

  const name = profile.data?.full_name?.trim() || '';
  const occupation = labelFor(profile.data?.occupation ?? null, t);

  const memberSince = profile.data?.created_at
    ? new Date(profile.data.created_at).toLocaleDateString(i18n.language, {
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <Screen>
      <PendingChip />

      <View style={styles.identity}>
        {name ? <Avatar name={name} size={64} standalone /> : null}
        <View style={styles.identityText}>
          <Text style={[type.display, { color: colors.text }]} numberOfLines={2}>
            {name}
          </Text>
          <Text style={[type.bodySmall, { color: colors.textSecondary }]}>
            {occupation ?? t('profile.noOccupation')}
          </Text>
        </View>
      </View>

      <Card>
        <View style={styles.factRow}>
          <Icon name="home" size={18} color={colors.textSecondary} />
          <Text style={[type.bodySmall, styles.factLabel, { color: colors.textSecondary }]}>
            {t('profile.sections.village')}
          </Text>
          <Text style={[type.bodySmall, styles.factValue, { color: colors.text }]}>
            {village.data?.name_en ?? '—'}
          </Text>
        </View>

        {/* The number is shown to its owner in full — this screen is the one place it is
            not subject to a privacy setting. The pill beside it is not decoration: until
            an SMS provider exists, nothing in the app can verify a number, and
            `is_phone_verified()` is what gates posting later.

            On two lines rather than one, unlike the village above it. A label, a
            13-character number and a pill do not fit across a 360dp phone: laid out as
            one row they fight for the same space, and the number loses — it rendered as
            an empty column with the pill squeezed onto the line above. */}
        {priv.data?.phone ? (
          <View style={styles.phoneBlock}>
            <View style={styles.factRow}>
              <Icon name="phone" size={18} color={colors.textSecondary} />
              <Text style={[type.bodySmall, { color: colors.textSecondary }]}>
                {t('profile.edit.phone')}
              </Text>
            </View>
            <View style={styles.phoneValueRow}>
              <Text style={[type.body, styles.phoneValue, { color: colors.text }]}>
                {priv.data.phone}
              </Text>
              {priv.data.phone_verified ? null : (
                <StatusPill label={t('profile.edit.unverified')} tone="warning" />
              )}
            </View>
          </View>
        ) : null}

        {memberSince ? (
          <Text style={[type.caption, { color: colors.textSecondary }]}>
            {t('profile.memberSince', { date: memberSince })}
          </Text>
        ) : null}
      </Card>

      {profile.data?.bio ? (
        <Card>
          <Text style={[type.bodySmall, { color: colors.text }]}>{profile.data.bio}</Text>
        </Card>
      ) : null}

      <View style={styles.rows}>
        <ListRow
          title={t('profile.sections.editProfile')}
          subtitle={t('profile.sections.editProfileHint')}
          leading={<Icon name="edit" size={20} color={colors.primary} />}
          drills
          onPress={() => router.push('/profile/edit')}
        />
        <ListRow
          title={t('profile.sections.privacy')}
          subtitle={t('profile.sections.privacyHint')}
          leading={<Icon name="shield" size={20} color={colors.primary} />}
          drills
          onPress={() => router.push('/profile/privacy')}
        />
      </View>

      <Button
        label={t('profile.sections.signOut')}
        variant="ghost"
        onPress={() => void signOut()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  identityText: { flex: 1, gap: 2 },
  factRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  factLabel: { flexShrink: 0 },
  factValue: { flex: 1, textAlign: 'right', fontFamily: fontFamily.semibold, fontWeight: '600' },
  phoneBlock: { gap: space.xs },
  phoneValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  phoneValue: { fontFamily: fontFamily.semibold, fontWeight: '600' },
  rows: { gap: space.sm },
});
