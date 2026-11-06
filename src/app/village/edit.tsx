import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { BackLink } from '@/components/back-link';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import {
  latestByMetric,
  useDeleteVillageStat,
  useSetVillageProfile,
  useSetVillageStat,
  useVillageProfile,
  useVillageStats,
} from '@/api/village';
import { useMyAdminUnits, useMyProfile } from '@/api/profile';
import { useSession } from '@/store/session';
import { canPickImages, pickAndResize } from '@/lib/images';
import { KNOWN_METRICS, formatMetric, humanise, labelKeyFor } from '@/lib/metrics';
import { fontFamily, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * Where an admin writes the village page and publishes its figures (spec 03.1).
 *
 * **A figure is published one at a time, with its year and its source.** Not a form of
 * eight boxes: the eight metrics are a *suggested* set, a village will have two of them
 * and then a third a year later, and a grid of empty boxes asks someone to invent
 * numbers to fill it. One at a time also means the year and source fields are impossible
 * to skip, which is the rule the server enforces anyway.
 *
 * **The year is asked for explicitly and defaults to nothing.** Defaulting it to the
 * current year is the single most dangerous convenience available here — it would stamp
 * a 2011 census figure as 2026 with one unnoticed tap, which is exactly the error the
 * whole row design exists to prevent.
 *
 * The metric is a chip row of the known keys plus an escape hatch for anything else,
 * because `metric_key` is deliberately not an enum: a village that wants to publish
 * `water_connections` should not need a migration.
 */

export default function VillageEditScreen() {
  const { t } = useTranslation();
  const colors = useColors();

  const { session } = useSession();
  const profile = useMyProfile(session?.user.id);
  const adminUnits = useMyAdminUnits(session?.user.id);
  const villageId = profile.data?.village_id ?? null;

  const canEdit =
    Boolean(villageId) &&
    ((adminUnits.data ?? []).length > 0 ||
      (profile.data?.roles ?? []).includes('super_admin'));

  const page = useVillageProfile(villageId);
  const stats = useVillageStats(villageId);
  const savePage = useSetVillageProfile();
  const saveStat = useSetVillageStat();
  const removeStat = useDeleteVillageStat();

  // `undefined` means "not touched", so the field shows what is stored until the admin
  // types — the same shape `profile/edit.tsx` uses.
  const [description, setDescription] = useState<string | undefined>();
  const [history, setHistory] = useState<string | undefined>();
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const [metric, setMetric] = useState<string>('population_total');
  const [customKey, setCustomKey] = useState('');
  const [value, setValue] = useState('');
  const [year, setYear] = useState('');
  const [source, setSource] = useState('');
  const [statNote, setStatNote] = useState<{ key: string; bad: boolean } | null>(null);

  const descriptionValue = description ?? page.data?.description ?? '';
  const historyValue = history ?? page.data?.history_note ?? '';

  const latest = useMemo(() => latestByMetric(stats.data ?? []), [stats.data]);

  const metricKey = metric === 'other' ? customKey.trim().toLowerCase() : metric;

  async function chooseCover() {
    setNote(null);
    const picked = await pickAndResize(1);
    if (picked.status !== 'ok') {
      if (picked.status !== 'cancelled') setNote(`places.pick.${picked.status}`);
      return;
    }
    setCoverUri(picked.uris[0] ?? null);
  }

  async function savePageDetails() {
    if (!villageId) return;
    setNote(null);

    const result = await savePage.mutateAsync({
      draft: {
        villageId,
        description: descriptionValue.trim() || null,
        historyNote: historyValue.trim() || null,
      },
      coverUri,
    });

    if (result.ok) {
      setCoverUri(null);
      setNote('village.saved');
    } else if ('queued' in result) {
      setCoverUri(null);
      setNote('village.queued');
    } else {
      setNote(`errors.${result.code}`);
    }
  }

  async function publishStat() {
    if (!villageId) return;
    setStatNote(null);

    if (!/^[a-z][a-z0-9_]{2,48}$/.test(metricKey)) {
      setStatNote({ key: 'village.statKeyRequired', bad: true });
      return;
    }
    const numeric = Number(value.replace(/,/g, ''));
    if (!value.trim() || Number.isNaN(numeric) || numeric < 0) {
      setStatNote({ key: 'village.statValueRequired', bad: true });
      return;
    }
    const numericYear = Number(year);
    if (!/^\d{4}$/.test(year.trim()) || numericYear < 1871 || numericYear > 2100) {
      setStatNote({ key: 'village.statYearRequired', bad: true });
      return;
    }
    // The server refuses this too; catching it here saves a round trip and says so in
    // the right place on the form.
    if (!source.trim()) {
      setStatNote({ key: 'village.statSourceRequired', bad: true });
      return;
    }

    const result = await saveStat.mutateAsync({
      villageId,
      metricKey,
      value: numeric,
      year: numericYear,
      source: source.trim(),
    });

    if (result.ok || 'queued' in result) {
      setValue('');
      setYear('');
      setSource('');
      setCustomKey('');
      setStatNote({ key: result.ok ? 'village.statPublished' : 'village.queued', bad: false });
      return;
    }
    setStatNote({ key: `errors.${result.code}`, bad: true });
  }

  if (!canEdit) {
    return (
      <Screen>
        <BackLink />
        <Banner message={t('errors.not_permitted')} tone="danger" />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <Button
          label={t('village.save')}
          onPress={() => void savePageDetails()}
          loading={savePage.isPending}
        />
      }
    >
      <BackLink />

      <Text style={[type.display, { color: colors.text }]}>{t('village.edit')}</Text>
      <Text style={[type.bodySmall, { color: colors.textSecondary }]}>
        {t('village.editHint')}
      </Text>

      {note ? (
        <Banner message={t(note)} tone={note.startsWith('errors.') ? 'danger' : 'info'} />
      ) : null}

      <TextField
        label={t('village.description')}
        hint={t('village.descriptionHint')}
        value={descriptionValue}
        onChangeText={setDescription}
        maxLength={2000}
        multiline
        autoCapitalize="sentences"
      />

      <TextField
        label={t('village.historyNote')}
        hint={t('village.historyHint')}
        value={historyValue}
        onChangeText={setHistory}
        maxLength={4000}
        multiline
        autoCapitalize="sentences"
      />

      <Text style={[type.bodySmall, styles.heading, { color: colors.text }]}>
        {t('village.cover')}
      </Text>
      <Text style={[type.caption, { color: colors.textSecondary }]}>
        {t('village.coverHint')}
      </Text>
      {canPickImages() ? (
        <Button
          label={t('village.coverChoose')}
          variant="secondary"
          leading={<Icon name="camera" size={20} color={colors.primary} />}
          onPress={() => void chooseCover()}
        />
      ) : null}
      {coverUri ? (
        <Text style={[type.caption, { color: colors.textSecondary }]}>
          {t('village.coverChosen')}
        </Text>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      <Text style={[type.bodySmall, styles.heading, { color: colors.text }]}>
        {t('village.addStat')}
      </Text>
      <Banner message={t('village.statsCensusNote')} tone="info" />

      {statNote ? (
        <Banner message={t(statNote.key)} tone={statNote.bad ? 'danger' : 'info'} />
      ) : null}

      <Text style={[type.caption, { color: colors.textSecondary }]}>
        {t('village.statMetric')}
      </Text>
      <View style={styles.chips}>
        {KNOWN_METRICS.map((key) => (
          <Chip
            key={key}
            label={t(`village.metric.${key}`)}
            selected={metric === key}
            onPress={() => setMetric(key)}
          />
        ))}
        <Chip
          label={t('village.statMetricOther')}
          selected={metric === 'other'}
          onPress={() => setMetric('other')}
        />
      </View>

      {metric === 'other' ? (
        <TextField
          label={t('village.statMetricKey')}
          hint={t('village.statMetricKeyHint')}
          value={customKey}
          onChangeText={setCustomKey}
          maxLength={48}
          autoCapitalize="none"
          autoCorrect={false}
        />
      ) : null}

      <TextField
        label={t('village.statValue')}
        value={value}
        onChangeText={setValue}
        keyboardType="numeric"
        maxLength={12}
      />
      <TextField
        label={t('village.statYear')}
        hint={t('village.statYearHint')}
        value={year}
        onChangeText={setYear}
        keyboardType="number-pad"
        maxLength={4}
      />
      <TextField
        label={t('village.statSource')}
        hint={t('village.statSourceHint')}
        value={source}
        onChangeText={setSource}
        maxLength={200}
        autoCapitalize="sentences"
      />

      <Button
        label={t('village.statPublish')}
        variant="secondary"
        loading={saveStat.isPending}
        onPress={() => void publishStat()}
      />

      {latest.length > 0 ? (
        <Card>
          <View style={styles.list}>
            {latest.map((stat) => {
              const key = labelKeyFor(stat.metric_key);
              return (
                <View key={`${stat.metric_key}-${stat.year}`} style={styles.row}>
                  <View style={styles.rowText}>
                    <Text style={[type.bodySmall, { color: colors.text }]}>
                      {key ? t(key) : humanise(stat.metric_key)} · {formatMetric(stat)}
                    </Text>
                    <Text style={[type.caption, { color: colors.textSecondary }]}>
                      {t('village.sourceYear', { source: stat.source, year: stat.year })}
                    </Text>
                  </View>
                  <Button
                    label={t('village.statRemove')}
                    variant="ghost"
                    onPress={() =>
                      void removeStat.mutateAsync({
                        villageId: villageId as string,
                        metricKey: stat.metric_key,
                        year: stat.year,
                      })
                    }
                  />
                </View>
              );
            })}
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontFamily: fontFamily.semibold, fontWeight: '600', paddingTop: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  list: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rowText: { flex: 1 },
});
