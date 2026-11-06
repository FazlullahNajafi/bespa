import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useTranslation } from '@/i18n';
import { BackLink } from '@/components/back-link';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { DatePicker } from '@/components/date-picker';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { useCreateTrip, useMyVehicles } from '@/api/rides';
import { useMyPrivate, useMyProfile } from '@/api/profile';
import { useGeoUnit } from '@/api/geo';
import { useSession } from '@/store/session';
import { COUNTRY_CODE, fromE164, isValidNational, toE164 } from '@/lib/phone';
import { fontFamily, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * Posting a trip (spec 04.3, target: under 45 seconds).
 *
 * Rewritten on 2026-11-06 after it was tried on a phone and was, fairly, called
 * complicated. It had fourteen fields including the whole vehicle setup, an ISO
 * `YYYY-MM-DD` text box, and a row of chips reading `11-06`, `11-07` — month-day, which
 * is not how anyone here writes a date and was ambiguous on its face.
 *
 * What changed, and why each one:
 *
 * - **The vehicle moved to its own screen** and is answered once. A driver posting their
 *   second trip of the week should not be asked again what they drive.
 * - **Where to is chips first.** Six destinations cover nearly every long-distance run
 *   out of Kargil; typing is there for the seventh, behind an "Other" chip.
 * - **The date is a calendar**, showing `06-11-2026`, with the month named above the
 *   grid. No ISO box, no numeric chips.
 * - **The time is five chips, not free text.** Spec 04.2 says departure times here are
 *   approximate by nature and the UI should not pretend otherwise, and these are the
 *   words drivers already use.
 * - **Pickup is optional and last**, where an optional field belongs.
 *
 * Six answers, four of them taps.
 */

/** Where long-distance runs out of Kargil actually go: spec 04.2's four corridors, plus
    the two local towns that are full journeys in their own right. */
const DESTINATIONS = ['Kargil', 'Leh', 'Srinagar', 'Zanskar', 'Jammu', 'Drass'];

/**
 * The driver's own village first, when it is not already one of the six.
 *
 * "Starting from" defaults to the village, which was in no chip — so the form opened
 * with nothing selected and read as unanswered, while actually being answered. Either
 * the default had to go or the chip had to exist; the default is right, so the chip
 * exists. Found on the device.
 */
function destinationsFor(village: string | null | undefined): string[] {
  const name = village?.trim();
  if (!name || DESTINATIONS.includes(name)) return DESTINATIONS;
  return [name, ...DESTINATIONS];
}

/** Spec 04.2's "departure window", as the phrases drivers use. */
const WINDOWS = ['earlyMorning', 'morning', 'afternoon', 'evening', 'night'] as const;

export default function NewTripScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();

  const { session } = useSession();
  const profile = useMyProfile(session?.user.id);
  const priv = useMyPrivate(session?.user.id);
  const village = useGeoUnit(profile.data?.village_id);

  const vehicles = useMyVehicles(session?.user.id);
  const createTrip = useCreateTrip();

  const vehicle = vehicles.data?.[0] ?? null;

  const [from, setFrom] = useState<string | null>(null);
  const [fromOther, setFromOther] = useState('');
  const [to, setTo] = useState<string | null>(null);
  const [toOther, setToOther] = useState('');
  const [date, setDate] = useState('');
  const [when, setWhen] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [seats, setSeats] = useState('');
  const [pickup, setPickup] = useState('');
  const [phone, setPhone] = useState<string | undefined>();
  const [note, setNote] = useState<{ key: string; bad: boolean } | null>(null);

  // Defaults to the driver's own village, which is where nearly every run starts.
  const fromValue =
    from === 'other' ? fromOther.trim() : (from ?? village.data?.name_en ?? '');
  const toValue = to === 'other' ? toOther.trim() : (to ?? '');

  const phoneValue = phone ?? fromE164(priv.data?.phone ?? null);
  const phoneValid = phoneValue.trim().length === 0 || isValidNational(phoneValue.trim());

  const places = destinationsFor(village.data?.name_en);

  async function publish() {
    setNote(null);

    if (!vehicle) {
      setNote({ key: 'rides.needVehicle', bad: true });
      return;
    }
    if (!fromValue || !toValue) {
      setNote({ key: 'rides.needRoute', bad: true });
      return;
    }
    if (fromValue.toLowerCase() === toValue.toLowerCase()) {
      setNote({ key: 'rides.needDifferent', bad: true });
      return;
    }
    if (!date) {
      setNote({ key: 'rides.needDate', bad: true });
      return;
    }
    const priceValue = Number(price);
    if (!price.trim() || Number.isNaN(priceValue) || priceValue < 0) {
      setNote({ key: 'rides.needPrice', bad: true });
      return;
    }
    const seatCount = Number(seats);
    if (!Number.isInteger(seatCount) || seatCount < 1) {
      setNote({ key: 'rides.needSeats', bad: true });
      return;
    }
    if (seatCount > vehicle.seats) {
      // The server refuses this too; catching it here puts the message next to the field
      // instead of making a round trip to say so.
      setNote({ key: 'rides.tooManySeats', bad: true });
      return;
    }

    const result = await createTrip.mutateAsync({
      vehicleId: vehicle.id,
      fromLabel: fromValue,
      toLabel: toValue,
      date,
      pricePerSeat: priceValue,
      seatsTotal: seatCount,
      window: when ? t(`rides.window.${when}`) : null,
      pickupNote: pickup.trim() || null,
      contactPhone: phoneValue.trim() ? toE164(phoneValue.trim()) : null,
    });

    if (result.ok) {
      router.back();
      return;
    }
    setNote({ key: `errors.${result.code}`, bad: true });
  }

  // Without a vehicle there is nothing to ask: the seat count comes from it, so the rest
  // of the form would be guesswork. One card, one button.
  if (!vehicles.isPending && !vehicle) {
    return (
      <Screen>
        <BackLink />
        <Text style={[type.display, { color: colors.text }]}>{t('rides.postTrip')}</Text>
        <Card>
          <Text style={[type.body, { color: colors.text }]}>{t('rides.needVehicle')}</Text>
        </Card>
        <Button
          label={t('rides.addVehicle')}
          onPress={() => router.push('/rides/vehicle')}
        />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <Button
          label={t('rides.publish')}
          onPress={() => void publish()}
          loading={createTrip.isPending}
          disabled={!phoneValid}
        />
      }
    >
      <BackLink />

      <Text style={[type.display, { color: colors.text }]}>{t('rides.postTrip')}</Text>
      <Banner message={t('rides.prototypeBody')} tone="danger" />

      {note ? (
        <Banner message={t(note.key)} tone={note.bad ? 'danger' : 'info'} />
      ) : null}

      {/* The vehicle, as a line rather than a form. Tap to change it. */}
      {vehicle ? (
        <Card>
          <View style={styles.vehicleRow}>
            <Icon name="car" size={18} color={colors.textSecondary} />
            <Text style={[type.bodySmall, styles.grow, { color: colors.text }]}>
              {t(`rides.vehicle.${vehicle.type}`)}
              {vehicle.registration ? ` · ${vehicle.registration}` : ''} ·{' '}
              {t('rides.vehicleSeatCount', { count: vehicle.seats })}
            </Text>
            <Button
              label={t('common.edit')}
              variant="ghost"
              onPress={() => router.push('/rides/vehicle')}
            />
          </View>
        </Card>
      ) : null}

      {/* 1 — from */}
      <Text style={[type.bodySmall, styles.heading, { color: colors.text }]}>
        {t('rides.fromWhere')}
      </Text>
      <View style={styles.chips}>
        {places.map((name) => (
          <Chip
            key={`f-${name}`}
            label={name}
            selected={from !== 'other' && fromValue === name}
            onPress={() => setFrom(name)}
          />
        ))}
        <Chip
          label={t('rides.otherPlace')}
          selected={from === 'other'}
          onPress={() => setFrom('other')}
        />
      </View>
      {from === 'other' ? (
        <TextField
          label={t('rides.from')}
          value={fromOther}
          onChangeText={setFromOther}
          autoCapitalize="words"
          autoCorrect={false}
        />
      ) : null}

      {/* 2 — to */}
      <Text style={[type.bodySmall, styles.heading, { color: colors.text }]}>
        {t('rides.toWhere')}
      </Text>
      <View style={styles.chips}>
        {places.map((name) => (
          <Chip
            key={`t-${name}`}
            label={name}
            selected={to !== 'other' && toValue === name}
            onPress={() => setTo(name)}
          />
        ))}
        <Chip
          label={t('rides.otherPlace')}
          selected={to === 'other'}
          onPress={() => setTo('other')}
        />
      </View>
      {to === 'other' ? (
        <TextField
          label={t('rides.to')}
          value={toOther}
          onChangeText={setToOther}
          autoCapitalize="words"
          autoCorrect={false}
        />
      ) : null}

      {/* 3 — the day */}
      <Text style={[type.bodySmall, styles.heading, { color: colors.text }]}>
        {t('rides.date')}
      </Text>
      <DatePicker value={date} onChange={setDate} label={t('rides.dateLabel')} />

      {/* 4 — roughly when */}
      <Text style={[type.bodySmall, styles.heading, { color: colors.text }]}>
        {t('rides.window.title')}
      </Text>
      <View style={styles.chips}>
        {WINDOWS.map((key) => (
          <Chip
            key={key}
            label={t(`rides.window.${key}`)}
            selected={when === key}
            onPress={() => setWhen(key)}
          />
        ))}
      </View>

      {/* 5 — money and seats, side by side because both are short numbers */}
      <View style={styles.pair}>
        <View style={styles.half}>
          <TextField
            label={t('rides.price')}
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
            maxLength={6}
          />
        </View>
        <View style={styles.half}>
          <TextField
            label={t('rides.seatsOnSale')}
            value={seats}
            onChangeText={setSeats}
            keyboardType="number-pad"
            maxLength={2}
          />
        </View>
      </View>

      {/* 6 — the number passengers call */}
      <TextField
        label={t('rides.phone')}
        hint={t('rides.phoneHint')}
        prefix={COUNTRY_CODE}
        value={phoneValue}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        maxLength={10}
        error={phoneValid ? undefined : t('profile.edit.phoneInvalid')}
      />

      {/* Optional, and last. */}
      <TextField
        label={t('rides.pickupArea')}
        hint={t('rides.pickupAreaHint')}
        value={pickup}
        onChangeText={setPickup}
        maxLength={160}
        autoCapitalize="sentences"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontFamily: fontFamily.semibold, fontWeight: '600', paddingTop: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  vehicleRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  grow: { flex: 1 },
  pair: { flexDirection: 'row', gap: space.sm },
  half: { flex: 1 },
});
