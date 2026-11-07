import { BackLink } from '@/components/back-link';
import { DriverDocs } from '@/components/driver-docs';
import { Screen } from '@/components/screen';

/**
 * Driver verification, reached from Transport after onboarding.
 *
 * The same checklist the onboarding step shows, in a screen with a back link. Everything
 * that decides anything lives in `DriverDocs`; this file exists so a driver who tapped
 * "later" during sign-up, or who needs to send a clearer photograph of a permit, has
 * somewhere to go.
 */
export default function DriverVerifyScreen() {
  return (
    <Screen>
      <BackLink />
      <DriverDocs />
    </Screen>
  );
}
