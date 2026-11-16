-- `digilocker_sessions.status` mirrored the provider's vocabulary and now carries one
-- value of our own.
--
-- A session can come back from the provider as `succeeded` having shared nothing:
-- `documents_consented: []`, and the document endpoint answers "Consent for
-- driving_license not provided". Signing in succeeded; sharing a licence did not.
--
-- It cannot be filed as `succeeded`, because `digilocker-finish` short-circuits on that
-- status and would report a licence that was never fetched as verified. Nor is it
-- `failed`: nothing failed, the answer was simply no, and the driver's remedy is the
-- photograph path rather than a retry.

comment on column digilocker_sessions.status is
  'created | succeeded | failed | expired, from the provider — plus no_document, ours: '
  'the session succeeded but no driving licence was consented, so there was nothing to '
  'record.';
