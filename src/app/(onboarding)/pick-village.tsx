import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import {
  useGeoChildren,
  useSetMyVillage,
  isTenancyLevel,
  type GeoNode,
} from '@/api/geo';
import { layout, radius, space, type } from '@/theme/tokens';
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
export default function PickVillageScreen() {
  const { t } = useTranslation();
  const colors = useColors();

  // The path walked so far. The last entry is the current parent.
  const [trail, setTrail] = useState<GeoNode[]>([]);
  const parent = trail.at(-1) ?? null;

  const [error, setError] = useState<string | null>(null);

  const children = useGeoChildren(parent?.id ?? null);
  const setVillage = useSetMyVillage();

  const selectedVillage = trail.find((n) => isTenancyLevel(n.type)) ?? null;
  const selectedPanchayat =
    selectedVillage && parent && parent.id !== selectedVillage.id ? parent : null;

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
      {trail.length > 0 ? (
        <View style={styles.trail}>
          {trail.map((node, index) => (
            <Pressable
              key={node.id}
              onPress={() => setTrail(trail.slice(0, index + 1))}
              accessibilityRole="button"
              accessibilityLabel={t('onboarding.backTo', { name: node.name_en })}
            >
              <Text style={[type.bodySmall, { color: colors.primary }]}>
                {index > 0 ? '  ›  ' : ''}
                {node.name_en}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {children.isPending ? (
        <ActivityIndicator accessibilityLabel={t('common.loading')} />
      ) : children.isError ? (
        <View style={[styles.banner, { backgroundColor: colors.infoSurface }]}>
          <Text style={[type.bodySmall, { color: colors.danger }]}>
            {t('errors.unknown')}
          </Text>
          <Button
            label={t('common.retry')}
            variant="ghost"
            onPress={() => void children.refetch()}
          />
        </View>
      ) : children.data && children.data.length > 0 ? (
        <View style={styles.list}>
          {children.data.map((node) => (
            <Pressable
              key={node.id}
              onPress={() => onPick(node)}
              accessibilityRole="button"
              accessibilityLabel={node.name_en}
              accessibilityHint={
                node.has_children ? t('onboarding.hasChildren') : t('onboarding.selectable')
              }
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: pressed ? colors.infoSurface : colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.rowText}>
                <Text style={[type.body, { color: colors.text }]}>{node.name_en}</Text>
                {node.name_ur ? (
                  <Text style={[type.bodySmall, { color: colors.textSecondary }]}>
                    {node.name_ur}
                  </Text>
                ) : null}
              </View>
              {node.has_children ? (
                <Text style={[type.body, { color: colors.textSecondary }]}>›</Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : (
        // Reached a leaf. If it is a village, the footer's confirm is the next action.
        <Text style={[type.body, { color: colors.textSecondary }]}>
          {selectedVillage ? t('onboarding.leafReady') : t('onboarding.leafEmpty')}
        </Text>
      )}

      {trail.length > 0 ? (
        <Button label={t('common.back')} variant="ghost" onPress={onBack} />
      ) : null}

      {error ? (
        <View style={[styles.banner, { backgroundColor: colors.infoSurface }]}>
          <Text accessibilityLiveRegion="polite" style={[type.bodySmall, { color: colors.danger }]}>
            {t(error)}
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.xs },
  trail: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  list: { gap: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: layout.tap,
    borderWidth: 1,
    borderRadius: radius.card,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  rowText: { flex: 1, gap: 2 },
  banner: { padding: space.md, borderRadius: radius.card, gap: space.sm },
});
