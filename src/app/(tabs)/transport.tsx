import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import i18n, { useTranslation } from '@/i18n';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { LiveRideCard } from '@/components/live-ride-card';
import { Screen } from '@/components/screen';
import { Segmented } from '@/components/segmented';
import { StatusPill } from '@/components/status-pill';
import { TextField } from '@/components/text-field';
import {
  seatsFree,
  useClaimLiveSeat,
  useLiveBoard,
  useTrips,
  type Trip,
} from '@/api/rides';
import { useMyProfile } from '@/api/profile';
import { useSession } from '@/store/session';
import { formatDay } from '@/lib/format-date';
import { fontFamily, layout, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * Transport (spec 04.1) — the two economies, side by side and not merged.
 *
 * Spec 04 opens by saying Kargil has two genuinely different transport economies and
 * that the central decision of the module is to refuse to merge them: long distance is
 * days ahead and wants booking, short distance is ten minutes away and wants
 * *visibility*. The segmented cards are that decision made visible, which is why they
 * are two labelled cards rather than a thin toggle — "Long distance" means nothing to
 * someone opening this tab for the first time, and the line underneath does the work.
 *
 * **Never fabricate supply** (spec 04.7 #4). Both empty states say there is nothing and
 * offer the action that would change it. No demo drivers, no sample vans.
 */

type Segment = 'long' | 'short';

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

  const [segment, setSegment] = useState<Segment>('long');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [note, setNote] = useState<string | null>(null);

  const trips = useTrips({});
  const board = useLiveBoard(hasVillage && segment === 'short');
  const claim = useClaimLiveSeat();

  const rows = useMemo(() => trips.data ?? [], [trips.data]);

  // Filtered on the client: the query already caps at 50 rows for the whole district,
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

  const vans = board.data ?? [];

  async function onClaim(liveId: string) {
    setNote(null);
    const result = await claim.mutateAsync({ liveId });
    setNote(result.ok ? 'rides.board.claimSent' : `errors.${result.code}`);
  }

  return (
    <Screen
      footer={
        <Button
          label={segment === 'long' ? t('rides.postTrip') : t('rides.board.goLive')}
          onPress={() =>
            router.push(segment === 'long' ? '/rides/new' : '/rides/go-live')
          }
          disabled={!hasVillage}
        />
      }
    >
      <Text style={[type.display, { color: colors.text }]}>{t('rides.title')}</Text>

      <Banner message={t('rides.prototypeBody')} tone="danger" />

      <Segmented
        value={segment}
        onChange={setSegment}
        options={[
          {
            value: 'long',
            label: t('rides.segLong'),
            hint: t('rides.segLongHint'),
            icon: 'car',
          },
          {
            value: 'short',
            label: t('rides.segShort'),
            hint: t('rides.segShortHint'),
            icon: 'town',
          },
        ]}
      />

      <Button
        label={t('rides.myBookings')}
        variant="secondary"
        onPress={() => router.push('/rides/bookings')}
      />

      {note ? (
        <Banner message={t(note)} tone={note.startsWith('errors.') ? 'danger' : 'info'} />
      ) : null}

      {segment === 'long' ? (
        <>
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
                  onPress={() =>
                    router.push({ pathname: '/rides/[id]', params: { id: trip.id } })
                  }
                />
              ))}
            </View>
          )}
        </>
      ) : (
        <>
          <Text style={[type.bodySmall, { color: colors.textSecondary }]}>
            {t('rides.board.intro')}
          </Text>

          {board.isPending ? (
            <ActivityIndicator accessibilityLabel={t('common.loading')} color={colors.primary} />
          ) : board.isError ? (
            <Banner
              message={t('errors.unknown')}
              action={
                <Button
                  label={t('common.retry')}
                  variant="secondary"
                  onPress={() => void board.refetch()}
                />
              }
            />
          ) : vans.length === 0 ? (
            <Card>
              <EmptyState icon="town" message={t('rides.board.empty')} />
            </Card>
          ) : (
            <View style={styles.list}>
              {vans.map((ride) => (
                <LiveRideCard
                  key={ride.id}
                  ride={ride}
                  claiming={claim.isPending}
                  onClaim={() => void onClaim(ride.id)}
                />
              ))}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
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
