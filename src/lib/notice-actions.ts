import { Share } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

/**
 * What a reader can do with a notice: open the document, or pass it on.
 *
 * Both live here rather than on a screen because the notice *card* is where they are
 * now offered, and a card appears on Home and in the list. Neither throws: a handset
 * with no browser, or a share sheet the reader backs out of, is not an error worth a
 * banner.
 */

/**
 * Opens a mirrored notice's original PDF.
 *
 * An in-app browser rather than a hand-off to Chrome: the reader returns to Bespa with
 * the back gesture instead of app-switching, which matters on a cheap phone where
 * relaunching costs seconds.
 */
export async function openNoticeDocument(url: string): Promise<void> {
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch {
    // A missing browser is not worth an error screen.
  }
}

/**
 * Hands the notice to the system share sheet, where WhatsApp is the first icon on every
 * phone in the valley — which is how a notice actually travels here. The sheet rather
 * than a `whatsapp://` link on purpose: a direct link fails silently on a phone without
 * WhatsApp, and it forecloses the SMS, Bluetooth and file-manager routes that matter on
 * a handset with no data left.
 */
export async function shareNotice(message: string): Promise<void> {
  try {
    await Share.share({ message });
  } catch {
    // Dismissing the sheet is a normal outcome, not a failure.
  }
}
