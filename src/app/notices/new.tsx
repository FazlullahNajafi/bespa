import { useMemo, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Crypto from 'expo-crypto';

import { useTranslation } from '@/i18n';
import { BackLink } from '@/components/back-link';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { NoticeCard } from '@/components/notice-card';
import { PendingChip } from '@/components/pending-chip';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { usePublishNotice, type Notice, type NoticeCategory } from '@/api/notices';
import { useMyProfile } from '@/api/profile';
import { useGeoUnit } from '@/api/geo';
import { useSession } from '@/store/session';
import { fontFamily, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * Writing a village notice (spec 03.5).
 *
 * Who is expected to use this, decided 2026-11-02: not the sarpanch typing on a phone,
 * but whoever already runs the village WhatsApp group, holding `panchayat_admin` on his
 * nomination. Spec 09.3 risk 1b says the role is a role and not an office for exactly
 * this reason. That decision is why the screen is a plain form and not a camera: a photo
 * of the paper notice is the other honest answer and it waits on image storage.
 *
 * Everything that decides trust is server-side. `publish_notice` stamps `published_by`
 * with the caller and `source` with `local`, so nothing written here can dress itself up
 * as a government notice, and `admins_geo` refuses any unit the author does not
 * administer. This screen cannot grant itself anything by being wrong.
 */

const CATEGORIES: NoticeCategory[] = ['general', 'alert', 'event', 'order', 'vacation'];

/**
 * Expiry as a few choices rather than a date picker.
 *
 * A picker would mean `@react-native-community/datetimepicker`, which is native code and
 * therefore a new build — and it would ask someone to operate a calendar widget to say
 * "about a week". These are the answers people actually give.
 */
const DURATIONS = [
  { key: 'none', days: null },
  { key: 'week', days: 7 },
  { key: 'fortnight', days: 14 },
  { key: 'month', days: 30 },
] as const;

export default function NewNoticeScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();

  const { session } = useSession();
  const profile = useMyProfile(session?.user.id);
  const village = useGeoUnit(profile.data?.village_id);
  const publish = usePublishNotice();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<NoticeCategory>('general');
  const [pinned, setPinned] = useState(false);
  const [duration, setDuration] = useState<(typeof DURATIONS)[number]['key']>('none');
  const [error, setError] = useState<string | null>(null);
  const [queued, setQueued] = useState(false);

  // One id for the life of this screen, so a double tap on Publish is one notice and one
  // push rather than two. The outbox is unique on it.
  const draftId = useMemo(() => Crypto.randomUUID(), []);

  const trimmedTitle = title.trim();
  const trimmedBody = body.trim();
  const ready = Boolean(trimmedTitle && trimmedBody && profile.data?.village_id);

  /** What the card will look like, built from the draft rather than from the server. */
  const preview: Notice = {
    id: draftId,
    title: trimmedTitle || t('composer.titlePlaceholder'),
    body: trimmedBody,
    category,
    is_pinned: pinned,
    published_at: new Date().toISOString(),
    expires_at: null,
    source: 'local',
    source_url: null,
    notice_sources: null,
  };

  async function onPublish() {
    if (!ready || !profile.data?.village_id) return;
    setError(null);
    setQueued(false);

    const days = DURATIONS.find((d) => d.key === duration)?.days ?? null;
    const expiresAt =
      days === null ? null : new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    const result = await publish.mutateAsync({
      geoUnitId: profile.data.village_id,
      title: trimmedTitle,
      body: trimmedBody,
      category,
      isPinned: pinned,
      expiresAt,
      draftId,
    });

    if (result.ok) {
      router.back();
      return;
    }

    if ('queued' in result) {
      // Not a failure. The notice is durable in the outbox and will send — but it has not
      // reached anyone yet, and saying so is the difference between a sarpanch who checks
      // back and one who assumes the village has been told.
      setQueued(true);
      return;
    }

    setError(`errors.${result.code}`);
  }

  return (
    <Screen
      footer={
        <Button
          label={t('composer.publish', { village: village.data?.name_en ?? '' })}
          onPress={() => void onPublish()}
          loading={publish.isPending}
          disabled={!ready}
          accessibilityHint={t('composer.publishHint')}
        />
      }
    >
      <BackLink />
      <PendingChip />

      <View style={styles.header}>
        <Text style={[type.display, { color: colors.text }]}>{t('composer.title')}</Text>
        <Text style={[type.body, { color: colors.textSecondary }]}>
          {t('composer.subtitle', { village: village.data?.name_en ?? '' })}
        </Text>
      </View>

      <TextField
        label={t('composer.noticeTitle')}
        hint={t('composer.noticeTitleHint')}
        value={title}
        onChangeText={setTitle}
        maxLength={160}
        autoCapitalize="sentences"
      />

      <TextField
        label={t('composer.body')}
        hint={t('composer.bodyHint')}
        value={body}
        onChangeText={setBody}
        multiline
        numberOfLines={5}
        maxLength={2000}
        autoCapitalize="sentences"
      />

      <View style={styles.group}>
        <Text style={[type.bodySmall, styles.groupLabel, { color: colors.textSecondary }]}>
          {t('composer.category')}
        </Text>
        <View style={styles.chips}>
          {CATEGORIES.map((key) => (
            <Chip
              key={key}
              label={t(`notices.category.${key}`)}
              selected={category === key}
              onPress={() => setCategory(key)}
            />
          ))}
        </View>
        {/* Said plainly, because it is the one choice here with a cost: an alert makes a
            sound on every phone in the village. */}
        {category === 'alert' ? (
          <Text style={[type.caption, { color: colors.textSecondary }]}>
            {t('composer.alertNote')}
          </Text>
        ) : null}
      </View>

      <View style={styles.group}>
        <Text style={[type.bodySmall, styles.groupLabel, { color: colors.textSecondary }]}>
          {t('composer.until')}
        </Text>
        <View style={styles.chips}>
          {DURATIONS.map((d) => (
            <Chip
              key={d.key}
              label={t(`composer.duration.${d.key}`)}
              selected={duration === d.key}
              onPress={() => setDuration(d.key)}
            />
          ))}
        </View>
      </View>

      <View style={styles.pinRow}>
        <View style={styles.pinText}>
          <Text style={[type.bodySmall, styles.groupLabel, { color: colors.text }]}>
            {t('composer.pin')}
          </Text>
          <Text style={[type.caption, { color: colors.textSecondary }]}>
            {t('composer.pinHint')}
          </Text>
        </View>
        <Switch
          value={pinned}
          onValueChange={setPinned}
          accessibilityLabel={t('composer.pin')}
          trackColor={{ true: colors.primary, false: colors.border }}
        />
      </View>

      {/* Spec 03.5 asks for a preview, and this is the only place in the app where
          someone is about to reach a whole village at once. */}
      <View style={styles.group}>
        <Text style={[type.bodySmall, styles.groupLabel, { color: colors.textSecondary }]}>
          {t('composer.preview')}
        </Text>
        <NoticeCard notice={preview} onOpenDetail={() => {}} preview />
      </View>

      {queued ? <Banner message={t('composer.queued')} tone="info" /> : null}
      {error ? <Banner message={t(error)} tone="danger" /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.xs },
  group: { gap: space.sm },
  groupLabel: { fontFamily: fontFamily.semibold, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  pinRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  pinText: { flex: 1, gap: 2 },
});
