import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Icon, type IconName } from '@/components/icon';
import { ListRow } from '@/components/list-row';
import { Screen } from '@/components/screen';
import {
  useGeoChildren,
  useSetMyVillage,
  isTenancyLevel,
  type GeoNode,
} from '@/api/geo';
import { space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * The cascading geo picker (spec 02.2, 10.5 Phase 0).
 *
 * Walks UT -> district -> block -> village, one level at a time. It stops at the first
 * node that is a valid tenancy level and has no children of its own; a village with
 * panchayats offers them as an optional final step.
 *
 * No free-text search and no "add my village": geo units are seeded from LGD codes and a
 * missing village is a support request, which is what keeps the namespace clean.
 */

/**
 * Each level gets its own glyph. Not decoration: spec 08.6 asks for an icon *and* a word
 * for every category, so someone who cannot read the level name still sees the shape of
 * the hierarchy as they descend it.
 */
const LEVEL_ICON: Record<GeoNode['type'], IconName> = {
  ut: 'mountain',
  district: 'pin',
  block: 'locate',
  village: 'home',
  town: 'home',
  panchayat: 'people',
  municipality: 'home',
};

export default function PickVillageScreen() {
  const { t } = useTranslation();
  const colors = useColors();

  // The path walked so far. The last entry is the current parent.
  const [trail, setTrail] = useState<GeoNode[]>([]);
  const parent = trail.at(-1) ?? null;

  /**
   * How many leading levels were skipped because they offered no actual choice.
   * Today that is Ladakh — the only UT — and Kargil while it is the only district: a
   * screen with one option is not a question. Those levels are hidden from the
   * breadcrumb and from Back, so the walk cannot return to a dead end.
   *
   * Driven by the data rather than hard-coded, so the step reappears by itself the day a
   * second district is seeded.
   */
  const [skipped, setSkipped] = useState(0);

  const [error, setError] = useState<string | null>(null);

  const children = useGeoChildren(parent?.id ?? null);
  const setVillage = useSetMyVillage();

  const selectedVillage = trail.find((n) => isTenancyLevel(n.type)) ?? null;
  const selectedPanchayat =
    selectedVillage && parent && parent.id !== selectedVillage.id ? parent : null;

  // A level with exactly one option is descended automatically — but never a selectable
  // one. Pashkum block has a single village, and auto-picking it would choose the user's
  // village for them, which is the one decision this screen exists to ask.
  //
  // Adjusted during render rather than in an effect. React re-runs this component before
  // committing, so the intermediate level never reaches the screen; an effect would paint
  // the one-option list first and then replace it, which reads as a flicker.
  const onlyChild = children.data?.length === 1 ? children.data[0] : null;
  if (onlyChild && !isTenancyLevel(onlyChild.type) && trail.length === skipped) {
    setTrail((current) => [...current, onlyChild]);
    setSkipped((n) => n + 1);
  }

  function onPick(node: GeoNode) {
    setError(null);
    setTrail((current) => [...current, node]);
  }

  function onBack() {
    setError(null);
    setTrail((current) => current.slice(0, -1));
  }

  async function onConfirm() {
    if (!selectedVillage) return;
    setError(null);

    const result = await setVillage.mutateAsync({
      villageId: selectedVillage.id,
      panchayatId: selectedPanchayat?.id ?? null,
    });

    // On success the profile query is invalidated and the gate routes onward — this
    // screen does not navigate itself.
    if (!result.ok) setError(`errors.${result.code}`);
  }

  const canConfirm = Boolean(selectedVillage) && !setVillage.isPending;

  return (
    <Screen
      footer={
        canConfirm ? (
          <Button
            label={t('onboarding.confirm', { village: selectedVillage?.name_en ?? '' })}
            onPress={onConfirm}
            loading={setVillage.isPending}
          />
        ) : undefined
      }
    >
      <View style={styles.header}>
        <Text style={[type.display, { color: colors.text }]}>{t('onboarding.title')}</Text>
        <Text style={[type.body, { color: colors.textSecondary }]}>
          {t('onboarding.subtitle')}
        </Text>
      </View>

      {/* Breadcrumb of the walk so far, tappable to go back up. */}
      {trail.length > skipped ? (
        <View style={styles.trail}>
          {trail.slice(skipped).map((node, i) => {
            const index = i + skipped;
            return (
            <View key={node.id} style={styles.crumb}>
              {index > skipped ? (
                <Icon name="chevron" size={14} color={colors.textFaint} />
              ) : null}
              <Pressable
                onPress={() => setTrail(trail.slice(0, index + 1))}
                accessibilityRole="button"
                accessibilityLabel={t('onboarding.backTo', { name: node.name_en })}
                style={styles.crumbTap}
              >
                <Text
                  style={[
                    type.bodySmall,
                    { color: index === trail.length - 1 ? colors.text : colors.primary },
                  ]}
                >
                  {node.name_en}
                </Text>
              </Pressable>
            </View>
            );
          })}
        </View>
      ) : null}

      {children.isPending ? (
        <ActivityIndicator accessibilityLabel={t('common.loading')} color={colors.primary} />
      ) : children.isError ? (
        <Banner
          message={t('errors.unknown')}
          action={
            <Button
              label={t('common.retry')}
              variant="secondary"
              onPress={() => void children.refetch()}
            />
          }
        />
      ) : children.data && children.data.length > 0 ? (
        <View style={styles.list}>
          {children.data.map((node) => (
            <ListRow
              key={node.id}
              title={node.name_en}
              // The Urdu name is the same place, not a description — showing it under the
              // English one is what makes the picker usable in either script.
              subtitle={node.name_ur ?? undefined}
              leading={<Icon name={LEVEL_ICON[node.type]} size={20} color={colors.primary} />}
              drills={node.has_children}
              onPress={() => onPick(node)}
              accessibilityHint={
                node.has_children ? t('onboarding.hasChildren') : t('onboarding.selectable')
              }
            />
          ))}
        </View>
      ) : (
        // Reached a leaf. If it is a village, the footer's confirm is the next action.
        <EmptyState
          icon={selectedVillage ? 'check' : 'search'}
          message={selectedVillage ? t('onboarding.leafReady') : t('onboarding.leafEmpty')}
        />
      )}

      {trail.length > skipped ? (
        <Button label={t('common.back')} variant="ghost" onPress={onBack} />
      ) : null}

      {error ? <Banner message={t(error)} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.xs },
  trail: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  crumb: { flexDirection: 'row', alignItems: 'center' },
  crumbTap: { paddingVertical: space.xs, paddingHorizontal: space.xs },
  list: { gap: space.sm },
});
