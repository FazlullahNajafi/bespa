import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { useTranslation } from '@/i18n';
import { BackLink } from '@/components/back-link';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import {
  useDocumentUrl,
  useDriverQueue,
  useReviewDriverDocument,
  type QueueRow,
} from '@/api/driver';
import { useMyProfile } from '@/api/profile';
import { useSession } from '@/store/session';
import { relativeDate } from '@/lib/relative-date';
import { fontFamily, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * The reviewer's queue (spec 04.5).
 *
 * **Not an admin screen in the village sense.** A panchayat admin administers a village;
 * a driving licence is a district matter, and the server refuses them. Only
 * `district_admin` and `super_admin` — the two roles deliberately not pinned to a
 * geography — reach anything here.
 *
 * **The document opens in the browser, not inline.** A signed URL lasts fifteen minutes
 * and a licence has small print; an in-app thumbnail someone has to squint at is how a
 * document gets approved without being read. Opening it full-screen is the honest way to
 * ask somebody to actually look.
 *
 * A refusal carries a reason because the driver reads it and has to know what to send
 * instead — the server refuses one without, so this is not a nicety the client could
 * skip.
 */

function QueueCard({
  row,
  onDecide,
  busy,
}: {
  row: QueueRow;
  onDecide: (approve: boolean, reason: string) => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const url = useDocumentUrl(row.storage_path);
  const [reason, setReason] = useState('');
  const when = relativeDate(row.submitted_at);

  return (
    <Card>
      <Text style={[type.body, styles.bold, { color: colors.text }]}>
        {row.full_name ?? ''}
      </Text>
      <Text style={[type.bodySmall, { color: colors.textSecondary }]}>
        {t(`driver.doc.${row.kind}`)}
      </Text>
      <Text style={[type.caption, { color: colors.textSecondary }]}>
        {t(when.key, when.values)}
      </Text>

      <Button
        label={t('driver.openDoc')}
        variant="secondary"
        disabled={!url.data}
        onPress={() => void WebBrowser.openBrowserAsync(url.data as string)}
      />

      <TextField
        label={t('driver.reason')}
        hint={t('driver.reasonHint')}
        value={reason}
        onChangeText={setReason}
        maxLength={200}
        autoCapitalize="sentences"
      />

      <View style={styles.actions}>
        <View style={styles.action}>
          <Button
            label={t('driver.approve')}
            disabled={busy}
            onPress={() => onDecide(true, '')}
          />
        </View>
        <View style={styles.action}>
          <Button
            label={t('driver.reject')}
            variant="danger"
            disabled={busy}
            onPress={() => onDecide(false, reason)}
          />
        </View>
      </View>
    </Card>
  );
}

export default function DriverReviewScreen() {
  const { t } = useTranslation();
  const colors = useColors();

  const { session } = useSession();
  const profile = useMyProfile(session?.user.id);
  const roles = profile.data?.roles ?? [];
  const canReview = roles.includes('district_admin') || roles.includes('super_admin');

  const queue = useDriverQueue(canReview);
  const review = useReviewDriverDocument();
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => queue.data ?? [], [queue.data]);

  async function decide(row: QueueRow, approve: boolean, reason: string) {
    setError(null);
    if (!approve && !reason.trim()) {
      setError('driver.reasonRequired');
      return;
    }
    const result = await review.mutateAsync({
      driver: row.user_id,
      kind: row.kind,
      approve,
      reason: approve ? undefined : reason.trim(),
    });
    if (!result.ok) setError(`errors.${result.code}`);
  }

  return (
    <Screen>
      <BackLink />

      <Text style={[type.display, { color: colors.text }]}>{t('driver.queue')}</Text>
      <Text style={[type.bodySmall, { color: colors.textSecondary }]}>
        {t('driver.queueIntro')}
      </Text>

      {error ? <Banner message={t(error)} tone="danger" /> : null}

      {!canReview ? (
        <Banner message={t('errors.not_permitted')} tone="danger" />
      ) : queue.isPending ? (
        <ActivityIndicator accessibilityLabel={t('common.loading')} color={colors.primary} />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState icon="check" message={t('driver.queueEmpty')} />
        </Card>
      ) : (
        rows.map((row) => (
          <QueueCard
            key={`${row.user_id}-${row.kind}`}
            row={row}
            busy={review.isPending}
            onDecide={(approve, reason) => void decide(row, approve, reason)}
          />
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bold: { fontFamily: fontFamily.semibold, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: space.sm, paddingTop: space.xs },
  action: { flex: 1 },
});
