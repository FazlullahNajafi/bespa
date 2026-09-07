import 'intl-pluralrules';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { I18nManager } from 'react-native';

import en from './en.json';

export const SUPPORTED = ['en', 'ur', 'bft'] as const;
export type Language = (typeof SUPPORTED)[number];

/** Languages whose script runs right to left. */
const RTL: Language[] = ['ur'];

/**
 * Urdu and Purgi bundles are stubs until the strings are written and reviewed — Purgi
 * cannot even be started until the orthography question is settled (spec 09.4 #6), and
 * shipping half-translated UI is worse than shipping English. i18next falls back to `en`
 * per key, so a partial bundle degrades one string at a time rather than all at once.
 */
const resources = {
  en: { translation: en },
  ur: { translation: {} },
  bft: { translation: {} },
};

function deviceLanguage(): Language {
  const tag = getLocales()[0]?.languageCode ?? 'en';
  return (SUPPORTED as readonly string[]).includes(tag) ? (tag as Language) : 'en';
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
