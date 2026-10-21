#!/usr/bin/env python3
"""Mirror official notices from kargil.nic.in into `notices` (spec 03.5, 09.3 risk 1b).

Bespa has no LAHDC sponsor (spec 09.4 #2), so this is an INDEX, not a republication.
It copies the title and the dates exactly as printed and links to the original PDF. It
never paraphrases, never summarises, and never stores the document's contents — several
of these are land-acquisition notices (FORM VII, PRELIMINARY NOTIFICATION) whose
objection windows are legally meaningful, and a date we got wrong is a real harm to a
real person.

Three safety properties, in order of how badly they would hurt if missing:

1. **It never deletes.** Only `import_official_notice`, which upserts. A village that
   stops seeing notices because a parser broke is the failure that would discredit the
   whole module.
2. **A parse that finds nothing is an error, not an empty district.** If a page returns
   200 with real content but yields no rows, the site's markup has changed; the script
   exits non-zero having written nothing, rather than reporting success.
3. **It is idempotent on the PDF URL**, which is the one stable identifier the site
   gives us. Re-running refreshes titles and dates in place.

Usage:
    python scripts/import-notices.py --dry-run            # print, write nothing
    python scripts/import-notices.py --pages 3

Environment:
    SUPABASE_URL          e.g. https://<ref>.supabase.co  (or the local 127.0.0.1:55321)
    SUPABASE_SERVICE_KEY  service_role / sb_secret_ — the ONLY key that may call the
                          importer. Never commit it; never put it in .env.
"""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from html.parser import HTMLParser

BASE = "https://kargil.nic.in"

# Mirrored notices all attach here. See Notice.as_rpc_args.
DISTRICT_PATH = "ladakh.kargil"

# The district site's sections, mapped onto `notice_category`. The enum (spec 06.1) has
# no member for a tender or a recruitment, and adding one needs its own migration because
# `alter type ... add value` cannot run in a transaction — so those land on `general`.
# Lossy and deliberate: inventing a category would be worse than a coarse one.
SECTIONS = [
    ("/notice_category/announcements/", "general"),
    ("/notice_category/recruitment/", "general"),
    ("/notice_category/tenders/", "general"),
    ("/document-category/office-order/", "order"),
]

# Identify the bot honestly. A district IT team that wants to block this should be able
# to, and should be able to tell who to contact.
USER_AGENT = "BespaBot/0.1 (+https://github.com/FazlullahNajafi/bespa) community mirror"

# Courtesy delay between requests to a small government server.
DELAY_SECONDS = 2.0

DATE_RE = re.compile(r"\b(\d{2})/(\d{2})/(\d{4})\b")
# "View (827 KB)" — the attachments column. On a row carrying several documents it is
# longer than the title, which is how the first version of this mistook it for one.
SIZE_RE = re.compile(r"\(\s*\d+(?:\.\d+)?\s*[KMG]B\s*\)", re.I)


@dataclass
class Notice:
    title: str
    url: str
    starts: str | None  # ISO date, or None when the page did not print one
    ends: str | None
    category: str

    def as_rpc_args(self) -> dict:
        args = {
            "p_source": "lahdc",
            # The PDF URL is the natural key. Unique per notice, stable across re-runs.
            "p_source_ref": self.url,
            "p_source_url": self.url,
            # Every mirrored notice attaches to Kargil district: the site publishes for
            # the district, and spec 03.5's containment rule lets that reach every
            # village beneath it. Matching village names out of titles was considered and
            # rejected — the site writes "Shilikchay" where the seed has `shilkchey`,
            # which is exactly the fuzzy matching the geography seed refused to do.
            "p_geo_path": DISTRICT_PATH,
            "p_title": self.title,
            "p_category": self.category,
        }
        # Absent rather than guessed. `import_official_notice` defaults published_at to
        # now(), which is honest for "we do not know when this was posted"; a made-up
        # date would silently reorder the feed.
        if self.starts:
            args["p_published_at"] = self.starts
        if self.ends:
            args["p_expires_at"] = self.ends
        return args


class TableRowParser(HTMLParser):
    """Collects table rows as (cell_texts, hrefs_in_row).

    Written against the shape of the page rather than its classes: NIC themes change
    their CSS names between redesigns, but a notices listing has stayed a table of rows
    where one cell is the title and one cell links to a document.
    """

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.rows: list[tuple[list[str], list[str]]] = []
        self._in_row = False
        self._cells: list[str] = []
        self._hrefs: list[str] = []
        self._depth_in_cell = 0
        self._buf: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self._in_row, self._cells, self._hrefs = True, [], []
        elif tag in ("td", "th") and self._in_row:
            self._depth_in_cell += 1
            self._buf = []
        elif tag == "a" and self._in_row:
            for k, v in attrs:
                if k == "href" and v:
                    self._hrefs.append(v)

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self._depth_in_cell:
            self._depth_in_cell -= 1
            self._cells.append(" ".join("".join(self._buf).split()))
            self._buf = []
        elif tag == "tr" and self._in_row:
            self.rows.append((self._cells, self._hrefs))
            self._in_row = False

    def handle_data(self, data):
        if self._depth_in_cell:
            self._buf.append(data)


