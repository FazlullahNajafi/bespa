import { StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { StatusPill } from '@/components/status-pill';
import { liveSeatsLeft, type LiveRide } from '@/api/rides';
import { dial } from '@/lib/dial';
import { useNow } from '@/lib/use-now';
import { fontFamily, layout, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * One van on the short-distance board (spec 04.4).
 *
 * The card answers the only question this half of the module exists for — *what is
 * leaving soon and does it have room?* — in the order it is asked: where it is going,
 * how many seats are left, where it is waiting, and how long it has been there.
 *
 * **Call is the primary action, not "I'm coming".** The existing system is a phone call
 * to a driver you know, and spec 04.4 treats the claim as a courtesy signal layered on
 * top of that rather than a replacement for it. So Call is the filled button and "I'm
 * coming" sits beside it with copy saying plainly that it holds nothing.
 *
 * **Minutes live is shown**, because a van that went live four minutes ago and one that
 * has been waiting forty are different propositions, and the board would otherwise
 * flatten them.
 *
 * **A driver sees neither action on their own van.** Offering someone a seat in the
 * vehicle they are sitting in, and a button to telephone themselves, is the kind of
 * thing that makes a reader doubt everything else on the screen. Their own row is
 * marked as theirs instead.
 */
export function LiveRideCard({
  ride,
  me,
  onClaim,
  claiming,
}: {
  ride: LiveRide;
  /** The signed-in user, so a driver is not offered a seat in their own van. */
  me: string | null;
  onClaim: () => void;
  claiming: boolean;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const now = useNow(30_000);

  const mine = me !== null && ride.driver_id === me;
  const left = liveSeatsLeft(ride);
  const minutes = Math.max(0, Math.round((now - Date.parse(ride.went_live_at)) / 60000));

  return (
    <Card>
      <View style={styles.top}>
        <Text style={[type.body, styles.route, { color: colors.text }]}>
          {ride.from_label} → {ride.to_label}
        </Text>
        <StatusPill
          label={left > 0 ? t('rides.board.seatsLeft', { count: left }) : t('rides.board.full')}
          tone={left > 0 ? 'success' : 'warning'}
        />
      </View>

      <View style={styles.meta}>
        <Icon name="car" size={14} color={colors.textSecondary} />
        <Text style={[type.caption, { color: colors.textSecondary }]}>
          {t(`rides.vehicle.${ride.vehicle}`)}
          {ride.registration ? ` · ${ride.registration}` : ''}
        </Text>
      </View>

      <View style={styles.meta}>
        <Icon name="user" size={14} color={colors.textSecondary} />
        <Text style={[type.caption, { color: colors.textSecondary }]}>
          {ride.driver_name ?? ''} · {t('rides.driverUnverified')}
        </Text>
      </View>

      {ride.stand_note ? (
        <View style={styles.meta}>
          <Icon name="pin" size={14} color={colors.textSecondary} />
          <Text style={[type.caption, { color: colors.textSecondary }]}>
            {ride.stand_note}
          </Text>
        </View>
      ) : null}

      <View style={styles.meta}>
        <Icon name="clock" size={14} color={colors.textSecondary} />
        <Text style={[type.caption, { color: colors.textSecondary }]}>
          {t('rides.board.liveFor', { minutes })}
          {ride.claimed > 0 ? ` · ${t('rides.board.claimed', { count: ride.claimed })}` : ''}
        </Text>
      </View>

      {ride.fare !== null ? (
        <Text style={[type.body, styles.fare, { color: colors.text }]}>
          ₹{Number(ride.fare).toFixed(0)}
        </Text>
      ) : null}

      {mine ? (
        <View style={styles.yours}>
          <Icon name="check" size={14} color={colors.primary} />
          <Text style={[type.caption, styles.yoursText, { color: colors.primary }]}>
            {t('rides.board.yours')}
          </Text>
        </View>
      ) : (
        <View style={styles.actions}>
          {ride.contact ? (
            <View style={styles.action}>
              <Button
                label={t('rides.callDriver')}
                leading={<Icon name="phone" size={20} color={colors.onPrimary} />}
                onPress={() => void dial(ride.contact as string)}
              />
            </View>
          ) : null}
          <View style={styles.action}>
            <Button
              label={t('rides.board.coming')}
              variant="secondary"
              loading={claiming}
              onPress={onClaim}
              accessibilityHint={t('rides.board.comingNote')}
            />
          </View>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: layout.tap,
  },
  route: { flex: 1, fontFamily: fontFamily.semibold, fontWeight: '600' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  fare: { fontFamily: fontFamily.semibold, fontWeight: '600', paddingTop: space.xs },
  actions: { flexDirection: 'row', gap: space.xs, paddingTop: space.xs },
  action: { flex: 1 },
  yours: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingTop: space.xs },
  yoursText: { fontFamily: fontFamily.semibold, fontWeight: '600' },
});
