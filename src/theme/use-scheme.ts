import { useColorScheme } from 'react-native';

import { semantic, type Scheme } from './tokens';

/**
 * React Native reports `'unspecified'` and `null` alongside light/dark. Both mean "the OS
 * has no opinion", which for us is light. Normalising once here keeps every screen from
 * repeating the coalesce — and keeps `Scheme` a closed two-value union, so a missing dark
 * value in the palette is a type error rather than a washed-out screen in the field.
 */
export function useScheme(): Scheme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? 'dark' : 'light';
}

/** Convenience: the semantic palette for the current scheme. */
export function useColors() {
  return semantic(useScheme());
}
