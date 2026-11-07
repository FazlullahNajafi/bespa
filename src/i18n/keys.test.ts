/// <reference types="node" />
//
// Scoped to this file rather than adding "node" to tsconfig's `types`, which would put
// Node's globals in scope for the whole app — and `process`, `Buffer` and `setImmediate`
// compiling happily in a React Native screen is a trap worth keeping shut.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import en from './en.json';

/**
 * Every `t('…')` in the app resolves to a real string.
 *
 * i18next renders a missing key as the key itself, so a typo does not throw, does not
 * warn, and does not fail any check — it just puts `rides.departed` on a button and
 * waits to be noticed on a phone. That is exactly how it was noticed: four strings were
 * written under `rides.board.*` and read as `rides.*`, and the Go live screen shipped
 * with its two controls labelled in dot notation.
 *
 * This is cheap to run and it closes the whole class, which is the point — the bug was
 * not hard to fix, it was hard to see.
 *
 * **Dynamic keys are checked by their prefix.** `t(\`rides.vehicle.${type}\`)` cannot be
 * resolved statically, so the test asserts `rides.vehicle` exists and is an object with
 * something in it. That catches a renamed or deleted group, which is the failure that
 * actually happens, and leaves a wrong interpolated leaf to the pgTAP-style assertions
 * in the screens themselves.
 */

const SRC = join(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [path] : [];
  });
}

function lookup(key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object'
          ? (node as Record<string, unknown>)[part]
          : undefined,
      en,
    );
}

/** `t('a.b')` and `t(\`a.b\`)`, static only. */
const STATIC = /\bt\(\s*['"`]([a-zA-Z][\w.]*)['"`]/g;
/** `t(\`a.b.${x}\`)` — the part before the interpolation. */
const DYNAMIC = /\bt\(\s*`([a-zA-Z][\w.]*)\.\$\{/g;

const files = sourceFiles(SRC);

describe('i18n keys', () => {
  it('finds the source to scan', () => {
    // A regex suite that silently matched nothing would pass for ever.
    expect(files.length).toBeGreaterThan(30);
  });

  it('resolves every literal key used in the app', () => {
    const missing: string[] = [];

    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const [, key] of text.matchAll(STATIC)) {
        // i18next resolves a counted key through its plural suffix, so a string
        // declared only as `x_one`/`x_other` is present even though `x` is not. Both
        // spellings are in use here and both work; the test accepts either rather than
        // demanding a base key i18next never reads.
        const found =
          typeof lookup(key) === 'string' ||
          typeof lookup(`${key}_one`) === 'string' ||
          typeof lookup(`${key}_other`) === 'string';

        if (!found) missing.push(`${key}  (${file.replace(SRC, 'src')})`);
      }
    }

    expect(missing).toEqual([]);
  });

  it('resolves the group behind every interpolated key', () => {
    const missing: string[] = [];

    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const [, prefix] of text.matchAll(DYNAMIC)) {
        const value = lookup(prefix);
        if (!value || typeof value !== 'object' || Object.keys(value).length === 0) {
          missing.push(`${prefix}.*  (${file.replace(SRC, 'src')})`);
        }
      }
    }

    expect(missing).toEqual([]);
  });
});
