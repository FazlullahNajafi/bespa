import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { Icon } from '@/components/icon';
import { seatTakeable, type TripSeat, type VehicleType } from '@/api/rides';
import { columnsIn, layoutFor, shapeOf, type Slot } from '@/lib/seat-layout';
import { useNow } from '@/lib/use-now';
import { fontFamily, radius, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * The seat map (spec 04.2, "the centrepiece") — the inside of the vehicle, seen from
 * above.
 *
 * Two goes at this. The first was a wrapping grid of squares, which read as a form. The
 * second added a body outline and was called a keyboard, which was fair: evenly spaced
 * rounded squares in straight rows *is* a keypad, whatever is drawn around it. What was
 * missing was not more chrome but the two things that make a plan read as a vehicle —
 * **seats that look like seats** and **a body that is not a rectangle**.
 *
 * So each seat now has a backrest; the nose tapers and carries a windscreen; there are
 * wheels; and the cab is visibly separated from the cabin by the bulkhead the windscreen
 * implies. The driver sits front-right, because India drives on the left.
 *
 * **The plan comes from the vehicle, not from the sale.** An Innova is a seven-seat
 * Innova whether four seats are for sale or seven. Seats the vehicle has but this trip
 * is not selling are drawn in place, dimmed and marked — leaving them out drew a
 * different car, which is what made a four-seat sale look like a four-seat vehicle.
 *
 * State is unchanged and still the server's: colour never carries meaning alone (spec
 * 08.1), and an expired hold renders as free exactly as the server treats it, from a
 * ticking clock so a seat frees up on screen without waiting for a refetch.
 */

