import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { BackLink } from '@/components/back-link';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { useMyProfile } from '@/api/profile';
import { useSession } from '@/store/session';
import { canPickImages, pickResizeUpload, MAX_EDGE, type Timings } from '@/lib/images';
import { fontFamily, radius, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * The Phase 1 image spike (spec 10.5), and a developer screen rather than a feature.
 *
 * Spec 10.5 asks for the pipeline to be *measured* — "pick → resize to ≤1600px → upload →
 * CDN transform → render, measured on a throttled connection with a real 4 MB photo" —
 * before Places, Gallery, the Home banner and the village cover are designed on top of
 * it. This screen is that measurement: it runs the real pipeline against the real bucket
 * and prints what each stage cost.
 *
 * It lives under `_dev/` and is reachable only by typing the route. It is not linked
 * from anywhere, because it uploads to the village's bucket and nobody should find it by
 * accident.
 *
 * Rendering is `expo-image` rather than React Native's `Image`: it has the disk cache
 * that makes a second look at a gallery free, and a `transition` that stops the grid
 * flashing white on every scroll — both of which matter more on a slow connection than
 * on a fast one.
 */

function kb(bytes: number) {
  return `${Math.round(bytes / 1024)} KB`;
}

function Row({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={styles.row}>
      <Text style={[type.bodySmall, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[type.bodySmall, styles.value, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

export default function ImageSpikeScreen() {
  const colors = useColors();
  const { session } = useSession();
  const profile = useMyProfile(session?.user.id);

  const [busy, setBusy] = useState(false);
  const [timings, setTimings] = useState<Timings | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const villageId = profile.data?.village_id ?? null;
  const userId = session?.user.id ?? null;
  const supported = canPickImages();

  async function run() {
    if (!villageId || !userId) return;
    setBusy(true);
    setNote(null);
    try {
      const result = await pickResizeUpload(villageId, userId);
      if (result.status === 'ok') {
        setTimings(result.timings);
        setUrl(result.url);
        return;
      }
      setNote(
        result.status === 'failed'
          ? `failed: ${result.reason}`
          : `${result.status} — nothing uploaded`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <BackLink />

      <Text style={[type.display, { color: colors.text }]}>Image pipeline</Text>
      <Text style={[type.bodySmall, { color: colors.textSecondary }]}>
        Developer screen (spec 10.5 spike). Picks a photo, resizes the long edge to{' '}
        {MAX_EDGE}px, uploads to the private `images` bucket, and reads it back through a
        signed URL. Every stage is timed.
      </Text>

      {!supported ? (
        <Banner
          message="This build has no image picker. It needs a new development build — the picker and manipulator are native modules."
          tone="info"
        />
      ) : null}

      <Button
        label={busy ? 'Running…' : 'Pick a photo and measure'}
        onPress={() => void run()}
        loading={busy}
        disabled={!supported || !villageId}
      />

      {note ? <Banner message={note} tone="info" /> : null}

      {timings ? (
        <Card>
          <Row label="Original" value={kb(timings.originalBytes)} />
          <Row label="Uploaded" value={kb(timings.uploadedBytes)} />
          <Row
            label="Shrunk by"
            value={
              timings.originalBytes
                ? `${Math.round((1 - timings.uploadedBytes / timings.originalBytes) * 100)}%`
                : '—'
            }
          />
          <View style={[styles.rule, { backgroundColor: colors.borderSoft }]} />
          <Row label="Pick (incl. you choosing)" value={`${timings.pickMs} ms`} />
          <Row label="Resize" value={`${timings.resizeMs} ms`} />
          <Row label="Upload" value={`${timings.uploadMs} ms`} />
          <Row label="Sign" value={`${timings.signMs} ms`} />
          <View style={[styles.rule, { backgroundColor: colors.borderSoft }]} />
          <Row label="Total" value={`${timings.totalMs} ms`} />
        </Card>
      ) : null}

      {url ? (
        <Image
          source={{ uri: url }}
          style={[styles.preview, { backgroundColor: colors.surfaceAlt }]}
          contentFit="cover"
          transition={200}
          accessibilityLabel="The uploaded photo, read back through a signed URL"
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  value: { fontFamily: fontFamily.semibold, fontWeight: '600' },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: space.xs },
  preview: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.card },
});
