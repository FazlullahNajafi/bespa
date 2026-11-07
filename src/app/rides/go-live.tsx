import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
  useEndLive,
  useGoLive,
  useLiveBoard,
  useMyVehicles,
  useSetLiveSeats,
} from '@/api/rides';
import { useMyPrivate, useMyProfile } from '@/api/profile';
import { useGeoUnit } from '@/api/geo';
import { useSession } from '@/store/session';
import { COUNTRY_CODE, fromE164, isValidNational, toE164 } from '@/lib/phone';
import { fontFamily, radius, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * "Go live" — spec 04.4's three taps.
 *
 * Pick route, set seats with a big stepper, go. Nothing else: this is the screen a
 * driver uses while sitting at the stand with the engine running, and every extra field
 * is a reason not to bother.
 *
 * **The stepper is buttons, not a keyboard.** Seats free is a number between zero and
 * about six, it changes several times while waiting, and opening a keyboard to change a
 * 4 to a 3 is the difference between a board that stays current and one that does not.
 * The −/+ controls are 56pt.
 *
 * **While live, the same screen becomes the controls.** Spec 04.4 wants a persistent
 * notification with −1 seat and Departed; a notification action needs native work this
 * build does not have, so the screen itself carries those two controls and says the van
 * drops off by itself in 45 minutes. The auto-expiry is what makes the missing
 * notification survivable — a driver who forgets is corrected by the clock.
 */

const DESTINATIONS = ['Kargil', 'Baroo', 'Minjee', 'Trespone', 'Choskore', 'Drass'];

export default function GoLiveScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();

  const { session } = useSession();
  const me = session?.user.id ?? null;
  const profile = useMyProfile(session?.user.id);
  const priv = useMyPrivate(session?.user.id);
  const village = useGeoUnit(profile.data?.village_id);

  const vehicles = useMyVehicles(session?.user.id);
  const board = useLiveBoard(true);
  const goLive = useGoLive();
  const setSeats = useSetLiveSeats();
  const endLive = useEndLive();

  const vehicle = vehicles.data?.[0] ?? null;
  const mine = useMemo(
    () => (board.data ?? []).find((ride) => ride.driver_id === me) ?? null,
    [board.data, me],
  );

  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [seats, setSeatsCount] = useState(4);
  const [fare, setFare] = useState('');
  const [stand, setStand] = useState('');
  const [phone, setPhone] = useState<string | undefined>();
  const [note, setNote] = useState<{ key: string; bad: boolean } | null>(null);

  const places = useMemo(() => {
    const name = village.data?.name_en?.trim();
    if (!name || DESTINATIONS.includes(name)) return DESTINATIONS;
    return [name, ...DESTINATIONS];
  }, [village.data?.name_en]);

  const fromValue = from ?? village.data?.name_en ?? '';
  const phoneValue = phone ?? fromE164(priv.data?.phone ?? null);
  const phoneValid = phoneValue.trim().length === 0 || isValidNational(phoneValue.trim());

  const cap = vehicle?.seats ?? 6;

  async function start() {
    setNote(null);
    if (!vehicle) {
      setNote({ key: 'rides.needVehicle', bad: true });
      return;
    }
    if (!fromValue || !to) {
      setNote({ key: 'rides.needRoute', bad: true });
      return;
    }
    if (fromValue.toLowerCase() === to.toLowerCase()) {
      setNote({ key: 'rides.needDifferent', bad: true });
      return;
    }

    const result = await goLive.mutateAsync({
      vehicleId: vehicle.id,
      fromLabel: fromValue,
      toLabel: to,
      seatsFree: seats,
      fare: fare.trim() ? Number(fare) : null,
      standNote: stand.trim() || null,
      contactPhone: phoneValue.trim() ? toE164(phoneValue.trim()) : null,
    });

    setNote(
      result.ok
        ? { key: 'rides.live', bad: false }
        : { key: `errors.${result.code}`, bad: true },
    );
  }

  if (!vehicles.isPending && !vehicle) {
    return (
      <Screen>
        <BackLink />
        <Text style={[type.display, { color: colors.text }]}>{t('rides.board.goLive')}</Text>
        <Card>
          <Text style={[type.body, { color: colors.text }]}>{t('rides.needVehicle')}</Text>
        </Card>
        <Button label={t('rides.addVehicle')} onPress={() => router.push('/rides/vehicle')} />
      </Screen>
    );
  }

  // ---- already live: the screen becomes the two controls --------------------
  if (mine) {
    return (
      <Screen>
        <BackLink />
        <Text style={[type.display, { color: colors.text }]}>{t('rides.live')}</Text>

        <Card>
          <Text style={[type.body, styles.bold, { color: colors.text }]}>
            {mine.from_label} → {mine.to_label}
          </Text>
          <Text style={[type.bodySmall, { color: colors.textSecondary }]}>
            {t('rides.board.seatsLeft', { count: mine.seats_free })}
            {mine.claimed > 0
              ? ` · ${t('rides.board.claimed', { count: mine.claimed })}`
              : ''}
          </Text>
        </Card>

        <Banner message={t('rides.board.goLiveIntro')} tone="info" />

        <Button
          label={t('rides.minusSeat')}
          variant="secondary"
          loading={setSeats.isPending}
          onPress={() =>
            void setSeats.mutateAsync({
              liveId: mine.id,
              seatsFree: Math.max(0, mine.seats_free - 1),
            })
          }
        />
        <Button
          label={t('rides.departed')}
          variant="danger"
          loading={endLive.isPending}
          onPress={async () => {
            const result = await endLive.mutateAsync({
              liveId: mine.id,
              reason: 'departed',
            });
            if (result.ok) router.back();
          }}
        />
      </Screen>
    );
  }

  // ---- not live yet ---------------------------------------------------------
  return (
    <Screen
      footer={
        <Button
          label={t('rides.board.goLive')}
          onPress={() => void start()}
          loading={goLive.isPending}
          disabled={!phoneValid}
        />
      }
    >
      <BackLink />

      <Text style={[type.display, { color: colors.text }]}>
        {t('rides.board.goLiveTitle')}
      </Text>
      <Text style={[type.bodySmall, { color: colors.textSecondary }]}>
        {t('rides.board.goLiveIntro')}
      </Text>

      {note ? (
        <Banner message={t(note.key)} tone={note.bad ? 'danger' : 'info'} />
      ) : null}

      {vehicle ? (
        <Card>
          <View style={styles.vehicleRow}>
            <Icon name="car" size={18} color={colors.textSecondary} />
            <Text style={[type.bodySmall, styles.grow, { color: colors.text }]}>
              {t(`rides.vehicle.${vehicle.type}`)}
              {vehicle.registration ? ` · ${vehicle.registration}` : ''}
            </Text>
            <Button
              label={t('common.edit')}
              variant="ghost"
              onPress={() => router.push('/rides/vehicle')}
            />
          </View>
        </Card>
      ) : null}

      <Text style={[type.bodySmall, styles.heading, { color: colors.text }]}>
        {t('rides.fromWhere')}
      </Text>
      <View style={styles.chips}>
        {places.map((name) => (
          <Chip
            key={`f-${name}`}
            label={name}
            selected={fromValue === name}
            onPress={() => setFrom(name)}
          />
        ))}
      </View>

      <Text style={[type.bodySmall, styles.heading, { color: colors.text }]}>
        {t('rides.toWhere')}
      </Text>
      <View style={styles.chips}>
        {places.map((name) => (
          <Chip
            key={`t-${name}`}
            label={name}
            selected={to === name}
            onPress={() => setTo(name)}
          />
        ))}
      </View>

      {/* The stepper. Buttons rather than a keyboard, because this number changes while
          the driver is sitting in the van watching people arrive. */}
      <Text style={[type.bodySmall, styles.heading, { color: colors.text }]}>
        {t('rides.board.seatsNow')}
      </Text>
      <View style={styles.stepper}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('rides.minusSeat')}
          onPress={() => setSeatsCount((n) => Math.max(0, n - 1))}
          style={[styles.step, { borderColor: colors.border, backgroundColor: colors.surface }]}
        >
          <Text style={[type.display, { color: colors.primary }]}>−</Text>
        </Pressable>

        <Text style={[type.display, styles.count, { color: colors.text }]}>{seats}</Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="+1"
          onPress={() => setSeatsCount((n) => Math.min(cap, n + 1))}
          style={[styles.step, { borderColor: colors.border, backgroundColor: colors.surface }]}
        >
          <Text style={[type.display, { color: colors.primary }]}>+</Text>
        </Pressable>
      </View>

      <TextField
        label={t('rides.board.fare')}
        value={fare}
        onChangeText={setFare}
        keyboardType="numeric"
        maxLength={5}
      />
      <TextField
        label={t('rides.board.stand')}
        hint={t('rides.board.standHint')}
        value={stand}
        onChangeText={setStand}
        maxLength={80}
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
  vehicleRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  grow: { flex: 1 },
  bold: { fontFamily: fontFamily.semibold, fontWeight: '600' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  step: {
    width: 64,
    height: 64,
    borderRadius: radius.card,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: { minWidth: 48, textAlign: 'center' },
});
