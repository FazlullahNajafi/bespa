#!/usr/bin/env python3
"""Announce pending notices to the phones they are for (spec 03.5, 06.9, 07.3).

Runs after `import-notices.py`, from `.github/workflows/daily.yml`. Until this existed
a notice reached only whoever happened to open the app that day — which is the failure
the notices module was built to fix, so the mirror was half a feature.

    SUPABASE_URL          e.g. https://<ref>.supabase.co  (or the local 127.0.0.1:55321)
    SUPABASE_SERVICE_KEY  service_role / sb_secret_ — the ONLY key that may read a push
                          token. Never put it in the repo, `.env` or `eas.json`.

The scoping lives in the database (`notice_push_queue`), not here: it is the same
"is my village under this notice's geo unit" rule the RLS policy uses, and two copies of
a visibility rule is how they drift. This script is a sender and a bookkeeper.

Safety properties, in the order they would hurt:

  * **Nothing is announced twice.** `record_notice_push` stamps `notices.pushed_at`, and
    the queue only returns rows where it is null.
  * **Nothing old is announced.** The queue refuses anything published more than
    `--max-age-days` ago, so a job that has been down for a week delivers the backlog to
    the notices screen rather than as seven notifications at once.
  * **A dead token is dropped, not retried.** Expo answers `DeviceNotRegistered` for an
    uninstalled app; keeping the row means pushing into the void every day and counting a
    delivery that never happens.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from collections import OrderedDict

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

# Expo's documented maximum per request.
BATCH = 100

USER_AGENT = "BespaBot/0.1 (+https://github.com/FazlullahNajafi/bespa) notice push"

# Spec 03.5 renders `alert` in the warning colour and pushes it with high priority. The
# Android channel, not the message, is what decides whether a notification may make a
# sound — `src/lib/push.ts` creates both at first launch, and a channel's importance
# cannot be raised afterwards.
ALERT_CHANNEL = "alert"
DEFAULT_CHANNEL = "default"


class PushError(RuntimeError):
    """A failure worth reading, rather than a stack trace through urllib."""


def post(url: str, body: dict | list, headers: dict, timeout: int = 45):
    request = urllib.request.Request(
        url,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "User-Agent": USER_AGENT, **headers},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read().decode()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        detail = ""
        try:
            payload = json.loads(error.read().decode())
            detail = payload.get("message") or payload.get("hint") or ""
        except Exception:
            pass

        hint = ""
        if error.code == 404 and "/rpc/" in url:
            hint = ("\n  The function is not on this project. Apply the migrations:"
                    "\n      npx supabase db push")
        elif error.code in (401, 403) and "/rpc/" in url:
            # ASCII only: this prints to a cp1252 console, where an en-dash arrives as a
            # replacement character and makes a clear message look like a second fault.
            hint = ("\n  SUPABASE_SERVICE_KEY must be the secret (service_role) key, not"
                    "\n  the publishable one: a push token is closed to it by design.")

        raise PushError(
            f"{url} -> HTTP {error.code}" + (f": {detail}" if detail else "") + hint
        ) from None


def rpc(base_url: str, key: str, name: str, args: dict):
    return post(
        f"{base_url.rstrip('/')}/rest/v1/rpc/{name}",
        args,
        {"apikey": key, "Authorization": f"Bearer {key}"},
    )


def group_by_notice(rows: list[dict]) -> "OrderedDict[str, dict]":
    """One entry per notice, carrying its title, category and every target device.

    Ordered, because `notice_push_queue` returns oldest first and a village reading three
    notifications should meet them in the order the district published them.
    """
    notices: OrderedDict[str, dict] = OrderedDict()
    for row in rows:
        entry = notices.setdefault(
            row["notice_id"],
            {"title": row["title"], "category": row["category"], "tokens": [], "users": set()},
        )
        entry["tokens"].append(row["expo_token"])
        entry["users"].add(row["user_id"])
    return notices


def messages_for(notice: dict) -> list[dict]:
    alert = notice["category"] == "alert"
    return [
        {
            "to": token,
            # The short word on top and the notice itself underneath: Android shows the
            # title on one line and expands the body, and these titles run long — a land
            # acquisition notice names a village, a form number and a tehsil.
            "title": "Alert" if alert else "New notice",
            "body": notice["title"],
            # What the app opens when tapped. The route already exists.
            "data": {"url": f"/notices/{notice['id']}", "notice_id": notice["id"]},
            "channelId": ALERT_CHANNEL if alert else DEFAULT_CHANNEL,
            "priority": "high" if alert else "default",
        }
        # Deduplicated: one handset shared by two villagers holds one token, and
        # `register_my_device` repoints it rather than keeping both rows — but a stale
        # duplicate must not become two buzzes for the same notice.
        for token in sorted(set(notice["tokens"]))
    ]


def send(messages: list[dict]) -> list[dict]:
    tickets: list[dict] = []
    for start in range(0, len(messages), BATCH):
        chunk = messages[start : start + BATCH]
        response = post(EXPO_PUSH_URL, chunk, {}) or {}
        tickets.extend(response.get("data") or [])
    return tickets


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true",
                    help="print what would be sent, send nothing, record nothing")
    ap.add_argument("--max-age-days", type=int, default=3,
                    help="refuse to announce anything published longer ago than this")
    args = ap.parse_args()

    base_url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    if not (base_url and key):
        missing = " and ".join(
            n for n, v in (("SUPABASE_URL", base_url), ("SUPABASE_SERVICE_KEY", key)) if not v
        )
        # Both shells spelled out: this project is developed on Windows with PowerShell
        # and Git Bash both in play, and `VAR=value cmd` is bash-only — in PowerShell it
        # is not a syntax error, it simply never sets the variable.
        print(
            f"{missing} not set.\n"
            "\n"
            "  PowerShell:\n"
            '    $env:SUPABASE_URL = "https://<ref>.supabase.co"\n'
            '    $env:SUPABASE_SERVICE_KEY = "<your sb_secret_ key>"\n'
            "    python scripts/send-notice-push.py\n"
            "\n"
            "  Git Bash:\n"
            '    SUPABASE_URL="https://<ref>.supabase.co" \\\n'
            '      SUPABASE_SERVICE_KEY="<your sb_secret_ key>" \\\n'
            "      python scripts/send-notice-push.py\n",
            file=sys.stderr,
        )
        return 2

    try:
        rows = rpc(base_url, key, "notice_push_queue", {"max_age_days": args.max_age_days})
    except PushError as error:
        print(f"could not read the queue: {error}", file=sys.stderr)
        return 1

    notices = group_by_notice(rows or [])
    if not notices:
        print("nothing to announce")
        return 0

    sent = 0
    failed = 0
    # A set, not a counter: the same dead handset appears under every pending notice, and
    # reporting "3 dead tokens dropped" for one uninstalled phone is a number someone
    # would act on.
    dropped: set[str] = set()

    for notice_id, notice in notices.items():
        notice["id"] = notice_id
        messages = messages_for(notice)
        label = notice["title"][:60]

        if args.dry_run:
            print(f"  would push to {len(messages):3d} device(s): {label}")
            continue

        try:
            tickets = send(messages)
        except PushError as error:
            # Left pending on purpose: the next run retries it, and the age guard stops
            # that going on forever.
            print(f"  FAILED {label}: {error}", file=sys.stderr)
            failed += 1
            continue

        for message, ticket in zip(messages, tickets):
            if ticket.get("status") == "ok":
                sent += 1
                continue
            error_code = (ticket.get("details") or {}).get("error")
            if error_code == "DeviceNotRegistered":
                if message["to"] not in dropped:
                    rpc(base_url, key, "forget_device_token", {"p_token": message["to"]})
                    dropped.add(message["to"])
            else:
                print(f"  ticket error on {label}: {ticket.get('message') or error_code}",
                      file=sys.stderr)

        # Recorded once the request was accepted, whatever individual tickets said. A
        # notice held back because one handset was uninstalled would be re-sent to
        # everyone else tomorrow, and being told twice is worse than one lost delivery
        # to a phone that is already gone.
        recipients = rpc(base_url, key, "record_notice_push", {"p_notice_id": notice_id})
        print(f"  announced to {recipients} villager(s), {len(messages)} device(s): {label}")

    if not args.dry_run:
        print(f"\n{sent} delivered, {len(dropped)} dead token(s) dropped, "
              f"{failed} notice(s) left pending")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
