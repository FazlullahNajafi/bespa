import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { Icon } from '@/components/icon';
import { seatTakeable, type TripSeat } from '@/api/rides';
import { useNow } from '@/lib/use-now';
import { fontFamily, radius, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * The seat map (spec 04.2) — numbered seats, not a vehicle layout.
 *
 * Spec calls the seat map the module's centrepiece and draws it as the shape of the
 * actual vehicle, with window and aisle positions. That needs a layout per vehicle type
 * and it is Phase 3 work. What a prototype needs is the part underneath: which seats are
 * gone, which are mine, and what happens when two people reach for the same one. A grid
 * of numbers answers all three.
 *
 * **Colour is never the only signal** (spec 08.1). Every state pairs a colour with a
 * glyph and the seat number stays legible in all of them: a tick for your own selection,
 * a lock for one that is taken, a dot for one someone is still deciding about.
 *
 * **An expired hold renders as free**, exactly as the server treats it. The two have to
 * agree or the map greys out a seat the server will happily sell you.
 */

export type SeatView = TripSeat & { mine: boolean };

export function SeatMap({
  seats,
  me,
  selected,
  onToggle,
  disabled = false,
}: {
  seats: TripSeat[];
  me: string | null;
  selected: number[];
  onToggle: (seatNo: number) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  // Ticking state, not `Date.now()` during render — see `use-now.ts`. It is also what
  // makes a hold that has just run out appear free without waiting for a refetch.
  const now = useNow();

  return (
    <View>
      <View style={styles.grid}>
        {[...seats]
          .sort((a, b) => a.seat_no - b.seat_no)
          .map((seat) => {
            const takeable = seatTakeable(seat, me, now);
            const isSelected = selected.includes(seat.seat_no);
            const mineHeld = seat.status === 'held' && seat.held_by === me;
            const booked = seat.status === 'booked' || seat.status === 'blocked';
            // Held by somebody else and not yet expired.
            const contested = seat.status === 'held' && !mineHeld && !takeable;

            const background = isSelected
              ? colors.primary
              : booked
                ? colors.surfaceAlt
                : contested
                  ? colors.surfaceAlt
                  : colors.surface;

            const foreground = isSelected
              ? colors.onPrimary
              : booked || contested
                ? colors.textSecondary
                : colors.text;

            const glyph = isSelected
              ? 'check'
              : booked
                ? 'lock'
                : contested
                  ? 'clock'
                  : null;

            const stateKey = isSelected
              ? 'yours'
              : booked
                ? 'taken'
                : contested
                  ? 'beingTaken'
                  : 'free';

            return (
              <Pressable
                key={seat.seat_no}
                onPress={() => onToggle(seat.seat_no)}
                disabled={disabled || (!takeable && !isSelected)}
                accessibilityRole="checkbox"
                accessibilityState={{
                  checked: isSelected,
                  disabled: disabled || (!takeable && !isSelected),
                }}
                accessibilityLabel={t('rides.seatLabel', {
                  number: seat.seat_no,
                  state: t(`rides.seatState.${stateKey}`),
                })}
                style={({ pressed }) => [
                  styles.seat,
                  {
                    backgroundColor: background,
                    borderColor: isSelected ? colors.primary : colors.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text style={[type.body, styles.number, { color: foreground }]}>
                  {seat.seat_no}
                </Text>
                {glyph ? <Icon name={glyph} size={14} color={foreground} /> : null}
              </Pressable>
            );
          })}
      </View>

      {/* The key, because four states on a grid of numbers is not self-explanatory and
          this screen is where a misread costs somebody a seat. */}
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  seat: {
    width: 56,
    height: 56,
    borderRadius: radius.card,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: { fontFamily: fontFamily.semibold, fontWeight: '600' },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
    paddingTop: space.sm,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  swatch: { width: 12, height: 12, borderRadius: 3, borderWidth: 1 },
});
