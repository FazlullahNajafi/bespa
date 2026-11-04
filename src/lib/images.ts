import { requireOptionalNativeModule } from 'expo-modules-core';

import { supabase } from '@/lib/supabase';

/**
 * The image pipeline (spec 10.5's Phase 1 spike): pick → resize → upload → read back.
 *
 * It is a spike before it is a feature, and the reason is in the spec: Places, Gallery,
 * the Home banner and the village cover are all designed on top of this, and designing
 * them against an unmeasured pipeline is how you find out in week three that a 4 MB photo
 * from a Kargil phone takes ninety seconds on the connection it will actually be sent
 * over. So every stage is timed and the timings are returned, not logged.
 *
 * **Resizing is not an optimisation here, it is the feature.** A modern phone camera
 * produces 3–6 MB; spec 02.3 and 08.7 are written for 2G, where that is minutes. 1600px
 * on the long edge at quality 0.7 lands around 200–400 KB and is still more than any
 * screen in this app can show.
 *
 * `expo-image-picker` and `expo-image-manipulator` are loaded lazily and their absence is
 * not an error, the same way `push.ts` treats notifications: they are native modules, so
 * a development build made before they were added does not contain them, and a top-level
 * import would take the whole app down rather than disabling one button.
 */

type PickerModule = typeof import('expo-image-picker');
type ManipulatorModule = typeof import('expo-image-manipulator');

let picker: PickerModule | null | undefined;
let manipulator: ManipulatorModule | null | undefined;

function pickerModule(): PickerModule | null {
  if (picker !== undefined) return picker;
  if (!requireOptionalNativeModule('ExponentImagePicker')) return (picker = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    picker = require('expo-image-picker') as PickerModule;
  } catch {
    picker = null;
  }
  return picker;
}

function manipulatorModule(): ManipulatorModule | null {
  if (manipulator !== undefined) return manipulator;
  if (!requireOptionalNativeModule('ExpoImageManipulator')) return (manipulator = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    manipulator = require('expo-image-manipulator') as ManipulatorModule;
  } catch {
    manipulator = null;
  }
  return manipulator;
}

/** Whether to offer a photo button at all. False on a build without the native modules. */
export function canPickImages(): boolean {
  return pickerModule() !== null && manipulatorModule() !== null;
}

/** The long edge after resizing. More than any screen here can show, and ~10x smaller. */
export const MAX_EDGE = 1600;
const QUALITY = 0.7;

export type Timings = {
  /** From opening the picker to having a file — includes the user deciding. */
  pickMs: number;
  resizeMs: number;
  uploadMs: number;
  /** Time to a signed URL. Not the download; that is the renderer's problem. */
  signMs: number;
  totalMs: number;
  originalBytes: number;
  uploadedBytes: number;
};

/**
 * Picks up to `limit` photos and shrinks each one, returning local files.
 *
 * Resizing happens HERE and not at upload time, which is the measured decision from the
 * spike: 4.4 MB becomes 184 KB, and the outbox should be carrying the 184 KB. The cost is
 * that the queued file lives in the cache directory, which Android may clear under
 * storage pressure — so a photo queued on a dead connection can be lost before it drains.
 * That window is short, and the alternative is copying every pick into permanent storage
 * for a journey most of them make in seconds.
 */
export async function pickAndResize(limit = 1): Promise<
  { status: 'ok'; uris: string[] } | { status: 'cancelled' | 'unsupported' | 'denied' }
> {
  const imagePicker = pickerModule();
  const imageManipulator = manipulatorModule();
  if (!imagePicker || !imageManipulator) return { status: 'unsupported' };

  const permission = await imagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { status: 'denied' };

  const picked = await imagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    quality: 1,
  });
  if (picked.canceled || !picked.assets?.length) return { status: 'cancelled' };

  const uris: string[] = [];
  for (const asset of picked.assets) {
    uris.push(await shrink(asset.uri, asset.width, asset.height));
  }
  return { status: 'ok', uris };
}

