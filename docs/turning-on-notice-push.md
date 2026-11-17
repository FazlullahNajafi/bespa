# Turning on notice push

Two repository secrets, set once. Until they exist the scheduled jobs do nothing: no
notice reaches a phone as a notification, and the request that stops a free Supabase
project from pausing is never made.

They were missing from 2 November 2026 until this was written, and nothing said so —
every run failed in four seconds and the mail said only that a run had failed.

## What you need

**`SUPABASE_URL`** — not a secret, but the jobs read it from the same place:

```
https://oibfmuwjzzbqtybwafxa.supabase.co
```

**`SUPABASE_SERVICE_KEY`** — the `sb_secret_…` key, from the Supabase dashboard:
Project Settings → API keys. It is the only key that may read a push token, which is
exactly why it is dangerous: it maps to `service_role` and walks past every row-level
rule in the database. It belongs in GitHub's secret store and **nowhere in the
repository, `.env`, or an EAS build**.

Do not use the `sb_publishable_…` key. The job now refuses it by name, because with it
every send would find nothing to do while looking perfectly healthy.

## Setting them

On GitHub, in the `bespa` repository:

**Settings → Secrets and variables → Actions → New repository secret.**

Add `SUPABASE_URL`, then `SUPABASE_SERVICE_KEY`. Repository secrets, not environment
secrets — the workflows ask for them by plain name.

## Checking it worked

**Actions → Daily notices → Run workflow**, with `dry_run` ticked. A dry run sends
nothing and records nothing; it prints what it would have done.

The first step is "Check configuration". It prints the URL and describes the key by its
length and prefix without ever printing it, so a key that is set but wrong is
distinguishable from one that is missing — both otherwise fail in the same second.

If something is missing, the job summary says which, and says it on the run's own page
rather than in a log that needs signing in to read.

## Why the two jobs behave differently when unconfigured

`Announce notices` runs every quarter hour and **stops quietly**. Setting a secret is a
thing you do once, and ninety-six failure mails a day about it is not a signal.

`Daily notices` runs once a day and **fails loudly**, so it cannot be forgotten.
