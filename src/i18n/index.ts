import 'intl-pluralrules';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { I18nManager } from 'react-native';

import en from './en.json';
import ur from './ur.json';
import bftLatn from './bft-Latn.json';
import bftArab from './bft-Arab.json';
import bftTibt from './bft-Tibt.json';

/**
 * Five locales, and Purgi is three of them.
 *
 * Spec 09.4 #6 asked whether Purgi should be written in Latin transliteration or
 * Perso-Arabic. Answered 2026-11-23 by the one person here who speaks it: **all three**,
 * Tibetan script included — which the question never offered. Purgi is read in three
 * scripts in Kargil depending on who is reading, and picking one would be picking a
 * readership.
 *
 * So they are script subtags of one language rather than three languages, which is what
 * BCP 47 subtags are for: `bft-Latn`, `bft-Arab`, `bft-Tibt` are the same words, written
 * three ways. The CSV the translator fills has them as adjacent columns for exactly that
 * reason — one sentence, transliterated across, rather than three translation efforts.
 *
 * The Tibetan one is deliberately **not** literary Bhoti. The brief from the translator:
 * the feel of the script as a local reads it, not a classical register nobody in the
 * valley would follow.
 */
export const SUPPORTED = ['en', 'ur', 'bft-Latn', 'bft-Arab', 'bft-Tibt'] as const;
export type Language = (typeof SUPPORTED)[number];

/** Languages whose script runs right to left. Perso-Arabic Purgi is, Tibetan is not. */
const RTL: Language[] = ['ur', 'bft-Arab'];

/**
 * Which font each locale needs. Only Latin is bundled today — DM Sans carries no Arabic
 * and no Tibetan glyphs, and React Native does not fall back to a system face when a
 * `fontFamily` it was given has no glyph: it draws tofu. So a bundle may be filled in
 * before its font exists, and will render as empty boxes until the font lands.
 */
export const SCRIPT_OF: Record<Language, 'latin' | 'arabic' | 'tibetan'> = {
  en: 'latin',
  ur: 'arabic',
  'bft-Latn': 'latin',
  'bft-Arab': 'arabic',
  'bft-Tibt': 'tibetan',
};

/**
 * Names for the picker. English labels until the translator supplies the endonyms —
 * writing a language's own name for it in a script you cannot read is how you ship an
 * insult, so these stay in English rather than being guessed.
 */
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  ur: 'Urdu',
  'bft-Latn': 'Purgi (Latin)',
  'bft-Arab': 'Purgi (Perso-Arabic)',
  'bft-Tibt': 'Purgi (Tibetan)',
};

/**
 * A bundle is empty until its CSV column is filled — see `scripts/i18n-export.py`.
 * i18next falls back to `en` per key, so a half-filled bundle degrades one string at a
 * time rather than all at once, which is what makes translating incrementally safe.
 */
const resources = {
  en: { translation: en },
  ur: { translation: ur },
  'bft-Latn': { translation: bftLatn },
  'bft-Arab': { translation: bftArab },
  'bft-Tibt': { translation: bftTibt },
};

/**
 * No phone reports `bft-*`, so Purgi is only ever reached by choosing it. Urdu and
 * English can arrive from the device.
 *
 * The script subtag is ignored on the way in deliberately: a device set to `ur-PK`
 * means Urdu, and a device claiming a Purgi variant is claiming more than Android knows.
 */
function deviceLanguage(): Language {
  const code = getLocales()[0]?.languageCode ?? 'en';
  return code === 'ur' ? 'ur' : 'en';
}

void i18n.use(initReactI18next).init({
  resources,
  lng: deviceLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export function isRTL(lang: Language) {
  return RTL.includes(lang);
}

/**
 * Switching direction needs a full reload — `I18nManager.forceRTL` only takes effect on
 * the next launch, and React Native will happily render a half-mirrored layout until then.
 *
 * So this returns whether a restart is required rather than doing it: the caller shows an
 * explicit "restart to apply" prompt. Building that path now, while there are two screens,
 * is the cheap version of a job that becomes a forty-screen audit if it is left to Phase 4
 * (spec 10.9 #4).
 */
export function applyLanguage(lang: Language): { needsRestart: boolean } {
  const shouldBeRTL = isRTL(lang);
  const needsRestart = I18nManager.isRTL !== shouldBeRTL;

  void i18n.changeLanguage(lang);

  if (needsRestart) {
    I18nManager.allowRTL(shouldBeRTL);
    I18nManager.forceRTL(shouldBeRTL);
  }

  return { needsRestart };
}

/**
 * Screens import `useTranslation` from here, not from `react-i18next` directly.
 *
 * expo-router evaluates route modules independently of the root layout, so a screen can
 * render before the layout's side-effect import has registered the i18next instance —
 * which produces a NO_I18NEXT_INSTANCE warning and untranslated strings on first paint.
 * Re-exporting through this module makes the dependency explicit: importing the hook
 * imports the initialisation, in that order, every time.
 */
export { useTranslation } from 'react-i18next';

export default i18n;
