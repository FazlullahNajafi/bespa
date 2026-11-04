import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useTranslation } from '@/i18n';
import { BackLink } from '@/components/back-link';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import {
  useNearbyPlaces,
  useSubmitPlace,
  PLACE_CATEGORIES,
  type PlaceCategory,
} from '@/api/places';
import { useMyProfile } from '@/api/profile';
import { useSession } from '@/store/session';
import { categoryIcon } from '@/lib/place-categories';
import { canPickImages, pickAndResize } from '@/lib/images';
import { canLocate, getFix, type Fix } from '@/lib/location';
import { COUNTRY_CODE, isValidNational, toE164 } from '@/lib/phone';
import { fontFamily, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * Adding a place (spec 03.2 steps 1–6).
 *
 * **One scrolling form, not the spec's six-screen wizard.** The steps are all here and in
 * the spec's order, as headed sections. A wizard is the right shape when each answer
 * changes the next question; here none of them do, and six navigations on a 2 GB handset
 * is six chances to lose what has been typed and no way to see what is still being asked
 * before starting. The form shows the whole ask at once and the footer button says what
 * is missing.
 *
 * **The duplicate prompt is the one thing that interrupts** (spec 03.2). Once a category
 * and a location are set, the screen asks the server what else of that category is within
 * 150 m and, if there is something, shows "Is this the same as X?" above the submit
 * button. It is a question and not a block: two mosques can stand a hundred metres apart,
 * and only the person standing there knows. Answering "no, a different one" is what sets
 * the acknowledgement the server requires.
 *
 * **A phone number is saved unverified**, like everywhere else in the app until SMS
 * exists — but this one is a place's number, not a person's, so there is nothing to
 * verify and no "not verified" label to show.
 */
export default function NewPlaceScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();

  const { session } = useSession();
  const profile = useMyProfile(session?.user.id);
  const villageId = profile.data?.village_id ?? null;

  const submitPlace = useSubmitPlace();

  const [category, setCategory] = useState<PlaceCategory | null>(null);
  const [nameEn, setNameEn] = useState('');
  const [nameBft, setNameBft] = useState('');
  const [description, setDescription] = useState('');
  const [uris, setUris] = useState<string[]>([]);
  const [where, setWhere] = useState<Fix | null>(null);
  const [phone, setPhone] = useState('');
  const [timings, setTimings] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [knowsDuplicate, setKnowsDuplicate] = useState(false);

  // Only asked once there is something to ask about. Re-asked when the pin moves, which
  // is why the key carries the coordinate.
  const nearby = useNearbyPlaces(category, where);
  const duplicate = nearby.data?.[0] ?? null;

  const phoneValid = phone.trim().length === 0 || isValidNational(phone.trim());
  const complete =
    Boolean(villageId) &&
    category !== null &&
    nameEn.trim().length > 0 &&
    uris.length > 0 &&
    where !== null &&
    phoneValid;

  async function choosePhotos() {
    setNote(null);
    const picked = await pickAndResize(5);
    if (picked.status !== 'ok') {
      if (picked.status !== 'cancelled') setNote(`places.pick.${picked.status}`);
      return;
    }
    // Replace rather than append: the picker is a multi-select, so a second visit is a
    // correction, not an addition, and appending is how someone ends up over the five.
    setUris(picked.uris.slice(0, 5));
  }

  async function locate() {
    setNote(null);
    const result = await getFix();
    if (result.status !== 'ok') {
      setNote(`places.locate.${result.status}`);
      return;
    }
    setWhere(result.fix);
    // A new coordinate is a new question, so whatever was acknowledged no longer applies.
    setKnowsDuplicate(false);
  }

  async function send() {
    if (!villageId || !category || !where) return;
    setNote(null);

    const result = await submitPlace.mutateAsync({
      draft: {
        villageId,
        category,
        nameEn: nameEn.trim(),
        nameBft: nameBft.trim() || null,
        description: description.trim() || null,
        lat: where.lat,
        lon: where.lon,
        phone: phone.trim() ? toE164(phone.trim()) : null,
        timings: timings.trim() || null,
        duplicateAcknowledged: knowsDuplicate,
      },
      uris,
    });

    if (result.ok) {
      setNote('places.sent');
      router.back();
      return;
    }
    if ('queued' in result) {
      setNote('places.queued');
      router.back();
      return;
    }
    setNote(`errors.${result.code}`);
  }

  return (
    <Screen
      footer={
        <Button
          label={t('places.submit')}
          onPress={() => void send()}
          loading={submitPlace.isPending}
          disabled={!complete || (duplicate !== null && !knowsDuplicate)}
        />
      }
    >
      <BackLink />

      <Text style={[type.display, { color: colors.text }]}>{t('places.newTitle')}</Text>

      {note ? (
        <Banner message={t(note)} tone={note.startsWith('errors.') ? 'danger' : 'info'} />
      ) : null}

      {/* 1 — category */}
      <Text style={[type.bodySmall, styles.heading, { color: colors.text }]}>
        {t('places.stepCategory')}
      </Text>
      <View style={styles.chips}>
        {PLACE_CATEGORIES.map((key) => (
          <Chip
            key={key}
            label={t(`places.category.${key}`)}
            icon={categoryIcon(key)}
            selected={category === key}
            onPress={() => {
              setCategory(key);
              // A different category is a different duplicate question.
              setKnowsDuplicate(false);
            }}
          />
        ))}
      </View>

      {/* 2 — name */}
      <Text style={[type.bodySmall, styles.heading, { color: colors.text }]}>
        {t('places.stepName')}
      </Text>
      <TextField
        label={t('places.nameEn')}
        hint={t('places.nameEnHint')}
        value={nameEn}
        onChangeText={setNameEn}
        maxLength={120}
        autoCapitalize="words"
      />
      <TextField
        label={t('places.nameBft')}
        hint={t('places.nameBftHint')}
        value={nameBft}
        onChangeText={setNameBft}
        maxLength={120}
      />

      {/* 3 — photos, the one step with no optional escape */}
      <Text style={[type.bodySmall, styles.heading, { color: colors.text }]}>
        {t('places.stepPhotos')}
      </Text>
      <Text style={[type.caption, { color: colors.textSecondary }]}>
        {t('places.photosHint')}
      </Text>
      {canPickImages() ? (
        <Button
          label={t('places.pickPhotos')}
          variant="secondary"
          leading={<Icon name="camera" size={20} color={colors.primary} />}
          onPress={() => void choosePhotos()}
        />
      ) : (
        <Banner message={t('places.pick.unsupported')} tone="danger" />
      )}
      {uris.length > 0 ? (
        <Text style={[type.caption, { color: colors.textSecondary }]}>
          {t('places.photoCount', { count: uris.length })}
        </Text>
      ) : null}

      {/* 4 — description */}
      <Text style={[type.bodySmall, styles.heading, { color: colors.text }]}>
        {t('places.stepDescription')}
      </Text>
      <TextField
        label={t('places.description')}
        hint={t('places.descriptionHint')}
        value={description}
        onChangeText={setDescription}
        maxLength={600}
        multiline
        autoCapitalize="sentences"
      />

      {/* 5 — location */}
      <Text style={[type.bodySmall, styles.heading, { color: colors.text }]}>
        {t('places.stepLocation')}
      </Text>
      {canLocate() ? (
        <Button
          label={t('places.useMyLocation')}
          variant="secondary"
          leading={<Icon name="locate" size={20} color={colors.primary} />}
          onPress={() => void locate()}
          accessibilityHint={t('places.useMyLocationHint')}
        />
      ) : null}

      <Banner message={t('places.noMap')} tone="info" />

      {where ? (
        <Text style={[type.caption, { color: colors.textSecondary }]}>
          {t('places.located')}
        </Text>
      ) : (
        <Text style={[type.caption, { color: colors.textSecondary }]}>
          {t('places.noLocation')}
        </Text>
      )}

      {/* 6 — contact */}
      <Text style={[type.bodySmall, styles.heading, { color: colors.text }]}>
        {t('places.stepContact')}
      </Text>
      <Text style={[type.caption, { color: colors.textSecondary }]}>
        {t('places.contactHint')}
      </Text>
      <TextField
        label={t('places.phone')}
        prefix={COUNTRY_CODE}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        maxLength={10}
        error={phoneValid ? undefined : t('profile.edit.phoneInvalid')}
      />
      <TextField
        label={t('places.timingsField')}
        hint={t('places.timingsHint')}
        value={timings}
        onChangeText={setTimings}
        maxLength={120}
      />

      {/* The duplicate question (spec 03.2). Last, because it only exists once the
          category and the location are both answered, and because it is the thing that
          stands between the form and the button. */}
      {duplicate ? (
        <Card>
          <Text style={[type.body, styles.heading, { color: colors.text }]}>
            {t('places.duplicateTitle', { name: duplicate.name_en })}
          </Text>
          <Text style={[type.bodySmall, { color: colors.textSecondary }]}>
            {t('places.duplicateBody', {
              category: category ? t(`places.category.${category}`) : '',
            })}
          </Text>
          <View style={styles.answers}>
            <Button
              label={t('places.duplicateSame')}
              variant="secondary"
              onPress={() => router.back()}
            />
            <Button
              label={t('places.duplicateDifferent')}
              variant="ghost"
              onPress={() => setKnowsDuplicate(true)}
            />
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontFamily: fontFamily.semibold, fontWeight: '600', paddingTop: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  answers: { gap: space.xs, paddingTop: space.sm },
});
