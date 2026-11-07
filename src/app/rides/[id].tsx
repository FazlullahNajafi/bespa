import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import i18n, { useTranslation } from '@/i18n';
import { BackLink } from '@/components/back-link';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { SeatMap } from '@/components/seat-map';
import { StatusPill } from '@/components/status-pill';
import { TextField } from '@/components/text-field';
import {
  seatsFree,
  useBookSeats,
  useCancelTrip,
  useConfirmBooking,
  useHoldSeats,
  useMyBookings,
  useReleaseHolds,
  useTrip,
} from '@/api/rides';
import { useMyPrivate } from '@/api/profile';
import { useSession } from '@/store/session';
import { dial } from '@/lib/dial';
import { formatDay } from '@/lib/format-date';
import { COUNTRY_CODE, fromE164, isValidNational, toE164 } from '@/lib/phone';
import { fontFamily, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * One trip: the seat map, the booking form, and — if you are the driver — the passenger
 * list (spec 04.2, 04.3).
 *
 * **Holding is a real round trip and its answer is believed.** `hold_seats` returns the
 * seats it actually won, which may be fewer than were tapped, and the screen reports
 * that in the moment rather than letting someone fill in a pickup note and fail at the
 * end. Spec 04.6: "If the client asked for 3 seats and got 2, the UI says so
 * immediately."
 *
 * **Nothing here is queued.** A seat is a claim against other people in real time; an
 * offline hold that drained twenty minutes later would promise a seat that was gone. So
 * the write is direct and the failure says "no connection" rather than "we'll retry".
 *
 * **Call the driver is offered before, during and after booking** — spec 04.2 is
 * explicit that the existing system runs on personal trust and a booking that cannot be
 * verbally confirmed will not be trusted.
 */
export default function TripScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { session } = useSession();
  const me = session?.user.id ?? null;
  const priv = useMyPrivate(session?.user.id);

  const trip = useTrip(id);
  const bookings = useMyBookings(Boolean(me));
  const hold = useHoldSeats();
  const release = useReleaseHolds();
  const book = useBookSeats();
  const confirm = useConfirmBooking();
  const cancelTrip = useCancelTrip();

  const [selected, setSelected] = useState<number[]>([]);
  const [phone, setPhone] = useState<string | undefined>();
  const [pickup, setPickup] = useState('');
  const [note, setNote] = useState<{ key: string; values?: Record<string, unknown>; bad: boolean } | null>(null);
  const [reason, setReason] = useState('');

  const data = trip.data;
  const isDriver = Boolean(data && me && data.driver_id === me);

  // The passenger list is just the bookings query filtered — the policy already decided
  // that a driver may read the bookings on their own trips.
  const tripBookings = useMemo(
    () => (bookings.data ?? []).filter((b) => b.trip_id === id),
    [bookings.data, id],
  );
  const myBooking = useMemo(
    () =>
      tripBookings.find(
        (b) =>
          b.passenger_id === me &&
          (b.status === 'requested' || b.status === 'confirmed'),
      ),
    [tripBookings, me],
  );

  const phoneValue = phone ?? fromE164(priv.data?.phone ?? null);
  const phoneValid = phoneValue.trim().length === 0 || isValidNational(phoneValue.trim());

  if (trip.isPending) {
    return (
      <Screen>
        <BackLink />
        <ActivityIndicator accessibilityLabel={t('common.loading')} color={colors.primary} />
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen>
        <BackLink />
        <Banner message={t('errors.unknown')} tone="danger" />
      </Screen>
    );
  }

  const free = seatsFree(data);
  const closed =
    data.status === 'cancelled' || data.status === 'departed' || data.status === 'completed';

  async function toggleSeat(seatNo: number) {
    if (!data) return;
    setNote(null);

    if (selected.includes(seatNo)) {
      setSelected((list) => list.filter((n) => n !== seatNo));
      return;
    }

    const want = [...selected, seatNo];
    const result = await hold.mutateAsync({ tripId: data.id, seatNos: want });

    if (!result.ok) {
      setNote({ key: result.code === 'offline' ? 'rides.offline' : `errors.${result.code}`, bad: true });
      return;
    }

    setSelected(result.data);

    if (result.data.length < want.length) {
      setNote(
        result.data.length === 0
          ? { key: 'rides.heldNone', bad: true }
          : {
              key: 'rides.heldSome',
              values: { got: result.data.length, asked: want.length },
              bad: true,
            },
      );
    }
  }

  async function confirmBooking() {
    if (!data || selected.length === 0) return;
    setNote(null);

    const result = await book.mutateAsync({
      tripId: data.id,
      seatNos: selected,
      phone: phoneValue.trim() ? toE164(phoneValue.trim()) : null,
      pickupNote: pickup.trim() || null,
    });

    if (!result.ok) {
      setNote({
        key: result.code === 'offline' ? 'rides.offline' : `errors.${result.code}`,
        bad: true,
      });
      // Whatever the server says now is the truth; re-read rather than guess.
      void trip.refetch();
      setSelected([]);
      return;
    }

    setSelected([]);
    setPickup('');
    setNote({ key: 'rides.booked', values: { code: result.data.code }, bad: false });
  }

  const total = (selected.length * Number(data.price_per_seat)).toFixed(0);

  return (
    <Screen>
      <BackLink />

      <Text style={[type.display, { color: colors.text }]}>
        {data.from_label} → {data.to_label}
      </Text>
      <Text style={[type.body, { color: colors.textSecondary }]}>
        {formatDay(new Date(data.departure_date), i18n.language)}
        {data.departure_window ? ` · ${data.departure_window}` : ''}
      </Text>

      <View style={styles.meta}>
        <StatusPill
          label={t(`rides.status.${data.status}`)}
          tone={data.status === 'cancelled' ? 'danger' : free > 0 ? 'success' : 'warning'}
        />
        <Text style={[type.bodySmall, { color: colors.textSecondary }]}>
          {t('rides.perSeat', { price: Number(data.price_per_seat).toFixed(0) })}
        </Text>
      </View>

      {data.status === 'cancelled' ? (
        <Banner
          message={t('rides.cancelledBecause', { reason: data.cancel_reason ?? '' })}
          tone="danger"
        />
      ) : null}

      <Card>
        <View style={styles.metaRow}>
          <Icon name="user" size={16} color={colors.textSecondary} />
          <Text style={[type.bodySmall, styles.grow, { color: colors.text }]}>
            {data.driver?.full_name ?? ''} · {t('rides.driverUnverified')}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Icon name="car" size={16} color={colors.textSecondary} />
          <Text style={[type.bodySmall, styles.grow, { color: colors.text }]}>
            {data.vehicle ? t(`rides.vehicle.${data.vehicle.type}`) : ''}
            {data.vehicle?.registration ? ` · ${data.vehicle.registration}` : ''}
          </Text>
        </View>
        {data.pickup_note ? (
          <View style={styles.metaRow}>
            <Icon name="pin" size={16} color={colors.textSecondary} />
            <Text style={[type.bodySmall, styles.grow, { color: colors.text }]}>
              {data.pickup_note}
            </Text>
          </View>
        ) : null}
      </Card>

      {note ? (
        <Banner message={t(note.key, note.values)} tone={note.bad ? 'danger' : 'info'} />
      ) : null}

      {/* ---------------- passenger side ---------------- */}
      {!isDriver && !closed ? (
        <>
          <Text style={[type.bodySmall, styles.heading, { color: colors.text }]}>
            {t('rides.pickSeats')}
          </Text>
          <Text style={[type.caption, { color: colors.textSecondary }]}>
            {t('rides.holdNote')}
          </Text>

          <SeatMap
            seats={data.trip_seats}
            vehicleType={data.vehicle?.type ?? 'other'}
            me={me}
            selected={selected}
            onToggle={(n) => void toggleSeat(n)}
            disabled={hold.isPending || book.isPending}
          />

          {selected.length > 0 ? (
            <>
              <Text style={[type.bodySmall, styles.heading, { color: colors.text }]}>
                {t('rides.selected', { count: selected.length })} ·{' '}
                {t('rides.total', { total })}
              </Text>

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
              <TextField
                label={t('rides.pickup')}
                hint={t('rides.pickupHint')}
                value={pickup}
                onChangeText={setPickup}
                maxLength={160}
                autoCapitalize="sentences"
              />

              {/* Spec 04.2 step 3, worded as the spec words it. */}
              <Banner message={t('rides.payNote')} tone="info" />

              <Button
                label={t('rides.confirm')}
                onPress={() => void confirmBooking()}
                loading={book.isPending}
                disabled={!phoneValid}
              />
              <Button
                label={t('common.cancel')}
                variant="ghost"
                onPress={() => {
                  setSelected([]);
                  void release.mutateAsync(data.id);
                }}
              />
            </>
          ) : null}
        </>
      ) : null}

      {/* Offered whether or not anything is booked. Spec 04.2: the existing system runs
          on personal trust, and a booking nobody can confirm by voice is not trusted. */}
      {!isDriver && data.contact_phone ? (
        <Button
          label={t('rides.callDriver')}
          variant="secondary"
          leading={<Icon name="phone" size={20} color={colors.primary} />}
          onPress={() => void dial(data.contact_phone as string)}
        />
      ) : null}

      {myBooking ? (
        <Card>
          <Text style={[type.body, styles.bold, { color: colors.text }]}>
            {t('rides.bookingCode', { code: myBooking.code })}
          </Text>
          <Text style={[type.caption, { color: colors.textSecondary }]}>
            {t(`rides.bookingStatus.${myBooking.status}`)}
          </Text>
        </Card>
      ) : null}

      {/* ---------------- driver side ---------------- */}
      {isDriver ? (
        <>
          <Text style={[type.bodySmall, styles.heading, { color: colors.text }]}>
            {t('rides.passengers')}
          </Text>

          {tripBookings.length === 0 ? (
            <Card>
              <Text style={[type.bodySmall, { color: colors.textSecondary }]}>
                {t('rides.noPassengers')}
              </Text>
            </Card>
          ) : (
            tripBookings.map((booking) => (
              <Card key={booking.id}>
                <Text style={[type.body, styles.bold, { color: colors.text }]}>
                  {booking.passenger?.full_name ?? ''} ·{' '}
                  {t('rides.selected', { count: booking.seat_nos.length })}
                </Text>
                <Text style={[type.caption, { color: colors.textSecondary }]}>
                  {t('rides.bookingCode', { code: booking.code })} ·{' '}
                  {t(`rides.bookingStatus.${booking.status}`)}
                </Text>
                {booking.pickup_note ? (
                  <Text style={[type.caption, { color: colors.textSecondary }]}>
                    {booking.pickup_note}
                  </Text>
                ) : null}

                <View style={styles.rowActions}>
                  {booking.phone ? (
                    <Button
                      label={t('rides.callPassenger')}
                      variant="secondary"
                      leading={<Icon name="phone" size={20} color={colors.primary} />}
                      onPress={() => void dial(booking.phone as string)}
                    />
                  ) : null}
                  {booking.status === 'requested' ? (
                    <Button
                      label={t('rides.accept')}
                      onPress={() => void confirm.mutateAsync(booking.id)}
                      loading={confirm.isPending}
                    />
                  ) : null}
                </View>
              </Card>
            ))
          )}

          {!closed ? (
            <>
              <TextField
                label={t('rides.cancelReason')}
                value={reason}
                onChangeText={setReason}
                maxLength={200}
                autoCapitalize="sentences"
              />
              <Button
                label={t('rides.cancelTrip')}
                variant="danger"
                loading={cancelTrip.isPending}
                onPress={async () => {
                  if (!reason.trim()) {
                    setNote({ key: 'rides.cancelReasonRequired', bad: true });
                    return;
                  }
                  const result = await cancelTrip.mutateAsync({
                    tripId: data.id,
                    reason: reason.trim(),
                  });
                  if (result.ok) router.back();
                  else setNote({ key: `errors.${result.code}`, bad: true });
                }}
              />
            </>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontFamily: fontFamily.semibold, fontWeight: '600', paddingTop: space.sm },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 28 },
  grow: { flex: 1 },
  bold: { fontFamily: fontFamily.semibold, fontWeight: '600' },
  rowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, paddingTop: space.xs },
});
