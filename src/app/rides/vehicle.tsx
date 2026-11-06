import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useTranslation } from '@/i18n';
import { BackLink } from '@/components/back-link';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { useMyVehicles, useSaveVehicle, type VehicleType } from '@/api/rides';
import { useSession } from '@/store/session';
import { fontFamily, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * The driver's vehicle, on its own screen (spec 04.3, "vehicle (remembered)").
 *
 * Split out of the trip form on 2026-11-06, because together they were one scroll of
 * about fourteen fields and a driver posting their second trip of the week was being
 * asked again what they drive. This screen is answered **once**; the trip form then has
 * six questions and the 45-second target in spec 04.3 becomes plausible.
 *
 * Seats default per vehicle type, because a Xylo has six passenger seats and everyone
 * who drives one knows that — asking is a question with a known answer.
 */

/** Passenger seats, not counting the driver. */
const DEFAULT_SEATS: Record<VehicleType, number> = {
  xylo: 6,
  innova: 6,
  tempo_traveller: 12,
  bus_large: 40,
  omni: 7,
  eeco: 6,
  bus_small: 20,
  other: 4,
};

const VEHICLE_TYPES = Object.keys(DEFAULT_SEATS) as VehicleType[];

export default function VehicleScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();

  const { session } = useSession();
  const vehicles = useMyVehicles(session?.user.id);
  const save = useSaveVehicle();

  const existing = vehicles.data?.[0] ?? null;

  const [kind, setKind] = useState<VehicleType | null>(null);
  const [seats, setSeats] = useState<string | null>(null);
  const [registration, setRegistration] = useState<string | null>(null);
  const [note, setNote] = useState<{ key: string; bad: boolean } | null>(null);

  // Untouched fields show what is stored, the same shape `profile/edit.tsx` uses.
  const typeValue = kind ?? existing?.type ?? 'xylo';
  const seatsValue = seats ?? String(existing?.seats ?? DEFAULT_SEATS[typeValue]);
  const registrationValue = registration ?? existing?.registration ?? '';

  function pickType(next: VehicleType) {
    setKind(next);
    // Only overwrite the seat count while the driver has not set one themselves —
    // a twelve-seat Tempo that someone sells ten seats on must stay at ten.
    if (seats === null) setSeats(String(DEFAULT_SEATS[next]));
  }

  async function onSave() {
    setNote(null);
    const count = Number(seatsValue);
    if (!Number.isInteger(count) || count < 1 || count > 60) {
      setNote({ key: 'rides.needSeats', bad: true });
      return;
    }

    const result = await save.mutateAsync({
      type: typeValue,
      seats: count,
      registration: registrationValue.trim() || null,
      vehicleId: existing?.id ?? null,
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
          label={t('rides.saveVehicle')}
          onPress={() => void onSave()}
          loading={save.isPending}
        />
      }
    >
      <BackLink />

      <Text style={[type.display, { color: colors.text }]}>{t('rides.vehicleTitle')}</Text>
      <Text style={[type.bodySmall, { color: colors.textSecondary }]}>
        {t('rides.vehicleIntro')}
      </Text>

      {note ? (
        <Banner message={t(note.key)} tone={note.bad ? 'danger' : 'info'} />
      ) : null}

      <Text style={[type.bodySmall, styles.heading, { color: colors.text }]}>
        {t('rides.vehicleType')}
      </Text>
      <View style={styles.chips}>
        {VEHICLE_TYPES.map((key) => (
          <Chip
            key={key}
            label={t(`rides.vehicle.${key}`)}
            selected={typeValue === key}
            onPress={() => pickType(key)}
          />
        ))}
      </View>

      <TextField
        label={t('rides.vehicleSeats')}
        hint={t('rides.vehicleSeatsHint')}
        value={seatsValue}
        onChangeText={setSeats}
        keyboardType="number-pad"
        maxLength={2}
      />

      <TextField
        label={t('rides.registration')}
        hint={t('rides.registrationHint')}
        value={registrationValue}
        onChangeText={setRegistration}
        maxLength={20}
        autoCapitalize="characters"
        autoCorrect={false}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontFamily: fontFamily.semibold, fontWeight: '600', paddingTop: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
});
