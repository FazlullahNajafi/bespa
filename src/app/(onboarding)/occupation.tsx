import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { useTranslation } from '@/i18n';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Icon, type IconName } from '@/components/icon';
import { PendingChip } from '@/components/pending-chip';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { keys } from '@/api/keys';
import { useSetMyOccupation, type MyProfile } from '@/api/profile';
import { OCCUPATIONS, type Occupation } from '@/lib/occupations';
import { fontFamily, layout, radius, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * "Tell us about you" — the occupation step (spec 03.6, design `screens-profile.jsx`).
 *
 * The design puts this between sign-in and the location flow, and asks for the
 * occupation as a grid of icon tiles. It was missing: occupation lived only in profile
 * edit, which almost nobody opens, so the village directory — the whole point of spec
 * 03.3 — was heading for a list of names and nothing else. An occupation is also what
 * makes the directory *useful*: the reason to look someone up here is that they drive, or
 * teach, or run the shop.
 *
 * Tiles rather than the chips profile edit uses, because this is the second screen a new
 * user ever sees and fourteen words in a wrapped row is a wall. Each tile is an icon
 * *and* its word, per spec 08.6 — the icon is not decoration standing in for the label.
 *
 * Skippable, and the skip is a real button rather than a back gesture. Not every villager
 * has one job to name, and a required answer to an optional question is how you teach
 * someone to type nonsense into your directory.
 */

/**
 * One glyph per occupation. Hand-mapped rather than generated: `bell` for a hotel owner
 * is a front desk, `seat` for a transport operator is a bus, and nothing but reading the
 * list gets those right.
 */
const OCCUPATION_ICON: Record<Occupation, IconName> = {
  student: 'spark',
  farmer: 'mountain',
  teacher: 'file',
  shopkeeper: 'home',
  local_trader: 'people',
  hotel_owner: 'bell',
  driver: 'car',
  islamic_scholar: 'book',
  transport_operator: 'seat',
  government_employee: 'flag',
  health_worker: 'heart',
  engineer: 'settings',
  contractor: 'bricks',
  digital_creator: 'camera',
};

const OTHER = 'other';

export default function OccupationStepScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const client = useQueryClient();

  const save = useSetMyOccupation();

  const [pick, setPick] = useState<Occupation | typeof OTHER | null>(null);
  const [freeText, setFreeText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isOther = pick === OTHER;
  const value = isOther ? freeText.trim() || null : pick;

  async function finish(occupation: string | null) {
    setError(null);
    const result = await save.mutateAsync(occupation);

    // The gate routes onward once the profile refetches — including, for a driver, to
    // the papers step. Pushing that route from here was tried and never appeared: the
    // gate replaces it the instant the profile lands.
    if (result.ok) return;

    if ('queued' in result) {
      // Offline. The write is durable in the outbox, but the gate reads
      // `occupation_asked_at` from the server — so without this the user is held on this
      // screen, before they have a village and therefore before the app can show them
      // anything at all. Being stuck here is a far worse failure than a flag that is
      // locally true a few minutes early.
      client.setQueryData<MyProfile | null>(keys.me.profile(), (current) =>
        current
          ? {
              ...current,
              occupation: occupation ?? current.occupation,
              occupation_asked_at: new Date().toISOString(),
            }
          : current,
      );
      return;
    }

    setError(`errors.${result.code}`);
  }

  return (
    <Screen
      footer={
        <>
          <Button
            label={t('common.continue')}
            onPress={() => void finish(value)}
            loading={save.isPending}
            disabled={!value}
          />
          <Button
            label={t('occupationStep.skip')}
            variant="ghost"
            onPress={() => void finish(null)}
            disabled={save.isPending}
          />
        </>
      }
    >
      <PendingChip />

      <View style={styles.header}>
        <Text style={[type.display, { color: colors.text }]}>{t('occupationStep.title')}</Text>
        <Text style={[type.body, { color: colors.textSecondary }]}>
          {t('occupationStep.subtitle')}
        </Text>
      </View>

      <View style={styles.grid}>
        {OCCUPATIONS.map((key) => {
          const selected = pick === key;
          return (
            <Pressable
              key={key}
              onPress={() => setPick(selected ? null : key)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.tile,
                {
                  backgroundColor: colors.surface,
                  borderColor: selected ? colors.primary : colors.borderSoft,
                  borderWidth: selected ? 1.5 : StyleSheet.hairlineWidth * 2,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.glyph,
                  { backgroundColor: selected ? colors.primary : colors.surfaceAlt },
                ]}
              >
                <Icon
                  name={OCCUPATION_ICON[key]}
                  size={18}
                  color={selected ? colors.onPrimary : colors.primary}
                />
              </View>
              <Text
                style={[type.bodySmall, styles.tileLabel, { color: colors.text }]}
                numberOfLines={2}
              >
                {t(`profile.occupations.${key}`)}
              </Text>
              {/* Selection is a tick as well as a colour — spec 08.1 allows neither to
                  carry a state on its own. */}
              {selected ? (
                <View style={styles.tick}>
                  <Icon name="check" size={14} color={colors.primary} />
                </View>
              ) : null}
            </Pressable>
          );
        })}

        <Pressable
          onPress={() => setPick(isOther ? null : OTHER)}
          accessibilityRole="radio"
          accessibilityState={{ selected: isOther }}
          style={({ pressed }) => [
            styles.tile,
            {
              backgroundColor: colors.surface,
              borderColor: isOther ? colors.primary : colors.borderSoft,
              borderWidth: isOther ? 1.5 : StyleSheet.hairlineWidth * 2,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <View
            style={[
              styles.glyph,
              { backgroundColor: isOther ? colors.primary : colors.surfaceAlt },
            ]}
          >
            <Icon name="plus" size={18} color={isOther ? colors.onPrimary : colors.primary} />
          </View>
          <Text style={[type.bodySmall, styles.tileLabel, { color: colors.text }]}>
            {t('profile.occupations.other')}
          </Text>
          {isOther ? (
            <View style={styles.tick}>
              <Icon name="check" size={14} color={colors.primary} />
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* Spec 03.6 ends the list with "other + free text", which is why the column is
          text and not an enum. */}
      {isOther ? (
        <TextField
          label={t('profile.edit.occupationOther')}
          hint={t('profile.edit.occupationOtherHint')}
          value={freeText}
          onChangeText={setFreeText}
          autoCapitalize="sentences"
          maxLength={60}
        />
      ) : null}

      {error ? <Banner message={t(error)} tone="danger" /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: {
    // Two up, which is the design's grid: a basis under half leaves room for the gap,
    // and flexGrow shares out whatever is left on the row.
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: layout.tap + space.xl,
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.card,
  },
  glyph: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: { fontFamily: fontFamily.semibold, fontWeight: '600' },
  tick: { position: 'absolute', top: space.sm, right: space.sm },
});
