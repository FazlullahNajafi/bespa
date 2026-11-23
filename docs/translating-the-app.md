# Translating the app

672 strings, one spreadsheet, five columns. No account, no website, no sync step — the
sheet is the platform.

## Get the sheet

```bash
python scripts/i18n-export.py
```

Writes `i18n.csv` next to the project. Open it in Excel, Google Sheets or LibreOffice.

| column | |
|---|---|
| `key` | where the string lives in the app. **Do not edit.** |
| `english` | the string as it ships. **Do not edit** — English is the source. |
| `note` | plural rules, placeholders to keep, and which part of the app it is in |
| `ur` | Urdu |
| `bft-Latn` | Purgi, Latin transliteration |
| `bft-Arab` | Purgi, Perso-Arabic |
| `bft-Tibt` | Purgi, Tibetan script |

The three Purgi columns sit side by side because they are the same sentence written three
ways. Say it once in Purgi, then write it across — it is one translation and three
spellings, not three jobs.

## Three rules

**Leave a cell empty rather than guessing.** An empty cell ships the English string, which
is correct and readable. A wrong translation is neither, and nobody else here can catch
it.

**Keep anything in `{{double braces}}` exactly as it is.** `{{count}}` becomes a number
when the app draws it. Move it in the sentence if your grammar needs it elsewhere; do not
rename it or drop it. The import refuses a row that loses one, because "seats available"
with no number looks deliberate.

**Rows ending `_other` are the plural.** The row without it is used when the count is
exactly one. If a language needs different forms, say so and the bundle can carry more —
i18next supports the full set, English just happens to need two.

## Put it back

```bash
python scripts/i18n-import.py i18n.csv
python scripts/i18n-import.py i18n.csv --dry-run    # report, write nothing
python scripts/i18n-import.py i18n.csv --only ur    # one language
```

Writes `src/i18n/*.json`. It refuses the whole file rather than writing half of it if a
key has gone stale or a placeholder is missing, and names the line.

Re-running the export after new strings land keeps everything already translated and
leaves only the new rows empty, so this is safe to do as often as you like.

## Save it as UTF-8

Excel offers **"CSV UTF-8 (Comma delimited)"**. Use that one. The plain "CSV" option turns
Arabic and Tibetan into question marks on the way out, and the damage is not visible until
after it is saved.

## What you can start today, and what has to wait

**`bft-Latn` works now.** DM Sans already draws Latin letters, so Purgi in transliteration
will render the moment you import it.

**`ur`, `bft-Arab` and `bft-Tibt` will render as empty boxes until their fonts are
bundled.** The app ships four DM Sans faces and nothing else; DM Sans has no Arabic and no
Tibetan glyphs, and React Native does not quietly fall back to a system font when the
family it was given lacks the glyph — it draws tofu. Noto Nastaliq Urdu (or Noto Sans
Arabic) and Noto Serif Tibetan need bundling, and `tokens.ts` needs to choose a family by
the active language rather than naming DM Sans outright. That is real work and it is not
done. Translate into those columns anyway if you prefer — the strings are safe in the
sheet and in the bundles, and they will appear the day the fonts land.

Urdu's right-to-left layout is already wired: `applyLanguage` flips `I18nManager` and
reports that a restart is needed, which the language screen will have to show.