/** The resize on its own, so both the spike and the gallery use the same one. */
async function shrink(uri: string, width?: number, height?: number): Promise<string> {
  const imageManipulator = manipulatorModule();
  if (!imageManipulator) return uri;

  const longEdge = Math.max(width ?? 0, height ?? 0);
  const scale = longEdge > MAX_EDGE ? MAX_EDGE / longEdge : 1;

  const context = imageManipulator.ImageManipulator.manipulate(uri);
  if (scale < 1) {
    context.resize({
      width: Math.round((width ?? MAX_EDGE) * scale),
      height: Math.round((height ?? MAX_EDGE) * scale),
    });
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({
    compress: QUALITY,
    format: imageManipulator.SaveFormat.JPEG,
  });
  return saved.uri;
}

/**
 * Uploads an already-resized local file and answers with its object path.
 *
 * The path is `<villageId>/<userId>/<name>` because the storage policies read those two
 * segments — the first decides which village may see it, the second who may delete it.
 * `submit_gallery_image` checks the same prefix, so a row cannot be attached to someone
 * else's object.
 */
export async function uploadToBucket(
  uri: string,
  villageId: string,
  userId: string,
): Promise<string> {
  const body = await (await fetch(uri)).arrayBuffer();
  const path = `${villageId}/${userId}/${Date.now()}-${Math.round(Math.random() * 1e6)}.jpg`;

  const { error } = await supabase.storage
    .from('images')
    .upload(path, body, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;

  return path;
}

/** A signed URL to read one object. The bucket is private, so this is the only way in. */
export async function signedUrl(path: string, seconds = 60 * 60): Promise<string | null> {
  const { data, error } = await supabase.storage.from('images').createSignedUrl(path, seconds);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export type PipelineResult =
  | { status: 'ok'; path: string; url: string; timings: Timings }
  | { status: 'cancelled' }
  | { status: 'unsupported' }
  | { status: 'denied' }
  | { status: 'failed'; reason: string };

async function byteLength(uri: string): Promise<number> {
  // `fetch` on a file:// URI is how to get a Blob without pulling in expo-file-system
  // for one number. The blob is discarded immediately.
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return blob.size;
  } catch {
    return 0;
  }
}

/**
 * Picks one photo, shrinks it, uploads it, and hands back a signed URL.
 *
 * The object path is `<villageId>/<userId>/<name>` because the storage policies read
 * those two segments: the first decides which village may see it, the second decides who
 * may delete it. Neither is decoration and neither may be rearranged without rewriting
 * `20261103140000_images_bucket.sql`.
 */
export async function pickResizeUpload(
  villageId: string,
  userId: string,
): Promise<PipelineResult> {
  const imagePicker = pickerModule();
  const imageManipulator = manipulatorModule();
  if (!imagePicker || !imageManipulator) return { status: 'unsupported' };

  const started = Date.now();

  try {
    const permission = await imagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return { status: 'denied' };

    const picked = await imagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      // The system cropper is deliberately off: it is one more thing to explain, and the
      // photo a villager took is the photo they meant.
      allowsEditing: false,
      quality: 1,
    });
    const pickMs = Date.now() - started;

    if (picked.canceled || !picked.assets?.[0]) return { status: 'cancelled' };
    const asset = picked.assets[0];
    const originalBytes = asset.fileSize ?? (await byteLength(asset.uri));

    // --- resize -----------------------------------------------------------
    const resizeStart = Date.now();
    const longEdge = Math.max(asset.width ?? 0, asset.height ?? 0);
    const scale = longEdge > MAX_EDGE ? MAX_EDGE / longEdge : 1;

    const context = imageManipulator.ImageManipulator.manipulate(asset.uri);
    if (scale < 1) {
      context.resize({
        width: Math.round((asset.width ?? MAX_EDGE) * scale),
        height: Math.round((asset.height ?? MAX_EDGE) * scale),
      });
    }
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({
      compress: QUALITY,
      format: imageManipulator.SaveFormat.JPEG,
    });
    const resizeMs = Date.now() - resizeStart;

    // --- upload -----------------------------------------------------------
    const uploadStart = Date.now();
    const body = await (await fetch(saved.uri)).arrayBuffer();
    const uploadedBytes = body.byteLength;
    const path = `${villageId}/${userId}/${Date.now()}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('images')
      .upload(path, body, { contentType: 'image/jpeg', upsert: false });
    const uploadMs = Date.now() - uploadStart;

    if (uploadError) return { status: 'failed', reason: uploadError.message };

    // --- read back --------------------------------------------------------
    // A signed URL rather than a public one: the bucket is private so that the policy,
    // not the URL, decides who sees a photo of someone's house.
    const signStart = Date.now();
    const { data: signed, error: signError } = await supabase.storage
      .from('images')
      .createSignedUrl(path, 60 * 60);
    const signMs = Date.now() - signStart;

    if (signError || !signed) {
      return { status: 'failed', reason: signError?.message ?? 'no signed url' };
    }

    return {
      status: 'ok',
      path,
      url: signed.signedUrl,
      timings: {
        pickMs,
        resizeMs,
        uploadMs,
        signMs,
        totalMs: Date.now() - started,
        originalBytes,
        uploadedBytes,
      },
    };
  } catch (error) {
    return { status: 'failed', reason: error instanceof Error ? error.message : String(error) };
  }
}
