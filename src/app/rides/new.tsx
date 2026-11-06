import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useTranslation } from '@/i18n';
import { BackLink } from '@/components/back-link';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import {
  useCreateTrip,
  useMyVehicles,
  useSaveVehicle,
  type VehicleType,
} from '@/api/rides';
import { useMyPrivate, useMyProfile } from '@/api/profile';
import { useGeoUnit } from '@/api/geo';
import { useSession } from '@/store/session';
import { COUNTRY_CODE, fromE164, isValidNational, toE164 } from '@/lib/phone';
import { fontFamily, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * Posting a trip (spec 04.3, target: under 45 seconds).
 *
 * The vehicle is saved separately and remembered, which is what makes the second trip
 * fast — spec 04.3 says "vehicle (remembered)" and the seat count has to come from
 * somewhere the driver is not retyping every week.
 *
 * **The destinations are chips, not free typing**, for the corridors that matter. Spec
 * 04.2 names four: Kashmir, Leh, Zanskar, Jammu. Free text is still allowed because a
 * driver going somewhere else should not be blocked, but a chip is one tap and it keeps
 * "Leh" from becoming "leh", "Leh town" and "LEH" across three rows of a board people
 * are scanning.
 *
 * **The date is typed, not picked.** A date picker means
 * `@react-native-community/datetimepicker`, which is native code and therefore a new
 * build — the same trade the notice composer made with its four duration chips. Here the
 * day matters exactly, so the next-fourteen-days chips do the common case and the field
 * takes anything else.
 */

const CORRIDORS = ['Kargil', 'Leh', 'Srinagar', 'Zanskar', 'Jammu', 'Drass'];

const VEHICLE_TYPES: VehicleType[] = [
  'xylo', 'innova', 'tempo_traveller', 'bus_large', 'omni', 'eeco', 'bus_small', 'other',
];

/** The next fourteen days as ISO dates — spec 04.2's strip, as chips. */
function nextDays(count: number): string[] {
  const out: string[] = [];
  const base = new Date();
  for (let i = 0; i < count; i += 1) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export default function NewTripScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();

  const { session } = useSession();
  const me = session?.user.id ?? null;
  const profile = useMyProfile(session?.user.id);
  const priv = useMyPrivate(session?.user.id);
  const village = useGeoUnit(profile.data?.village_id);

  const vehicles = useMyVehicles(me);
  const saveVehicle = useSaveVehicle();
  const createTrip = useCreateTrip();

  const vehicle = vehicles.data?.[0] ?? null;

  const [vType, setVType] = useState<VehicleType>('xylo');
  const [vSeats, setVSeats] = useState('6');
  const [vReg, setVReg] = useState('');

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [date, setDate] = useState('');
  const [when, setWhen] = useState('');
  const [price, setPrice] = useState('');
  const [seats, setSeats] = useState('');
  const [pickup, setPickup] = useState('');
  const [phone, setPhone] = useState<string | undefined>();
  const [note, setNote] = useState<{ key: string; bad: boolean } | null>(null);

  const days = useMemo(() => nextDays(14), []);
  const phoneValue = phone ?? fromE164(priv.data?.phone ?? null);
  const phoneValid = phoneValue.trim().length === 0 || isValidNational(phoneValue.trim());

  // Defaulting "from" to the driver's own village is the common case and costs one tap.
  const fromValue = from || village.data?.name_en || '';

  async function onSaveVehicle() {
    setNote(null);
    const seatCount = Number(vSeats);
    if (!Number.isInteger(seatCount) || seatCount < 1 || seatCount > 60) {
      setNote({ key: 'rides.needSeats', bad: true });
      return;
    }
    const result = await saveVehicle.mutateAsync({
      type: vType,
      seats: seatCount,
      registration: vReg.trim() || null,
      vehicleId: vehicle?.id ?? null,
    });
    setNote(
      result.ok
        ? { key: 'rides.vehicleSaved', bad: false }
        : { key: `errors.${result.code}`, bad: true },
    );
  }

  async function publish() {
    setNote(null);
    if (!vehicle) {
      setNote({ key: 'rides.needVehicle', bad: true });
      return;
    }
    if (!fromValue.trim() || !to.trim()) {
      setNote({ key: 'rides.needRoute', bad: true });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
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

    const result = await createTrip.mutateAsync({
      vehicleId: vehicle.id,
      fromLabel: fromValue.trim(),
      toLabel: to.trim(),
      date: date.trim(),
      pricePerSeat: priceValue,
      seatsTotal: seatCount,
      window: when.trim() || null,
      pickupNote: pickup.trim() || null,
      contactPhone: phoneValue.trim() ? toE164(phoneValue.trim()) : null,
    });

    if (result.ok) {
      router.back();
      return;
    }
    setNote({ key: `errors.${result.code}`, bad: true });
  }

  return (
    <Screen
      footer={
        <Button
          label={t('rides.publish')}
          onPress={() => void publish()}
          loading={createTrip.isPending}
          disabled={!vehicle || !phoneValid}
        />
      }
    >
      <BackLink />

      <Text style={[type.display, { color: colors.text }]}>{t('rides.postTrip')}</Text>
      <Banner message={t('rides.prototypeBody')} tone="danger" />

      {note ? (
        <Banner message={t(note.key)} tone={note.bad ? 'danger' : 'info'} />
      ) : null}

      {/* -------- vehicle, remembered -------- */}
      <Text style={[type.bodySmall, styles.heading, { color: colors.text }]}>
        {t('rides.vehicleTitle')}
      </Text>
      {vehicle ? (
        <Text style={[type.caption, { color: colors.textSecondary }]}>
          {t(`rides.vehicle.${vehicle.type}`)}
          {vehicle.registration ? ` · ${vehicle.registration}` : ''} ·{' '}
          {t('rides.seatsFree', { count: vehicle.seats })}
        </Text>
      ) : null}

      <Text style={[type.caption, { color: colors.textSecondary }]}>
        {t('rides.vehicleType')}
      </Text>
      <View style={styles.chips}>
        {VEHICLE_TYPES.map((key) => (
          <Chip
            key={key}
            label={t(`rides.vehicle.${key}`)}
            selected={vType === key}
            onPress={() => setVType(key)}
          />
        ))}
      </View>
      <TextField
        label={t('rides.vehicleSeats')}
        value={vSeats}
        onChangeText={setVSeats}
        keyboardType="number-pad"
        maxLength={2}
      />
      <TextField
        label={t('rides.registration')}
        hint={t('rides.registrationHint')}
        value={vReg}
        onChangeText={setVReg}
        maxLength={20}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      <Button
        label={t('rides.saveVehicle')}
        variant="secondary"
        loading={saveVehicle.isPending}
        onPress={() => void onSaveVehicle()}
      />

      {/* -------- the trip -------- */}
      <Text style={[type.bodySmall, styles.heading, { color: colors.text }]}>
        {t('rides.route')}
      </Text>
      <TextField
        label={t('rides.from')}
        value={fromValue}
        onChangeText={setFrom}
        autoCapitalize="words"
        autoCorrect={false}
      />
      <View style={styles.chips}>
        {CORRIDORS.map((name) => (
          <Chip key={`f-${name}`} label={name} selected={fromValue === name} onPress={() => setFrom(name)} />
        ))}
      </View>

      <TextField
        label={t('rides.to')}
        value={to}
        onChangeText={setTo}
        autoCapitalize="words"
        autoCorrect={false}
      />
      <View style={styles.chips}>
        {CORRIDORS.map((name) => (
          <Chip key={`t-${name}`} label={name} selected={to === name} onPress={() => setTo(name)} />
        ))}
      </View>

      <Text style={[type.bodySmall, styles.heading, { color: colors.text }]}>
        {t('rides.date')}
      </Text>
      <View style={styles.chips}>
        {days.map((day) => (
          <Chip
            key={day}
            label={day.slice(5)}
            selected={date === day}
            onPress={() => setDate(day)}
          />
        ))}
      </View>
      <TextField
        label={t('rides.date')}
        hint={t('rides.dateHint')}
        value={date}
        onChangeText={setDate}
        maxLength={10}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <TextField
        label={t('rides.window')}
        hint={t('rides.windowHint')}
        value={when}
        onChangeText={setWhen}
        maxLength={60}
        autoCapitalize="sentences"
      />
      <TextField
        label={t('rides.price')}
        value={price}
        onChangeText={setPrice}
        keyboardType="numeric"
        maxLength={6}
      />
      <TextField
        label={t('rides.seatsOnSale')}
        value={seats}
        onChangeText={setSeats}
        keyboardType="number-pad"
        maxLength={2}
      />
      <TextField
        label={t('rides.pickupArea')}
        hint={t('rides.pickupHint')}
        value={pickup}
        onChangeText={setPickup}
        maxLength={160}
        autoCapitalize="sentences"
      />
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontFamily: fontFamily.semibold, fontWeight: '600', paddingTop: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
});
