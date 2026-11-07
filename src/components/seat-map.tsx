import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { Icon } from '@/components/icon';
import { seatTakeable, type TripSeat, type VehicleType } from '@/api/rides';
import { columnsIn, layoutFor, shapeOf, type Slot } from '@/lib/seat-layout';
import { useNow } from '@/lib/use-now';
import { fontFamily, radius, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * The seat map (spec 04.2, "the centrepiece") — drawn as the inside of the vehicle.
 *
 * The first version was a wrapping grid of numbered squares. It was correct and it felt
 * like a form: you could not tell a Tempo Traveller from a Xylo, which seat was by a
 * window, or where the driver sat. Spec 04.2 says the passenger's question is *"who is
 * going to Leh on Thursday and is there a window seat?"* — a grid cannot answer the
 * second half.
 *
 * So: a body with a bonnet and a windscreen, the driver at the front **right** because
 * India drives on the left, a gangway where the vehicle has one, and window seats marked
 * with a pane glyph rather than left to be inferred from position.
 *
 * Everything that decides *state* is unchanged and still the server's:
 *
 * - **Colour is never the only signal** (spec 08.1). Every state pairs a colour with a
 *   glyph, and the seat number stays legible in all of them.
 * - **An expired hold renders as free**, exactly as the server treats it, with the clock
 *   read from ticking state so a seat frees up on screen without waiting for a refetch.
 */

export function SeatMap({
  seats,
  vehicleType,
  me,
  selected,
  onToggle,
  disabled = false,
}: {
  seats: TripSeat[];
  vehicleType: VehicleType;
  me: string | null;
  selected: number[];
  onToggle: (seatNo: number) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const now = useNow();

  const byNumber = new Map(seats.map((s) => [s.seat_no, s]));
  const rows = layoutFor(vehicleType, seats.length);
  const columns = columnsIn(rows);
  const shape = shapeOf(vehicleType);

  function renderSlot(slot: Slot, key: string) {
    if (slot.kind === 'gap') {
      return <View key={key} style={styles.slot} />;
    }

    if (slot.kind === 'driver') {
      return (
        <View
          key={key}
          style={[styles.slot, styles.driver, { backgroundColor: colors.surfaceAlt }]}
          accessibilityLabel={t('rides.driverSeat')}
        >
          <Icon name="steering" size={22} color={colors.textSecondary} />
        </View>
      );
    }

    const seat = byNumber.get(slot.seatNo);
    if (!seat) return <View key={key} style={styles.slot} />;

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
          styles.seat,
          {
            backgroundColor: background,
            borderColor: isSelected ? colors.primary : colors.border,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        {/* Window seats are what people ask for, so they are marked rather than left to
            be worked out from where the square sits. */}
        {slot.position === 'window' ? (
          <View style={styles.windowMark}>
            <Icon name="window-seat" size={11} color={foreground} />
          </View>
        ) : null}

        <Text style={[type.body, styles.number, { color: foreground }]}>
          {seat.seat_no}
        </Text>
        {glyph ? <Icon name={glyph} size={13} color={foreground} /> : null}
      </Pressable>
    );
  }

  return (
    <View>
      <View
        style={[
          styles.body,
          { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
        ]}
      >
        {/* The bonnet and windscreen. Two lines of chrome, and they are what turn a
            column of squares into a vehicle seen from above. */}
        <View style={[styles.bonnet, { backgroundColor: colors.border }]} />
        <Text style={[type.caption, styles.front, { color: colors.textSecondary }]}>
          {t('rides.front')}
        </Text>

        {rows.map((row, r) => (
          <View key={`r-${r}`} style={styles.row}>
            {row.map((slot, c) => renderSlot(slot, `s-${r}-${c}`))}
            {/* Short rows are padded so every row is the same width and the body stays
                rectangular. */}
            {Array.from({ length: columns - row.length }, (_, i) => (
              <View key={`pad-${r}-${i}`} style={styles.slot} />
            ))}
          </View>
        ))}

        <Text style={[type.caption, styles.front, { color: colors.textSecondary }]}>
          {t(`rides.shape.${shape}`)}
        </Text>
      </View>

      {/* The key. Four states on a plan of squares is not self-explanatory, and this is
          the screen where a misread costs somebody a seat. */}
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
  body: {
    alignSelf: 'center',
    alignItems: 'center',
    borderWidth: 2,
    // A deep radius at the top and a shallow one at the bottom: that asymmetry alone
    // reads as "front of a vehicle".
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: radius.card,
    borderBottomRightRadius: radius.card,
    paddingHorizontal: space.sm,
    paddingTop: space.sm,
    paddingBottom: space.md,
    gap: space.xs,
  },
  bonnet: { width: '55%', height: 4, borderRadius: 2, marginBottom: 2 },
  front: { letterSpacing: 0.6, textTransform: 'uppercase' },
  row: { flexDirection: 'row', gap: space.xs },
  slot: { width: SLOT, height: SLOT },
  seat: {
    borderWidth: 1,
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driver: {
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  windowMark: { position: 'absolute', top: 3, left: 4, opacity: 0.7 },
  number: { fontFamily: fontFamily.semibold, fontWeight: '600' },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
    paddingTop: space.md,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  swatch: { width: 12, height: 12, borderRadius: 3, borderWidth: 1 },
});
