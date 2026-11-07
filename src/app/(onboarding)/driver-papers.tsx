import { useState } from 'react';

import { useTranslation } from '@/i18n';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { DriverDocs } from '@/components/driver-docs';
import { Screen } from '@/components/screen';
import { useMarkDriverDocsAsked } from '@/api/driver';

/**
 * The last onboarding step, for someone who said they drive a taxi (spec 04.5, design
 * `screens-driver-verify`).
 *
 * The design has verification "triggered when a user picks 'Taxi Driver' on the
 * occupation step", and the first attempt did that literally — the occupation screen
 * pushed the route. It never appeared: the auth gate routes with `replace` the instant
 * the profile refetches, and a push cannot win against that. A step in this app is a
 * flag on `profiles` that the gate reads, so this is one.
 *
 * **Asked, not required.** Both buttons finish the step. A driver with a licence in his
 * other pocket and no signal in the shop he is standing in must still reach the app, and
 * the real gate is server-side anyway: `create_trip` and `go_live` refuse an unverified
 * driver whatever this screen was told. All this has to do is make sure nobody arrives
 * at Transport without having been asked once.
 *
 * It sits after privacy rather than straight after the occupation step, because village
 * and privacy are what decide whether the app can show anything at all, and a new driver
 * should see a working app before being asked to photograph a licence.
 */
export default function DriverPapersStepScreen() {
  const { t } = useTranslation();
  const mark = useMarkDriverDocsAsked();
  const [error, setError] = useState<string | null>(null);

  async function finish() {
    setError(null);
    const result = await mark.mutateAsync();
    // On success the gate routes onward by itself once the profile refetches, exactly
    // as the occupation step does.
    if (!result.ok) setError(`errors.${result.code}`);
  }

  return (
    <Screen
      footer={
        <>
          <Button
            label={t('driver.doneForNow')}
            onPress={() => void finish()}
            loading={mark.isPending}
          />
          <Button
            label={t('driver.later')}
            variant="ghost"
            onPress={() => void finish()}
            accessibilityHint={t('driver.laterHint')}
          />
        </>
      }
    >
      {error ? <Banner message={t(error)} tone="danger" /> : null}
      <DriverDocs />
    </Screen>
  );
}
