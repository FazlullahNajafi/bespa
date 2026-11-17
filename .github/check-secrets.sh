#!/usr/bin/env bash
#
# Are the two repository secrets the notice jobs need actually set?
#
# This exists because they were not, for two weeks, and nothing said so. Every
# secret-consuming step failed in under a second, GitHub mailed "all jobs have failed"
# after four seconds, and the only way to see why was a job log that needs authentication
# to read. 58 announce runs and 15 daily runs failed in a row — every run there had ever
# been — while the notice push and the keep-awake request looked configured.
#
# So the diagnosis is written where it can be read without logging in: the job summary.
# It names the missing secret, and when both are present it describes the key by shape
# without printing it, because "set but it is the publishable key" fails in exactly the
# same four seconds as "not set at all".
#
#   REQUIRE=1  exit 1 when unconfigured (the daily job: one visible failure a day)
#   otherwise  exit 0 and set configured=false (the quarter-hourly job, which must not
#              raise an alarm 96 times a day about a setup task you do once)
#
# SUPABASE_URL is not a secret — it is in CLAUDE.md and in the app bundle — so it is
# printed in full. SUPABASE_SERVICE_KEY maps to service_role and bypasses every policy,
# so only its length and prefix are ever shown.

set -uo pipefail

url="${SUPABASE_URL:-}"
key="${SUPABASE_SERVICE_KEY:-}"

note() { echo "$*" >> "${GITHUB_STEP_SUMMARY:-/dev/stdout}"; }

missing=""
[ -n "$url" ] || missing="SUPABASE_URL"
[ -n "$key" ] || missing="${missing:+$missing and }SUPABASE_SERVICE_KEY"

if [ -n "$missing" ]; then
  echo "configured=false" >> "${GITHUB_OUTPUT:-/dev/null}"

  note "## Not configured"
  note ""
  note "**$missing** is not set on this repository, so there is nothing to announce to."
  note ""
  note "Set both under **Settings → Secrets and variables → Actions → New repository"
  note "secret**:"
  note ""
  note '- `SUPABASE_URL` — `https://<project-ref>.supabase.co`'
  note '- `SUPABASE_SERVICE_KEY` — the `sb_secret_…` key from the Supabase dashboard'
  note '  (Project Settings → API keys). It reads push tokens, which no other key may'
  note '  do, and it belongs in this store and nowhere in the repository.'
  note ""
  note "Until then no notice is pushed to any phone, and the request that keeps a free"
  note "Supabase project from pausing is never made."

  echo "::warning::$missing is not set — see the job summary"
  [ "${REQUIRE:-0}" = "1" ] && exit 1
  exit 0
fi

echo "SUPABASE_URL = $url"

# The shape of the key is checked before anything is reported as configured: a key that
# is set but is the wrong one fails in exactly the same four seconds as no key at all.
case "$key" in
  sb_secret_*)
    echo "SUPABASE_SERVICE_KEY = sb_secret_… (${#key} characters)"
    ;;
  eyJ*)
    echo "SUPABASE_SERVICE_KEY = a legacy service_role JWT (${#key} characters)"
    ;;
  sb_publishable_*|sb_anon_*)
    note "## Wrong key"
    note ""
    note '`SUPABASE_SERVICE_KEY` holds the **publishable** key. A push token is closed to'
    note 'it by design, so every send would return nothing to do while looking healthy.'
    note 'Use the `sb_secret_…` key.'
    echo "::error::SUPABASE_SERVICE_KEY is the publishable key, not the secret one"
    exit 1
    ;;
  *)
    echo "SUPABASE_SERVICE_KEY = unrecognised prefix (${#key} characters)"
    ;;
esac

echo "configured=true" >> "${GITHUB_OUTPUT:-/dev/null}"
