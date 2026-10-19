const { getSentryExpoConfig } = require('@sentry/react-native/metro');

/**
 * Sentry's wrapper around `expo/metro-config`, written by `npx @sentry/wizard`.
 *
 * It exists to emit a Debug ID into the bundle and its source map, which is how Sentry
 * matches a minified frame from a phone back to a line of TypeScript. Plain
 * `getDefaultConfig` builds an identical bundle with no way to symbolicate it.
 *
 * Safe without a Sentry account: nothing here needs a DSN or a token.
 */
const config = getSentryExpoConfig(__dirname);

module.exports = config;
