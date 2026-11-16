import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon, type IconName } from '@/components/icon';
import { StatusPill } from '@/components/status-pill';
import {
  DRIVER_DOCS,
  stateOf,
  useMyDriverDocuments,
  useSubmitDriverDocument,
  type DocState,
  type DriverDocKind,
} from '@/api/driver';
import { useVerifyLicenceWithDigiLocker } from '@/api/digilocker';
import { useSession } from '@/store/session';
import { canPickImages, pickAndResize } from '@/lib/images';
import { fontFamily, radius, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * The driver's three documents (spec 04.5, design `screens-driver-verify`).
 *
 * A component rather than a screen, because it is reached two ways and must be the same
 * thing both times: once as the last onboarding step for someone who said they drive a
 * taxi, and afterwards from Transport whenever they want to send a better photograph.
 * Two copies of a checklist is two places for a document to go missing.
 *
 * The design's scope note is the whole brief and is followed exactly: *"We only confirm
 * that they ARE a taxi driver — no Aadhaar / KYC, no vehicle paperwork chase. Just the
 * two-or-three documents the RTO already issues."* Three rows, a progress strip, one
 * obvious action each, and nothing that asks for an identity number.
 *
 * **Only the licence is required**, and the screen says which. Spec 04.5 gates posting
 * on verification; gating it on all three would keep a licensed driver off the board
 * over a route permit he has not photographed, which empties the board for a clerical
 * reason rather than a safety one.
 *
 * **The licence row has two routes to the same `verified`.** DigiLocker fetches it from
 * the issuer, which needs no photograph and no reviewer; the camera path stays exactly as
 * it was, because a licence that exists only on paper is still the common case here and a
 * driver whose licence is not in DigiLocker must not be left at a dead end. The DigiLocker
 * button is the primary one only while the row is unsettled — see `api/digilocker.ts`.
 *
 * **The photos do not go to the gallery bucket.** `documents` is private to its owner
 * and a district reviewer — see `api/driver.ts`. A licence carries a name, an address
 * and a date of birth, and the village has no business with any of it.
 */

const DOC_ICON: Record<DriverDocKind, IconName> = {
  licence: 'car',
  permit: 'flag',
  badge: 'file',
};

function toneFor(state: DocState): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (state) {
    case 'verified':
      return 'success';
    case 'reviewing':
      return 'warning';
    case 'rejected':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function DriverDocs() {
  const { t } = useTranslation();
  const colors = useColors();

  const { session } = useSession();
  const docs = useMyDriverDocuments(Boolean(session));
  const submit = useSubmitDriverDocument();

  const digilocker = useVerifyLicenceWithDigiLocker();

  const [busy, setBusy] = useState<DriverDocKind | null>(null);
  const [note, setNote] = useState<{ key: string; bad: boolean } | null>(null);

  const byKind = useMemo(
    () => new Map((docs.data ?? []).map((doc) => [doc.kind, doc])),
    [docs.data],
  );

  const done = DRIVER_DOCS.filter((kind) => stateOf(byKind.get(kind)) === 'verified').length;
  const licenceVerified = stateOf(byKind.get('licence')) === 'verified';

  async function send(kind: DriverDocKind) {
    setNote(null);
    setBusy(kind);
    try {
      const picked = await pickAndResize(1);
      if (picked.status !== 'ok') {
        if (picked.status !== 'cancelled') setNote({ key: `places.pick.${picked.status}`, bad: true });
        return;
      }
      const result = await submit.mutateAsync({ kind, uri: picked.uris[0] as string });
      setNote(
        result.ok
          ? { key: 'driver.sent', bad: false }
          : { key: `errors.${result.code}`, bad: true },
      );
    } finally {
      setBusy(null);
    }
  }

  /**
   * Consent, then ask the server what happened.
   *
   * A cancelled run is reported with the `info` tone, not `danger`. Backing out of a
   * government consent screen is a choice, and DigiLocker not holding your licence is
   * ordinary here — neither is something to show a driver as an error when the
   * photograph path is sitting directly underneath.
   */
  async function verifyWithDigiLocker() {
    setNote(null);
    const outcome = await digilocker.mutateAsync();
    setNote(
      outcome.status === 'verified'
        ? { key: 'driver.digilocker.verified', bad: false }
        : outcome.status === 'cancelled'
          ? { key: 'driver.digilocker.cancelled', bad: false }
          : { key: `errors.${outcome.code}`, bad: true },
    );
  }

  return (
    <>
      <Text style={[type.caption, styles.eyebrow, { color: colors.textSecondary }]}>
        {t('driver.eyebrow')}
      </Text>
      <Text style={[type.display, { color: colors.text }]}>{t('driver.title')}</Text>
      <Text style={[type.bodySmall, { color: colors.textSecondary }]}>
        {t('driver.intro')}
      </Text>

      {note ? (
        <Banner message={t(note.key)} tone={note.bad ? 'danger' : 'info'} />
      ) : null}

      {/* The design's progress strip. Colour is never the only signal (spec 08.1), so
          the count is written out beside the bar rather than left to its length. */}
      <Card>
        <View style={styles.progressTop}>
          <Text style={[type.body, styles.bold, { color: colors.text }]}>
            {t('driver.progress', { done, total: DRIVER_DOCS.length })}
          </Text>
        </View>
        <View style={[styles.track, { backgroundColor: colors.borderSoft }]}>
          <View
            style={[
              styles.fill,
              {
                backgroundColor: colors.success,
                width: `${(done / DRIVER_DOCS.length) * 100}%`,
              },
            ]}
          />
        </View>
        <Text style={[type.caption, { color: colors.textSecondary }]}>
          {t('driver.reviewTime')}
        </Text>
      </Card>

      <Banner
        message={licenceVerified ? t('driver.verifiedNote') : t('driver.gateNote')}
        tone="info"
      />

      {docs.isPending ? (
        <ActivityIndicator accessibilityLabel={t('common.loading')} color={colors.primary} />
      ) : (
        DRIVER_DOCS.map((kind) => {
          const doc = byKind.get(kind);
          const state = stateOf(doc);
          const required = kind === 'licence';

          // DigiLocker holds driving licences and nothing else on this list, so the
          // option belongs on one row — and only while that row is still unsettled.
          const offerDigiLocker = kind === 'licence' && state !== 'verified';

          return (
            <Card key={kind}>
              <View style={styles.row}>
                <View style={[styles.badge, { backgroundColor: colors.surfaceAlt }]}>
                  <Icon name={DOC_ICON[kind]} size={20} color={colors.primary} />
                </View>
                <View style={styles.rowText}>
                  <Text style={[type.body, styles.bold, { color: colors.text }]}>
                    {t(`driver.doc.${kind}`)}
                  </Text>
                  <Text style={[type.caption, { color: colors.textSecondary }]}>
                    {t(`driver.doc.${kind}Sub`)}
                  </Text>
                </View>
              </View>

              <View style={styles.pills}>
                <StatusPill label={t(`driver.state.${state}`)} tone={toneFor(state)} />
                <Text style={[type.caption, styles.pillNote, { color: colors.textSecondary }]}>
                  {required ? t('driver.required') : t('driver.optional')}
                </Text>
              </View>

              {state === 'rejected' && doc?.reject_reason ? (
                <Text style={[type.caption, { color: colors.danger }]}>
                  {t('driver.rejectedBecause', { reason: doc.reject_reason })}
                </Text>
              ) : null}

              {/* An issuer-signed licence needs no reviewer and no photograph, so where
                  it exists it is the better route — hence the primary button, with the
                  camera demoted to the alternative beneath it. */}
              {doc?.verified_via === 'digilocker' ? (
                <Text style={[type.caption, { color: colors.textSecondary }]}>
                  {t('driver.digilocker.via')}
                </Text>
              ) : null}

              {offerDigiLocker ? (
                <>
                  <Text style={[type.caption, { color: colors.textSecondary }]}>
                    {t('driver.digilocker.hint')}
                  </Text>
                  <Button
                    label={t('driver.digilocker.cta')}
                    loading={digilocker.isPending}
                    onPress={() => void verifyWithDigiLocker()}
                  />
                  {/* Only where the button underneath really is "send a photo". While one
                      is already being checked that button says "Replace", and offering a
                      photo they have already sent reads as though it never arrived. */}
                  {state === 'reviewing' ? null : (
                    <Text
                      style={[type.caption, styles.alternative, { color: colors.textSecondary }]}
                    >
                      {t('driver.digilocker.or')}
                    </Text>
                  )}
                </>
              ) : null}

              {canPickImages() ? (
                <Button
                  label={
                    state === 'notUploaded'
                      ? t('driver.upload')
                      : state === 'rejected'
                        ? t('driver.reupload')
                        : t('driver.replace')
                  }
                  variant={
                    !offerDigiLocker && (state === 'notUploaded' || state === 'rejected')
                      ? 'primary'
                      : 'ghost'
                  }
                  loading={busy === kind}
                  onPress={() => void send(kind)}
                />
              ) : (
                <Banner message={t('places.pick.unsupported')} tone="danger" />
              )}
            </Card>
          );
        })
      )}
    </>
  );
}

const styles = StyleSheet.create({
  eyebrow: { textTransform: 'uppercase', letterSpacing: 0.6, fontFamily: fontFamily.semibold },
  progressTop: { flexDirection: 'row', alignItems: 'center' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', marginVertical: space.sm },
  fill: { height: '100%', borderRadius: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  badge: {
    width: 40,
    height: 40,
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  // The pill and its note sit on one line until they cannot. On the test device
  // "Being checked" + "Needed before you can post" ran off the right edge with the last
  // word cut in half — a row with no wrap does not shrink, it clips.
  pills: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space.sm,
    paddingTop: space.xs,
  },
  pillNote: { flexShrink: 1 },
  alternative: { textAlign: 'center' },
  bold: { fontFamily: fontFamily.semibold, fontWeight: '600' },
});
