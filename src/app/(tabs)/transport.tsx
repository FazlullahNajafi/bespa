import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import i18n, { useTranslation } from '@/i18n';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { StatusPill } from '@/components/status-pill';
import { TextField } from '@/components/text-field';
import { seatsFree, useTrips, type Trip } from '@/api/rides';
import { useMyProfile } from '@/api/profile';
import { useSession } from '@/store/session';
import { formatDay } from '@/lib/format-date';
import { fontFamily, layout, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * The ride board (spec 04.2, "Browse") — long distance only.
 *
 * Spec 04 is emphatic that Kargil has two transport economies and that merging them
 * produces a product serving neither: long distance is days ahead and wants booking,
 * short distance is ten minutes away and wants a live presence board. **Only the first
 * is built.** There is no segmented control offering a second tab that does nothing.
 *
 * **The trial banner is not decoration.** Spec 04.5 is a whole section on verification
 * and none of it exists yet: anyone can post a trip and nothing checks they own a
 * vehicle or a licence. A villager who treats this like a verified service and waits at
 * five in the morning for a stranger has been misled by the app, so the screen says
 * plainly what it is, and "call the driver" is offered at every step the way spec 04.2
 * insists.
 *
 * **Never fabricate supply** (spec 04.7 #4): the empty state says there are no trips and
 * offers to post one. No demo drivers.
 */

function TripRow({ trip, onPress }: { trip: Trip; onPress: () => void }) {
  const { t } = useTranslation();
  const colors = useColors();
  const free = seatsFree(trip);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${trip.from_label} to ${trip.to_label}`}
      style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
    >
      <Card>
        <View style={styles.rowTop}>
          <Text style={[type.body, styles.route, { color: colors.text }]}>
            {trip.from_label} → {trip.to_label}
          </Text>
          <StatusPill
            label={free > 0 ? t('rides.seatsFree', { count: free }) : t('rides.seatsNone')}
            tone={free > 0 ? 'success' : 'warning'}
          />
        </View>

        <Text style={[type.bodySmall, { color: colors.textSecondary }]}>
          {formatDay(new Date(trip.departure_date), i18n.language)}
          {trip.departure_window ? ` · ${trip.departure_window}` : ''}
        </Text>

        <View style={styles.meta}>
          <Icon name="car" size={14} color={colors.textSecondary} />
          <Text style={[type.caption, { color: colors.textSecondary }]}>
            {trip.vehicle ? t(`rides.vehicle.${trip.vehicle.type}`) : ''}
            {trip.vehicle?.registration ? ` · ${trip.vehicle.registration}` : ''}
          </Text>
        </View>

        <View style={styles.meta}>
          <Icon name="user" size={14} color={colors.textSecondary} />
          <Text style={[type.caption, { color: colors.textSecondary }]}>
            {trip.driver?.full_name ?? ''} · {t('rides.driverUnverified')}
          </Text>
        </View>

        <Text style={[type.body, styles.price, { color: colors.text }]}>
          {t('rides.perSeat', { price: Number(trip.price_per_seat).toFixed(0) })}
        </Text>

        {trip.status === 'cancelled' ? (
          <Text style={[type.caption, { color: colors.danger }]}>
            {t('rides.cancelledBecause', { reason: trip.cancel_reason ?? '' })}
          </Text>
        ) : null}
      </Card>
    </Pressable>
  );
}

export default function TransportScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();

  const { session } = useSession();
  const profile = useMyProfile(session?.user.id);
  const hasVillage = Boolean(profile.data?.village_id);

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const trips = useTrips({});
  const rows = useMemo(() => trips.data ?? [], [trips.data]);

  // Filtered on the client. The query already caps at 50 rows for the whole district,
  // and a round trip per keystroke on a 2G connection would be far worse than scanning
  // an array that is already in memory.
  const shown = useMemo(() => {
    const f = from.trim().toLowerCase();
    const u = to.trim().toLowerCase();
    return rows.filter(
      (trip) =>
        (!f || trip.from_label.toLowerCase().includes(f)) &&
        (!u || trip.to_label.toLowerCase().includes(u)),
    );
  }, [rows, from, to]);

  return (
    <Screen
      footer={
        <Button
          label={t('rides.postTrip')}
          onPress={() => router.push('/rides/new')}
          disabled={!hasVillage}
        />
      }
    >
      <Text style={[type.display, { color: colors.text }]}>{t('rides.title')}</Text>

      {/* Says what this is before anyone relies on it. */}
      <Banner message={t('rides.prototypeBody')} tone="danger" />

      <View style={styles.actions}>
        <Button
          label={t('rides.myBookings')}
          variant="secondary"
          onPress={() => router.push('/rides/bookings')}
        />
      </View>

      <View style={styles.filters}>
        <View style={styles.filter}>
          <TextField
            label={t('rides.from')}
            value={from}
            onChangeText={setFrom}
            autoCapitalize="words"
            autoCorrect={false}
          />
        </View>
        <View style={styles.filter}>
          <TextField
            label={t('rides.to')}
            value={to}
            onChangeText={setTo}
            autoCapitalize="words"
            autoCorrect={false}
          />
        </View>
      </View>

      {trips.isPending ? (
        <ActivityIndicator accessibilityLabel={t('common.loading')} color={colors.primary} />
      ) : trips.isError ? (
        <Banner
          message={t('errors.unknown')}
          action={
            <Button
              label={t('common.retry')}
              variant="secondary"
              onPress={() => void trips.refetch()}
            />
          }
        />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState icon="car" message={t('rides.empty')} />
        </Card>
      ) : shown.length === 0 ? (
        <Card>
          <EmptyState icon="search" message={t('rides.noMatch')} />
        </Card>
      ) : (
        <View style={styles.list}>
          {shown.map((trip) => (
            <TripRow
              key={trip.id}
              trip={trip}
              onPress={() => router.push({ pathname: '/rides/[id]', params: { id: trip.id } })}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: space.xs },
  filters: { flexDirection: 'row', gap: space.sm },
  filter: { flex: 1 },
  list: { gap: space.sm },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: layout.tap,
  },
  route: { flex: 1, fontFamily: fontFamily.semibold, fontWeight: '600' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  price: { fontFamily: fontFamily.semibold, fontWeight: '600' },
});
