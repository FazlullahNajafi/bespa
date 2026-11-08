import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { BackLink } from '@/components/back-link';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Avatar } from '@/components/avatar';
import { AVATAR_PRESETS } from '@/components/avatar-art';
import { Chip } from '@/components/chip';
import { PendingChip } from '@/components/pending-chip';
import { Screen } from '@/components/screen';
import { StatusPill } from '@/components/status-pill';
import { TextField } from '@/components/text-field';
import { useMyPrivate, useMyProfile, useUpdateMyProfile } from '@/api/profile';
import { OCCUPATIONS, isKnownOccupation, type Occupation } from '@/lib/occupations';
import { COUNTRY_CODE, fromE164, isValidNational, toE164 } from '@/lib/phone';
import { useSession } from '@/store/session';
import { fontFamily, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * Profile edit (spec 03.6).
 *
 * Editable here: name, occupation, bio, phone. Not avatar — there is no `media` table and
 * no storage bucket yet, so an upload control would be a button that cannot work; initials
 * stand in until the Phase 1 image pipeline lands. Not village either: that is
 * `set_my_village`, rate-limited to once per 30 days and audited, and it belongs with the
 * picker rather than next to a free-text field.
 *
 * **Deviation from spec 03.6 — the phone is saved unverified.** The spec has the number
 * verified by OTP. There is no SMS provider and no India DLT registration (spec 09.4), so
 * nothing in the app can send a code today. The choice was between no phone field at all
 * and a saved-but-unverified number, and the unverified number is worth more: it is what
 * the privacy step's "who can see my number" setting is about, and it is half of the
 * Phase 0 exit criterion. It is labelled "Not verified" wherever it appears, the database
 * clears that flag on any change, and `is_phone_verified()` still refuses everything it
 * gates.
 */


/** Which occupation chip is lit. `'other'` means the free-text box decides. */
type Pick = Occupation | 'other' | null;

export default function EditProfileScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();

  const { session } = useSession();
  const profile = useMyProfile(session?.user.id);
  const priv = useMyPrivate(session?.user.id);
  const update = useUpdateMyProfile();

  // Server values are the initial state, and `undefined` means "not edited" — so a field
  // the user has not touched still follows the server if it changes underneath them,
  // while a field they have cleared stays cleared rather than snapping back.
  const [name, setName] = useState<string | undefined>();
  const [pick, setPick] = useState<Pick | undefined>();
  const [otherText, setOtherText] = useState<string | undefined>();
  const [bio, setBio] = useState<string | undefined>();
  const [phone, setPhone] = useState<string | undefined>();
  // `undefined` means untouched, `null` means "back to initials" — the two are
  // different answers and collapsing them would make clearing a picture impossible.
  const [avatar, setAvatar] = useState<string | null | undefined>();

  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [queued, setQueued] = useState(false);

  const stored = profile.data?.occupation ?? null;

  // "other + free text" in spec 03.6: anything stored outside the fixed list IS the free
  // text, so such a value selects Other and prefills the box with itself. Which chip is
  // lit is kept separate from what the box holds — otherwise selecting Other with an
  // empty box has no state to be in.
  const storedPick: Pick = stored === null ? null : isKnownOccupation(stored) ? stored : 'other';
  const currentPick = pick === undefined ? storedPick : pick;
  const isOther = currentPick === 'other';
  const freeText = otherText === undefined ? (storedPick === 'other' ? (stored ?? '') : '') : otherText;

  const nameValue = name === undefined ? (profile.data?.full_name ?? '') : name;
  const bioValue = bio === undefined ? (profile.data?.bio ?? '') : bio;
  // The box holds the national digits; `+91` is a fixed label beside it, never typed.
  // See `lib/phone.ts` — the column stays E.164 because that is what an SMS gateway
  // will want, but nobody should have to know that to fill in a form.
  const phoneValue = phone === undefined ? fromE164(priv.data?.phone) : phone;
  const avatarValue = avatar === undefined ? (profile.data?.avatar_preset ?? null) : avatar;

  /**
   * What Save would actually write, normalised the same way `onSave` normalises it —
   * trimmed, and empty collapsed to null. Comparing the raw field values instead would
   * call a trailing space a change and queue a write that alters nothing.
   */
  const edited = {
    full_name: nameValue.trim(),
    occupation: isOther ? freeText.trim() || null : currentPick,
    bio: bioValue.trim() || null,
    phone: toE164(phoneValue),
  };

  // The phone is compared as typed, not as it would be stored. `toE164` returns null for
  // a half-finished number, so comparing stored values would call "9419" the same as an
  // empty field — leaving Save disabled on a number that is wrong, with nothing to press
  // and no error to read.
  const phoneDirty = phoneValue.trim() !== fromE164(priv.data?.phone);

  const avatarDirty = avatarValue !== (profile.data?.avatar_preset ?? null);

  const dirty =
    edited.full_name !== (profile.data?.full_name ?? '') ||
    edited.occupation !== stored ||
    edited.bio !== (profile.data?.bio ?? null) ||
    avatarDirty ||
    phoneDirty;

  async function onSave() {
    const trimmedName = edited.full_name;
    const next: typeof errors = {};

    if (!trimmedName) next.name = t('profile.edit.nameRequired');
    // Checked here as well as by the column's CHECK constraint, because a constraint
    // violation arrives as an unmapped Postgres error — the user would see "something
    // went wrong" for a number one digit short.
    if (phoneValue.trim() && !isValidNational(phoneValue)) {
      next.phone = t('profile.edit.phoneInvalid');
    }

    setErrors(next);
    if (next.name || next.phone) return;

    setFailure(null);
    setQueued(false);

    const result = await update.mutateAsync(
      // Only sent when it changed. An absent key leaves the column alone, so saving a
      // bio never disturbs a picture.
      avatarDirty ? { ...edited, avatar_preset: avatarValue } : edited,
    );

    if (result.ok) {
      router.back();
      return;
    }
    // Queued is not failure. The edit is durable and will send; say so and stay put,
    // because leaving would show the old values on the profile with no explanation.
    if ('queued' in result) {
      setQueued(true);
      return;
    }
    setFailure(`errors.${result.code}`);
  }

  if (profile.isPending) {
    return (
      <Screen>
        <BackLink />
        <ActivityIndicator accessibilityLabel={t('common.loading')} color={colors.primary} />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <Button
          label={t('common.save')}
          onPress={onSave}
          loading={update.isPending}
          // Nothing to save is not an action. Leaving it live invites a tap that queues
          // a write identical to what is already stored — and offline that write sits in
          // the outbox and shows a pending chip, for no change at all.
          disabled={!dirty}
          accessibilityHint={dirty ? undefined : t('profile.edit.nothingToSave')}
        />
      }
    >
      <BackLink />
      <PendingChip />

      <View style={styles.header}>
        <Text style={[type.display, { color: colors.text }]}>{t('profile.edit.title')}</Text>
        <Text style={[type.bodySmall, { color: colors.textSecondary }]}>
          {t('profile.edit.subtitle')}
        </Text>
      </View>

      {/* The picture. Initials first, because they are the default and not a gap —
          a directory that requires everyone to supply a face is one half the village
          will not join (spec 03.4 publishes a new profile to the whole village).
          Illustrations are offered and never guessed: nothing can tell from a name
          whether somebody wears a hijab. */}
      <Text style={[type.bodySmall, styles.heading, { color: colors.text }]}>
        {t('profile.edit.picture')}
      </Text>
      <View style={styles.avatars}>
        <Pressable
          onPress={() => setAvatar(null)}
          accessibilityRole="radio"
          accessibilityState={{ selected: avatarValue === null }}
          accessibilityLabel={t('profile.edit.avatarInitials')}
          style={[
            styles.avatarChoice,
            avatarValue === null && { borderColor: colors.primary },
            { borderColor: avatarValue === null ? colors.primary : colors.borderSoft },
          ]}
        >
          <Avatar name={nameValue || '?'} size={52} />
        </Pressable>

        {AVATAR_PRESETS.map((preset) => (
          <Pressable
            key={preset}
            onPress={() => setAvatar(preset)}
            accessibilityRole="radio"
            accessibilityState={{ selected: avatarValue === preset }}
            accessibilityLabel={t(`profile.edit.avatarArt.${preset}`)}
            style={[
              styles.avatarChoice,
              { borderColor: avatarValue === preset ? colors.primary : colors.borderSoft },
            ]}
          >
            <Avatar name={nameValue || '?'} size={52} preset={preset} />
          </Pressable>
        ))}
      </View>

      <TextField
        label={t('profile.edit.name')}
        value={nameValue}
        onChangeText={setName}
        error={errors.name}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
      />

      <View style={styles.group}>
        <Text style={[type.bodySmall, styles.groupLabel, { color: colors.textSecondary }]}>
          {t('profile.edit.occupation')}
        </Text>
        <View style={styles.chips}>
          {OCCUPATIONS.map((key) => (
            <Chip
              key={key}
              label={t(`profile.occupations.${key}`)}
              selected={currentPick === key}
              // Tapping the selected one clears it: not every villager has an occupation
              // to name, and there is no other way back to none.
              onPress={() => setPick(currentPick === key ? null : key)}
            />
          ))}
          <Chip
            label={t('profile.occupations.other')}
            selected={isOther}
            onPress={() => setPick(isOther ? null : 'other')}
          />
        </View>

        {isOther ? (
          <TextField
            label={t('profile.edit.occupationOther')}
            hint={t('profile.edit.occupationOtherHint')}
            value={freeText}
            onChangeText={setOtherText}
            autoCapitalize="sentences"
          />
        ) : null}
      </View>

      <TextField
        label={t('profile.edit.bio')}
        hint={t('profile.edit.bioHint')}
        value={bioValue}
        onChangeText={setBio}
        multiline
        numberOfLines={3}
        maxLength={280}
        autoCapitalize="sentences"
      />

      <View style={styles.group}>
        <TextField
          label={t('profile.edit.phone')}
          hint={t('profile.edit.phoneHint')}
          value={phoneValue}
          onChangeText={setPhone}
          error={errors.phone}
          prefix={COUNTRY_CODE}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          // Ten digits plus the slack for a pasted number with spaces, which
          // `toNational` strips.
          maxLength={16}
        />
        {phoneValue.trim() ? (
          <View style={styles.verifyRow}>
            <StatusPill label={t('profile.edit.unverified')} tone="warning" />
            <Text style={[type.caption, styles.verifyNote, { color: colors.textSecondary }]}>
              {t('profile.edit.unverifiedNote')}
            </Text>
          </View>
        ) : null}
      </View>

      {queued ? <Banner message={t('errors.queued')} tone="info" /> : null}
      {failure ? <Banner message={t(failure)} tone="danger" /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontFamily: fontFamily.semibold, fontWeight: '600', paddingTop: space.sm },
  avatars: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  avatarChoice: { borderWidth: 2, borderRadius: 32, padding: 3 },
  header: { gap: space.xs },
  group: { gap: space.sm },
  groupLabel: { fontFamily: fontFamily.semibold, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  verifyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  verifyNote: { flex: 1 },
});
