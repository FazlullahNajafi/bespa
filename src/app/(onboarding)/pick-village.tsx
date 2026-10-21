import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import { useTranslation } from '@/i18n';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Icon, type IconName } from '@/components/icon';
import { ListRow } from '@/components/list-row';
import { PendingChip } from '@/components/pending-chip';
import { Screen } from '@/components/screen';
import { Stepper } from '@/components/stepper';
import {
  useGeoChildren,
  useGeoNearest,
  useSetMyVillage,
  isTenancyLevel,
  PICKER_LEVELS,
  type GeoNode,
  type GeoType,
} from '@/api/geo';
import { canLocate, getFix } from '@/lib/location';
import { fontFamily, space, type } from '@/theme/tokens';
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
  town: 'town',
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
  const nearest = useGeoNearest();

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

  const canGoBack = trail.length > skipped;

  function onBack() {
    setError(null);
    setTrail((current) => current.slice(0, -1));
  }

  /**
   * Android's own Back button walks the trail back up, one level at a time.
   *
   * It has to be wired by hand because the walk is *state*, not navigation: the whole
   * cascade is one route, so Android's Back had nothing to pop and closed the app
   * instead — from Kargil into Gongma Minjee and then Back, and Bespa was gone. That is
   * a bad first minute for someone who mis-tapped a village.
   *
   * Returning `false` once the trail is back at the top hands Back to the system again,
   * so the gesture still leaves the app from the first screen rather than trapping
   * someone in onboarding.
   */
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (!canGoBack) return false;
        setError(null);
        setTrail((current) => current.slice(0, -1));
        return true;
      });
      return () => subscription.remove();
    }, [canGoBack]),
  );

  async function onConfirm() {
    if (!selectedVillage) return;
    setError(null);

    const result = await setVillage.mutateAsync({
      villageId: selectedVillage.id,
      panchayatId: selectedPanchayat?.id ?? null,
    });

    // On success the profile query is invalidated and the gate routes onward — this
    // screen does not navigate itself.
    //
    // Queued is not failure: offline, the choice is saved and will send on reconnect.
    // The gate cannot advance until the server has it, so say so rather than showing a
    // spinner that never resolves.
    if (!result.ok) {
      setError('queued' in result ? 'errors.queued' : `errors.${result.code}`);
    }
  }

  /**
   * The level being asked right now, taken from the rows on screen rather than from the
   * trail's depth — the walk can end in an optional panchayat step, which is below
   * `village` and not one of `PICKER_LEVELS`.
   */
  const rows = children.data ?? [];
  const level: GeoType | undefined = rows[0]?.type;
  // Kargil block holds both villages and the town (spec 02.2 draws Town as a sibling of
  // Village), so one level can be two kinds of place. Naming only the first one's kind
  // would put "Pick your village" over a list that contains the district headquarters.
  const mixed = rows.length > 0 && rows.some((node) => node.type !== level);
  const atStart = trail.length === skipped;

  // Only the levels this user will actually be asked about. Ladakh and Kargil are
  // auto-descended today, so the walk is Block then Village; seed a second district and
  // this grows a step without a change here.
  const steps = PICKER_LEVELS.slice(skipped).map((l) => t(`onboarding.step.${l}`));
  const stepIndex = Math.min(Math.max(trail.length - skipped, 0), Math.max(steps.length - 1, 0));

  const canConfirm = Boolean(selectedVillage) && !setVillage.isPending;

  /**
   * "Use my location" (design `screens-location.jsx`, the auto-detect card).
   *
   * It proposes, it never saves: the chain comes back, the trail jumps to it, and the
   * footer still asks for a confirmation by name. Someone standing in Gongma Minjee sees
   * "Confirm Gongma Minjee" and can disagree — which matters, because the server is
   * matching against centroids and 50 of 129 villages have none.
   */
  async function onDetect() {
    setError(null);

    const fix = await getFix();
    if (fix.status !== 'ok') {
      setError(`onboarding.detect.${fix.status}`);
      return;
    }

    try {
      const match = await nearest.mutateAsync(fix.fix);
      if (!match.match) {
        setError('onboarding.detect.notFound');
        return;
      }
      setTrail(match.chain);
    } catch {
      setError('errors.unknown');
    }
  }

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
      {/* Unsent work. Renders nothing unless something is queued, which is the normal
          case — it appears when a choice was made without a connection. */}
      <PendingChip />

      {/* A title per level, as the design has it ("Pick your district", "Pick your
          block", "Pick your village") rather than one question standing over the whole
          walk. The "why this matters" line belongs to the first screen only: by the
          third level it is a wall of text above the thing being chosen, and it has
          already been read or already been ignored. */}
      <View style={styles.header}>
        <Text style={[type.display, { color: colors.text }]}>
          {mixed
            ? t('onboarding.pickLevel.localityMixed')
            : level
              ? t(`onboarding.pickLevel.${level}`)
              : t('onboarding.title')}
        </Text>
        {atStart ? (
          <Text style={[type.body, { color: colors.textSecondary }]}>
            {t('onboarding.subtitle')}
          </Text>
        ) : null}
      </View>

      <Stepper steps={steps} current={stepIndex} />

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

      {/* The shortcut through the cascade, offered where the design offers it: at the
          top, above the manual list, on the first screen only. Hidden outright on a
          build without the native location module — a button that cannot work is worse
          than no button. */}
      {atStart && canLocate() ? (
        <>
          <Card>
            <View style={styles.detect}>
              <Icon name="locate" size={22} color={colors.primary} />
              <View style={styles.detectText}>
                <Text style={[type.bodySmall, styles.detectTitle, { color: colors.text }]}>
                  {t('onboarding.detect.title')}
                </Text>
                <Text style={[type.caption, { color: colors.textSecondary }]}>
                  {t('onboarding.detect.body')}
                </Text>
              </View>
            </View>
            <Button
              label={t('onboarding.detect.action')}
              variant="secondary"
              onPress={() => void onDetect()}
              loading={nearest.isPending}
              accessibilityHint={t('onboarding.detect.hint')}
            />
          </Card>

          <Text style={[type.caption, styles.divider, { color: colors.textFaint }]}>
            {t('onboarding.detect.or')}
          </Text>
        </>
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

      {canGoBack ? (
        <Button label={t('common.back')} variant="ghost" onPress={onBack} />
      ) : null}

      {/* A refused permission or a fix that did not land is not a failure — the list
          below was always the way through, and the banner says so in that tone. */}
      {error ? (
        <Banner
          message={t(error)}
          tone={
            error === 'errors.queued' || error.startsWith('onboarding.detect.')
              ? 'info'
              : 'danger'
          }
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.xs },
  detect: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  detectText: { flex: 1, gap: 2 },
  detectTitle: { fontFamily: fontFamily.semibold, fontWeight: '600' },
  divider: { textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.6 },
  trail: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  crumb: { flexDirection: 'row', alignItems: 'center' },
  crumbTap: { paddingVertical: space.xs, paddingHorizontal: space.xs },
  list: { gap: space.sm },
});
