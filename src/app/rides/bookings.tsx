import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import i18n, { useTranslation } from '@/i18n';
import { BackLink } from '@/components/back-link';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { StatusPill } from '@/components/status-pill';
import { useCancelBooking, useMyBookings, useMyTrips, type Booking } from '@/api/rides';
import { useSession } from '@/store/session';
import { dial } from '@/lib/dial';
import { formatDay } from '@/lib/format-date';
import { fontFamily, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * My bookings, and the trips I am driving (spec 04.1).
 *
 * One screen for both sides, because on this prototype the same person is usually
 * testing both and splitting them would mean two nearly identical lists. The bookings
 * query returns a passenger's own rows *and* every row on the trips they drive — that is
 * what the policy allows — so the split here is by whether the booking is mine.
 */

function BookingCard({
  booking,
  onOpen,
  onCancel,
  cancelling,
}: {
  booking: Booking;
  onOpen: () => void;
  onCancel: () => void;
  cancelling: boolean;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const trip = booking.trip;
  const live = booking.status === 'requested' || booking.status === 'confirmed';

  return (
    <Card>
      <Text style={[type.body, styles.bold, { color: colors.text }]}>
        {trip ? `${trip.from_label} → ${trip.to_label}` : ''}
      </Text>
      {trip ? (
        <Text style={[type.bodySmall, { color: colors.textSecondary }]}>
          {formatDay(new Date(trip.departure_date), i18n.language)}
          {trip.departure_window ? ` · ${trip.departure_window}` : ''}
        </Text>
      ) : null}

      <View style={styles.meta}>
        <StatusPill
          label={t(`rides.bookingStatus.${booking.status}`)}
          tone={
            booking.status === 'confirmed'
              ? 'success'
              : booking.status.startsWith('cancelled')
                ? 'danger'
                : 'warning'
          }
        />
        <Text style={[type.caption, { color: colors.textSecondary }]}>
          {t('rides.bookingCode', { code: booking.code })} ·{' '}
          {t('rides.selected', { count: booking.seat_nos.length })}
        </Text>
      </View>

      {trip?.status === 'cancelled' ? (
        <Text style={[type.caption, { color: colors.danger }]}>
          {t('rides.cancelledBecause', { reason: trip.cancel_reason ?? '' })}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Button label={t('common.done')} variant="secondary" onPress={onOpen} />
        {trip?.contact_phone ? (
          <Button
            label={t('rides.callDriver')}
            variant="secondary"
            leading={<Icon name="phone" size={20} color={colors.primary} />}
            onPress={() => void dial(trip.contact_phone as string)}
          />
        ) : null}
        {live ? (
          <Button
            label={t('rides.cancelBooking')}
            variant="ghost"
            loading={cancelling}
            onPress={onCancel}
          />
        ) : null}
      </View>
    </Card>
  );
}

export default function MyBookingsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();

  const { session } = useSession();
  const me = session?.user.id ?? null;

  const bookings = useMyBookings(Boolean(me));
  const trips = useMyTrips(me);
  const cancel = useCancelBooking();

  const mine = useMemo(
    () => (bookings.data ?? []).filter((b) => b.passenger_id === me),
    [bookings.data, me],
  );
  const driving = useMemo(() => trips.data ?? [], [trips.data]);

  return (
    <Screen>
      <BackLink />

      <Text style={[type.display, { color: colors.text }]}>{t('rides.myBookings')}</Text>

      {bookings.isPending ? (
        <ActivityIndicator accessibilityLabel={t('common.loading')} color={colors.primary} />
      ) : bookings.isError ? (
        <Banner message={t('errors.unknown')} tone="danger" />
      ) : mine.length === 0 ? (
        <Card>
          <EmptyState icon="car" message={t('rides.empty')} />
        </Card>
      ) : (
        <View style={styles.list}>
          {mine.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              cancelling={cancel.isPending}
              onOpen={() =>
                router.push({ pathname: '/rides/[id]', params: { id: booking.trip_id } })
              }
              onCancel={() => void cancel.mutateAsync(booking.id)}
            />
          ))}
        </View>
      )}

      {driving.length > 0 ? (
        <>
          <Text style={[type.bodySmall, styles.heading, { color: colors.text }]}>
            {t('rides.myTrips')}
          </Text>
          <View style={styles.list}>
            {driving.map((trip) => (
              <Card key={trip.id}>
                <Text style={[type.body, styles.bold, { color: colors.text }]}>
                  {trip.from_label} → {trip.to_label}
                </Text>
                <Text style={[type.bodySmall, { color: colors.textSecondary }]}>
                  {formatDay(new Date(trip.departure_date), i18n.language)}
                </Text>
                <View style={styles.meta}>
                  <StatusPill
                    label={t(`rides.status.${trip.status}`)}
                    tone={trip.status === 'cancelled' ? 'danger' : 'success'}
                  />
                </View>
                <View style={styles.actions}>
                  <Button
                    label={t('rides.passengers')}
                    variant="secondary"
                    onPress={() =>
                      router.push({ pathname: '/rides/[id]', params: { id: trip.id } })
                    }
                  />
                </View>
              </Card>
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontFamily: fontFamily.semibold, fontWeight: '600', paddingTop: space.sm },
  list: { gap: space.sm },
  bold: { fontFamily: fontFamily.semibold, fontWeight: '600' },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, paddingTop: space.xs },
});