export function SeatMap({
  seats,
  vehicleType,
  vehicleSeats,
  me,
  selected,
  onToggle,
  disabled = false,
}: {
  /** The seats actually on sale, from the server. */
  seats: TripSeat[];
  vehicleType: VehicleType;
  /** How many seats the vehicle has, which is what the plan is drawn from. */
  vehicleSeats: number;
  me: string | null;
  selected: number[];
  onToggle: (seatNo: number) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const now = useNow();

  const byNumber = new Map(seats.map((s) => [s.seat_no, s]));
  // Never fewer than the seats on sale, in case a vehicle's capacity was edited down
  // after a trip was posted on it.
  const capacity = Math.max(vehicleSeats, seats.length);
  const rows = layoutFor(vehicleType, capacity);
  const columns = columnsIn(rows);
  const shape = shapeOf(vehicleType);

  function Backrest({ colour }: { colour: string }) {
    return <View style={[styles.backrest, { backgroundColor: colour }]} />;
  }

  function renderSlot(slot: Slot, key: string) {
    if (slot.kind === 'gap') return <View key={key} style={styles.slot} />;

    if (slot.kind === 'driver') {
      return (
        <View
          key={key}
          style={[
            styles.slot,
            styles.seatShape,
            styles.driver,
            { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
          ]}
          accessibilityLabel={t('rides.driverSeat')}
        >
          <Backrest colour={colors.border} />
          <Icon name="steering" size={20} color={colors.textSecondary} />
        </View>
      );
    }

    const seat = byNumber.get(slot.seatNo);

    // A seat the vehicle has that this trip is not selling.
    if (!seat) {
      return (
        <View
          key={key}
          accessibilityLabel={t('rides.seatNotForSale', { number: slot.seatNo })}
          style={[
            styles.slot,
            styles.seatShape,
            {
              backgroundColor: colors.surfaceAlt,
              borderColor: colors.borderSoft,
              borderStyle: 'dashed',
            },
          ]}
        >
          <Backrest colour={colors.borderSoft} />
          <Icon name="close" size={13} color={colors.textFaint} />
        </View>
      );
    }

    const takeable = seatTakeable(seat, me, now);
    const isSelected = selected.includes(seat.seat_no);
    const mineHeld = seat.status === 'held' && seat.held_by === me;
    const booked = seat.status === 'booked' || seat.status === 'blocked';
    const contested = seat.status === 'held' && !mineHeld && !takeable;

    const background = isSelected
      ? colors.primary
      : booked || contested
        ? colors.surfaceAlt
        : colors.surface;

    const foreground = isSelected
      ? colors.onPrimary
      : booked || contested
        ? colors.textSecondary
        : colors.text;

    const glyph = isSelected ? 'check' : booked ? 'lock' : contested ? 'clock' : null;
    const stateKey = isSelected
      ? 'yours'
      : booked
        ? 'taken'
        : contested
          ? 'beingTaken'
          : 'free';

    const locked = disabled || (!takeable && !isSelected);

    return (
      <Pressable
        key={key}
        onPress={() => onToggle(seat.seat_no)}
        disabled={locked}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isSelected, disabled: locked }}
        accessibilityLabel={t('rides.seatLabel', {
          number: seat.seat_no,
          position: t(`rides.seatPosition.${slot.position}`),
          state: t(`rides.seatState.${stateKey}`),
        })}
        style={({ pressed }) => [
          styles.slot,
          styles.seatShape,
          {
            backgroundColor: background,
            borderColor: isSelected ? colors.primary : colors.border,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Backrest colour={isSelected ? colors.onPrimary : colors.border} />

        {slot.position === 'window' ? (
          <View style={styles.windowMark}>
            <Icon name="window-seat" size={10} color={foreground} />
          </View>
        ) : null}

        <Text style={[type.bodySmall, styles.number, { color: foreground }]}>
          {seat.seat_no}
        </Text>
        {glyph ? <Icon name={glyph} size={12} color={foreground} /> : null}
      </Pressable>
    );
  }

  return (
    <View>
      <View style={styles.outer}>
        {/* Wheels, outside the body on both sides. Four small bars, and they do more
            than the whole outline did to say "this is a vehicle". */}
        {[0, 1].map((side) => (
          <View key={side} style={[styles.axles, side === 0 ? styles.left : styles.right]}>
            <View style={[styles.wheel, { backgroundColor: colors.textSecondary }]} />
            <View style={[styles.wheel, { backgroundColor: colors.textSecondary }]} />
          </View>
        ))}

        <View
          style={[
            styles.body,
            { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
          ]}
        >
          {/* The nose: a narrower bar above a windscreen that spans most of the width.
              The taper is what stops the body reading as a rectangle. */}
          <View style={[styles.nose, { backgroundColor: colors.border }]} />
          <View style={[styles.windscreen, { borderColor: colors.border }]} />

          {rows.map((row, r) => (
            <View key={`r-${r}`} style={styles.row}>
              {row.map((slot, c) => renderSlot(slot, `s-${r}-${c}`))}
              {Array.from({ length: columns - row.length }, (_, i) => (
                <View key={`pad-${r}-${i}`} style={styles.slot} />
              ))}
            </View>
          ))}
        </View>
      </View>

      <Text style={[type.caption, styles.caption, { color: colors.textSecondary }]}>
        {t(`rides.shape.${shape}`)}
      </Text>

      <View style={styles.legend}>
        {(['free', 'yours', 'beingTaken', 'taken'] as const).map((state) => (
          <View key={state} style={styles.legendItem}>
            {state === 'yours' ? (
              <Icon name="check" size={12} color={colors.primary} />
            ) : state === 'taken' ? (
              <Icon name="lock" size={12} color={colors.textSecondary} />
            ) : state === 'beingTaken' ? (
              <Icon name="clock" size={12} color={colors.textSecondary} />
            ) : (
              <View style={[styles.swatch, { borderColor: colors.border }]} />
            )}
            <Text style={[type.caption, { color: colors.textSecondary }]}>
              {t(`rides.seatState.${state}`)}
            </Text>
          </View>
        ))}
        <View style={styles.legendItem}>
          <Icon name="window-seat" size={12} color={colors.textSecondary} />
          <Text style={[type.caption, { color: colors.textSecondary }]}>
            {t('rides.seatPosition.window')}
          </Text>
        </View>
      </View>
    </View>
  );
}

const SLOT = 52;

const styles = StyleSheet.create({
  outer: { alignSelf: 'center', paddingHorizontal: 10 },
  axles: {
    position: 'absolute',
    top: 70,
    bottom: 24,
    justifyContent: 'space-between',
  },
  left: { left: 0 },
  right: { right: 0 },
  wheel: { width: 10, height: 34, borderRadius: 5 },
  body: {
    alignItems: 'center',
    borderWidth: 2,
    // A deep nose radius against a shallow tail: the asymmetry is most of what makes
    // this read as a vehicle rather than a panel.
    borderTopLeftRadius: 42,
    borderTopRightRadius: 42,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    paddingHorizontal: space.sm,
    paddingTop: space.sm,
    paddingBottom: space.md,
    gap: space.xs,
  },
  nose: { width: 40, height: 4, borderRadius: 2 },
  windscreen: {
    width: '72%',
    height: 14,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    marginBottom: space.xs,
  },
  row: { flexDirection: 'row', gap: space.xs },
  slot: { width: SLOT, height: SLOT },
  seatShape: {
    borderWidth: 1.5,
    // Square-ish cushion, rounded shoulders: a seat, not a key.
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 7,
    borderBottomRightRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 7,
  },
  driver: {},
  backrest: {
    position: 'absolute',
    top: 4,
    width: '55%',
    height: 3,
    borderRadius: 2,
  },
  windowMark: { position: 'absolute', bottom: 3, left: 4, opacity: 0.75 },
  number: { fontFamily: fontFamily.semibold, fontWeight: '600' },
  caption: { textAlign: 'center', paddingTop: space.xs },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
    paddingTop: space.md,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  swatch: { width: 12, height: 12, borderRadius: 3, borderWidth: 1 },
});
