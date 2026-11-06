import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import i18n, { useTranslation } from '@/i18n';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { formatDMY, fromISODate, toISODate } from '@/lib/format-date';
import { fontFamily, layout, radius, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * A calendar, written here rather than installed.
 *
 * `@react-native-community/datetimepicker` is the obvious answer and it is native code,
 * which means a new EAS build before anyone can tap it — and on Android it opens the
 * system dialog, whose date order follows the *handset's* locale rather than the app's.
 * A month grid is about a hundred lines, ships over Metro, and lets this screen say
 * `06-11-2026` and name the month above the grid so the order is never in doubt.
 *
 * Built for the hands using it:
 *
 * - **Days are 44pt**, the floor from spec 08.6, in a seven-column grid. A calendar with
 *   32pt cells is a calendar people mis-tap.
 * - **Past days are disabled, not hidden.** A greyed-out 4th next to a tappable 5th
 *   tells you where you are in the month; a month that starts on the 5th does not.
 * - **Today is ringed**, so "which day is it" never needs another screen.
 * - The month name is spelled, in the app's language — the same rule `formatDay`
 *   follows and the reason the numeric form is safe here.
 */

const WEEK_START = 1; // Monday. India's calendars run Mon–Sun.

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * The month as rows of exactly seven, with nulls padding both ends.
 *
 * Chunked rather than left to `flexWrap`. A wrapping row of seven 44pt cells inside a
 * 308pt container is exactly full, and "exactly full" loses to sub-pixel rounding: on
 * the test device the seventh cell wrapped, Sunday's column sat empty, and every date
 * rendered one weekday to the left of the truth. A calendar that is confidently wrong
 * is worse than one that is visibly broken, and this shape cannot do it.
 */
function monthWeeks(month: Date): (Date | null)[][] {
  const first = startOfMonth(month);
  const lead = (first.getDay() - WEEK_START + 7) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

  const cells: (Date | null)[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= days; day += 1) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), day));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function DatePicker({
  value,
  onChange,
  label,
  minDate,
}: {
  /** ISO `YYYY-MM-DD`, or empty for nothing chosen. */
  value: string;
  onChange: (iso: string) => void;
  label: string;
  /** Defaults to today — a trip cannot be posted into the past. */
  minDate?: Date;
}) {
  const { t } = useTranslation();
  const colors = useColors();

  const chosen = useMemo(() => (value ? fromISODate(value) : null), [value]);
  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);
  const floor = minDate ?? today;

  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => startOfMonth(chosen ?? today));

  const weeks = useMemo(() => monthWeeks(month), [month]);

  const weekdays = useMemo(() => {
    // Rendered from a real week so the names follow the app's language rather than a
    // hard-coded English list.
    const base = new Date(2026, 0, 5); // a Monday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return d.toLocaleDateString(i18n.language, { weekday: 'narrow' });
    });
  }, []);

  const monthLabel = month.toLocaleDateString(i18n.language, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <View style={styles.wrap}>
      <Text style={[type.bodySmall, { color: colors.textSecondary }]}>{label}</Text>

      <Pressable
        onPress={() => {
          setMonth(startOfMonth(chosen ?? today));
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={
          chosen ? t('date.chosen', { date: formatDMY(chosen) }) : t('date.choose')
        }
        style={({ pressed }) => [
          styles.trigger,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Icon name="clock" size={18} color={colors.primary} />
        <Text
          style={[
            type.body,
            styles.triggerText,
            { color: chosen ? colors.text : colors.textSecondary },
          ]}
        >
          {chosen ? formatDMY(chosen) : t('date.choose')}
        </Text>
        <Icon name="chevron" size={16} color={colors.textSecondary} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        {/* Tapping the dark area closes, which is what every Android user expects and
            what the back button does too, through `onRequestClose`. */}
        <Pressable
          style={styles.backdrop}
          onPress={() => setOpen(false)}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
        >
          {/* Swallows taps so a press inside the sheet does not close it. */}
          <Pressable
            style={[styles.sheet, { backgroundColor: colors.surface }]}
            onPress={() => {}}
          >
            <View style={styles.header}>
              <Pressable
                onPress={() => setMonth((m) => addMonths(m, -1))}
                accessibilityRole="button"
                accessibilityLabel={t('date.previousMonth')}
                style={styles.arrow}
              >
                <Icon name="back" size={20} color={colors.primary} />
              </Pressable>

              <Text style={[type.body, styles.monthLabel, { color: colors.text }]}>
                {monthLabel}
              </Text>

              <Pressable
                onPress={() => setMonth((m) => addMonths(m, 1))}
                accessibilityRole="button"
                accessibilityLabel={t('date.nextMonth')}
                style={styles.arrow}
              >
                <Icon name="arrow" size={20} color={colors.primary} />
              </Pressable>
            </View>

            <View style={styles.week}>
              {weekdays.map((name, i) => (
                <Text
                  key={`${name}-${i}`}
                  style={[type.caption, styles.weekday, { color: colors.textSecondary }]}
                >
                  {name}
                </Text>
              ))}
            </View>

            {weeks.map((week, w) => (
              <View key={`w-${w}`} style={styles.week}>
                {week.map((day, index) => {
                  if (!day) return <View key={`blank-${w}-${index}`} style={styles.cell} />;

                  const disabled = day < floor;
                  const isChosen = chosen !== null && sameDay(day, chosen);
                  const isToday = sameDay(day, today);

                  return (
                    <Pressable
                      key={day.toISOString()}
                      disabled={disabled}
                      onPress={() => {
                        onChange(toISODate(day));
                        setOpen(false);
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isChosen, disabled }}
                      accessibilityLabel={formatDMY(day)}
                      style={({ pressed }) => [
                        styles.cell,
                        isChosen && { backgroundColor: colors.primary },
                        !isChosen &&
                          isToday && { borderWidth: 1, borderColor: colors.primary },
                        { opacity: disabled ? 0.3 : pressed ? 0.7 : 1 },
                      ]}
                    >
                      <Text
                        style={[
                          type.body,
                          isChosen && styles.bold,
                          { color: isChosen ? colors.onPrimary : colors.text },
                        ]}
                      >
                        {day.getDate()}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}

            <Button
              label={t('common.cancel')}
              variant="ghost"
              onPress={() => setOpen(false)}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const CELL = 44; // spec 08.6's floor, and the smallest a calendar day should ever be
/**
 * The week row and the day grid are pinned to exactly seven cells.
 *
 * Without it they are a `flexWrap` row inside whatever width the sheet happened to get,
 * and on a 360dp screen that worked out at 304dp — four short of 7×44. The seventh
 * column wrapped, every date landed one weekday to the left of where it belonged, and
 * the calendar was confidently wrong rather than visibly broken. Found on the device.
 */
const GRID = CELL * 7;

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: layout.tap,
    borderWidth: 1,
    borderRadius: radius.card,
    paddingHorizontal: space.md,
  },
  triggerText: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.sm,
  },
  sheet: {
    borderRadius: radius.card,
    padding: space.sm,
    gap: space.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', width: GRID },
  arrow: {
    width: layout.tap,
    height: layout.tap,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fontFamily.semibold,
    fontWeight: '600',
  },
  week: { flexDirection: 'row', width: GRID },
  weekday: { width: CELL, textAlign: 'center' },
  cell: {
    width: CELL,
    height: CELL,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  bold: { fontFamily: fontFamily.semibold, fontWeight: '600' },
});
