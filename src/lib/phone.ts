/**
 * Phone numbers, which are stored in one shape and typed in another.
 *
 * Storage is E.164 (`+919419000000`) — `profile_private.phone` has a CHECK constraint
 * saying so, and it is what an SMS gateway will want the day phone-OTP exists (spec
 * 03.6). Typing it is a different question: this app is for one district of one country,
 * and asking a villager to remember that their number starts `+91` is asking them to
 * know a piece of trivia about international dialling in order to fill in a form. The
 * country code is shown as a fixed label beside the field and never typed.
 *
 * The cost is explicit: a number outside India cannot be entered at all. For Kargil
 * district that is the right trade, and `fromE164` still displays a foreign number that
 * reached the row by some other route rather than mangling it.
 */

export const COUNTRY_CODE = '+91';

/**
 * Ten digits, not starting with 0 — a national subscriber number under India's numbering
 * plan. Deliberately not "must start 6-9", which is the mobile rule: a shopkeeper giving
 * the shop's landline writes its STD code and number, and Kargil's begins `1985`. The
 * field is for reaching a person, and refusing the number they actually answer would be
 * a validator deciding it knows better.
 */
const NATIONAL = /^[1-9][0-9]{9}$/;

/** Everything a person might type or paste as a separator. */
function digitsOnly(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

/**
 * What goes in the box, given what is in the database.
 *
 * Returns the ten national digits for an Indian number. Anything else — a number from
 * another country, or a malformed row — comes back whole, so the field shows the truth
 * rather than silently dropping a prefix the user cannot see.
 */
export function fromE164(stored: string | null | undefined): string {
  if (!stored) return '';
  const trimmed = stored.trim();
  if (trimmed.startsWith(COUNTRY_CODE)) {
    const national = trimmed.slice(COUNTRY_CODE.length);
    return NATIONAL.test(national) ? national : trimmed;
  }
  return trimmed;
}

/**
 * Normalises what was typed. Accepts the ten digits, and also the forms people actually
 * write them in: with spaces or dashes, with a leading 0, with +91 or 91 in front — all
 * of which are the same number, and none of which is worth an error message.
 */
export function toNational(typed: string): string {
  let digits = digitsOnly(typed);
  // Both prefixes only when something is left over: '9123456789' is a whole mobile
  // number that happens to start 91, not a country code and eight digits.
  if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length > 10 && digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

export function isValidNational(typed: string): boolean {
  return NATIONAL.test(toNational(typed));
}

/**
 * What to store. Null for an empty field — clearing the number is a thing a user may do.
 * Throws nothing on an invalid number: the caller validates first, because it is the one
 * that can put the message next to the field.
 */
export function toE164(typed: string): string | null {
  const national = toNational(typed);
  if (!national) return null;
  return NATIONAL.test(national) ? `${COUNTRY_CODE}${national}` : null;
}