def fetch(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=45) as response:
        raw = response.read()
        header_charset = response.headers.get_content_charset()

    # The server's Content-Type is not reliable here: under the charset it declares, the
    # en-dashes in notice titles decode to replacement characters. Trust the document's
    # own declaration first, then UTF-8, and only then the header.
    declared = re.search(rb"""charset=["']?([\w-]+)""", raw[:4096], re.I)
    candidates = [
        declared.group(1).decode("ascii", "ignore") if declared else None,
        "utf-8",
        header_charset,
    ]
    for charset in [c for c in candidates if c]:
        try:
            return raw.decode(charset)
        except (UnicodeDecodeError, LookupError):
            continue
    return raw.decode("utf-8", errors="replace")


def pick_title(cells: list[str]) -> str | None:
    """The title is the first real cell, not the longest one.

    NIC lists these as [title, start, end, documents]. Choosing by length picks the
    documents column whenever a notice carries more than one attachment, which produced
    the title "View (827 KB) Participation in Indi skills Competition 2026 (1) (1 MB)".
    """
    for cell in cells:
        text = cell.strip()
        if not text or text.isdigit():          # blank, or a serial-number column
            continue
        if DATE_RE.fullmatch(text) or SIZE_RE.search(text):
            continue
        return text
    return None


def safe(line: str) -> None:
    """Print a line that may contain an en-dash on a cp1252 console."""
    try:
        print(line)
    except UnicodeEncodeError:
        print(line.encode("ascii", "replace").decode("ascii"))


def to_iso(value: str) -> str | None:
    """DD/MM/YYYY as the site prints it. Anything else is left unknown, not guessed."""
    match = DATE_RE.search(value or "")
    if not match:
        return None
    day, month, year = match.groups()
    return f"{year}-{month}-{day}"


def parse_listing(page_html: str, category: str) -> list[Notice]:
    parser = TableRowParser()
    parser.feed(page_html)

    notices: list[Notice] = []
    for cells, hrefs in parser.rows:
        documents = [h for h in hrefs if ".pdf" in h.lower() or "/document/" in h.lower()]
        if not documents or not cells:
            continue

        chosen = pick_title(cells)
        if not chosen:
            continue
        title = html.unescape(chosen).strip()

        dates = [to_iso(c) for c in cells if to_iso(c)]
        notices.append(
            Notice(
                title=title,
                url=urllib.parse.urljoin(BASE, documents[0]),
                starts=dates[0] if len(dates) > 0 else None,
                ends=dates[1] if len(dates) > 1 else None,
                category=category,
            )
        )
    return notices


def call_rpc(base_url: str, key: str, name: str, args: dict) -> None:
    body = json.dumps(args).encode()
    request = urllib.request.Request(
        f"{base_url.rstrip('/')}/rest/v1/rpc/{name}",
        data=body,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        response.read()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true", help="print what would be imported")
    ap.add_argument("--pages", type=int, default=1, help="listing pages per section")
    args = ap.parse_args()

    base_url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    if not args.dry_run and not (base_url and key):
        # Spelling both shells out on purpose: this project is developed on Windows with
        # both PowerShell and Git Bash in play, and `VAR=value cmd` is bash-only — in
        # PowerShell it is not a syntax error, it simply never sets the variable, so the
        # script fails complaining about config the caller believes they supplied.
        missing = " and ".join(
            n for n, v in (("SUPABASE_URL", base_url), ("SUPABASE_SERVICE_KEY", key)) if not v
        )
        print(
            f"{missing} not set.\n"
            "\n"
            "  PowerShell:\n"
            '    $env:SUPABASE_URL = "https://<ref>.supabase.co"\n'
            '    $env:SUPABASE_SERVICE_KEY = "<your sb_secret_ key>"\n'
            "    python scripts/import-notices.py\n"
            "\n"
            "  Git Bash:\n"
            '    SUPABASE_URL="https://<ref>.supabase.co" \\\n'
            '      SUPABASE_SERVICE_KEY="<your sb_secret_ key>" \\\n'
            "      python scripts/import-notices.py\n"
            "\n"
            "Or run with --dry-run to see what would be imported without writing.",
            file=sys.stderr,
        )
        return 2

    total = 0
    for path, category in SECTIONS:
        for page in range(1, args.pages + 1):
            url = urllib.parse.urljoin(BASE, path if page == 1 else f"{path}page/{page}/")
            try:
                page_html = fetch(url)
            except urllib.error.HTTPError as error:
                if error.code == 404:
                    break  # ran off the end of the pagination
                print(f"  ! {url} -> HTTP {error.code}", file=sys.stderr)
                return 1
            except urllib.error.URLError as error:
                print(f"  ! {url} -> {error.reason}", file=sys.stderr)
                return 1

            found = parse_listing(page_html, category)

            # Property 2: a listing page that returned real content but parsed to nothing
            # means the markup moved. Refuse to continue rather than quietly report that
            # the district has published nothing.
            if not found and "<table" in page_html.lower():
                print(
                    f"  ! {url}: the page has a table but no rows parsed — the site's "
                    "markup has probably changed. Nothing was written.",
                    file=sys.stderr,
                )
                return 1

            print(f"{url}  ({len(found)} notices)")
            for notice in found:
                total += 1
                if args.dry_run:
                    safe(f"    {notice.starts or '?':10} .. {notice.ends or '?':10}  "
                         f"{notice.title[:72]}")
                    safe(f"               {notice.url}")
                else:
                    call_rpc(base_url, key, "import_official_notice",
                             notice.as_rpc_args())

            time.sleep(DELAY_SECONDS)

    print(f"\n{total} notices {'found' if args.dry_run else 'imported'}.")
    # Nothing at all, across every section, is itself suspicious.
    return 0 if total else 1


if __name__ == "__main__":
    sys.exit(main())
