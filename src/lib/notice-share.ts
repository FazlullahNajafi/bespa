/**
 * The text of a shared notice (spec 03.5).
 *
 * This is the only part of Bespa most people will ever see first. A notice travels here
 * by being forwarded into a WhatsApp group, so the forwarded message is the app's front
 * door: it has to carry the notice *and* say where it came from, to someone who has
 * never heard of Bespa and is reading on a 5-inch screen in a group of forty.
 *
 * Hence the shape. The title first and bold, because WhatsApp shows only the first two
 * lines in a group list. Then who published it and when, because a notice without a date
 * is a rumour. Then the document link, which is what a reader actually wants. Then one
 * line naming the app.
 *
 * Kept pure and separate from `notice-actions` so this can be tested: the message is a
 * product decision, not a side effect, and it is the kind of thing that quietly rots.
 *
 * `*bold*` is WhatsApp's markup. It renders as asterisks in SMS, which is a real cost
 * and an accepted one — WhatsApp is the channel this exists for, and one pair of
 * asterisks around a title is legible either way. No emoji beyond the document glyph:
 * anything newer than Unicode 6.0 is tofu on the Android 6 handsets still in use here.
 */

/** Narrowed to what the message needs, so a test does not have to build a whole notice. */
export type ShareableNotice = {
  title: string;
  body: string;
  /** Already translated — "Notice", "Alert". */
  categoryLabel: string;
  /** Already translated and formatted — "19 Oct 2026". */
  publishedLabel: string;
  /** Already translated and formatted, or null when the notice does not expire. */
  expiresLabel: string | null;
  /** The publishing body, for a mirrored notice. */
  sourceLabel: string | null;
  /** The original document, for a mirrored notice. */
  documentUrl: string | null;
  /** One line naming Bespa. Carries the app link once there is one to carry. */
  footer: string;
};

export function noticeShareText(notice: ShareableNotice): string {
  const attribution = notice.sourceLabel
    ? `${notice.categoryLabel} · ${notice.sourceLabel}`
    : notice.categoryLabel;

  const dates = notice.expiresLabel
    ? `${notice.publishedLabel} · ${notice.expiresLabel}`
    : notice.publishedLabel;

  // A mirrored notice has no body by construction and a village notice has no document,
  // so exactly one of the two middle blocks is ever present. Empty blocks are dropped
  // rather than emitted, because a run of blank lines is what makes a forwarded message
  // look broken.
  const blocks = [
    `*${notice.title.trim()}*`,
    `${attribution}\n${dates}`,
    notice.body.trim(),
    notice.documentUrl ? `📄 ${notice.documentUrl}` : '',
    notice.footer,
  ];

  return blocks.filter((block) => block.length > 0).join('\n\n');
}
