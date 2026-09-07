/**
 * Form validation as pure functions returning i18n keys — no React, no rendering, so the
 * rules are unit-testable on their own.
 *
 * Kept deliberately dependency-free. Two forms with three fields do not justify
 * react-hook-form plus zod; those arrive with the forms that genuinely need them (place
 * submission, trip creation), not before.
 */

export const MIN_PASSWORD_LENGTH = 8;

/**
 * Intentionally permissive. Strict email regexes reject valid addresses, and the
 * authoritative check is the confirmation email actually arriving — this only catches
 * obvious typos before a round-trip.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value: string): string | undefined {
  const email = value.trim();
  if (!email) return 'auth.validation.emailRequired';
  if (!EMAIL.test(email)) return 'auth.validation.emailInvalid';
  return undefined;
}

export function validatePassword(value: string): string | undefined {
  if (!value) return 'auth.validation.passwordRequired';
  if (value.length < MIN_PASSWORD_LENGTH) return 'auth.validation.passwordTooShort';
  return undefined;
}

export function validateName(value: string): string | undefined {
  if (!value.trim()) return 'auth.validation.nameRequired';
  return undefined;
}
