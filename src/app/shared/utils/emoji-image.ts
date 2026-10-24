import { AppError } from '@core/errors/app-error';

export const EMOJI_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

/** Custom emoji are stored at most this big: sharp at Slack's 32 px "jumbo" size on 2× screens. */
export const EMOJI_SIZE_PX = 64;

/** A GIF up to this size is kept as it is, since redrawing it would stop the animation. */
const GIF_MAX_SIZE_PX = 128;

/** Tried in order until one fits. A browser without WebP output returns PNG instead. */
const ENCODINGS: readonly [type: string, quality?: number][] = [
  ['image/webp', 0.92],
  ['image/webp', 0.75],
  ['image/png'],
];

export interface PreparedEmojiImage {
  /** A data URL no longer than the limit, ready for customEmoji/{name}.image. */
  readonly dataUrl: string;
  /** An animated GIF kept as it is. */
  readonly animated: boolean;
  /** A GIF too big to keep, so only its first frame is stored. */
  readonly animationDropped: boolean;
}

/**
 * Shrinks a picked file into a small data URL, since the Spark plan has no Cloud
 * Storage to hold images. Throws an AppError the UI can explain.
 */
export async function prepareEmojiImage(
  file: File,
  maxLength: number,
): Promise<PreparedEmojiImage> {
  if (!EMOJI_IMAGE_TYPES.includes(file.type)) throw new AppError('emoji-image-type');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new AppError('emoji-image-unreadable');
  }
  try {
    const isGif = file.type === 'image/gif';
    if (isGif && bitmap.width <= GIF_MAX_SIZE_PX && bitmap.height <= GIF_MAX_SIZE_PX) {
      const original = await readAsDataUrl(file);
      if (original.length <= maxLength) {
        return { dataUrl: original, animated: true, animationDropped: false };
      }
    }
    const scale = Math.min(1, EMOJI_SIZE_PX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new AppError('emoji-image-unreadable');
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const [type, quality] of ENCODINGS) {
      const dataUrl = canvas.toDataURL(type, quality);
      if (dataUrl.startsWith(`data:${type};base64,`) && dataUrl.length <= maxLength) {
        return { dataUrl, animated: false, animationDropped: isGif };
      }
    }
    throw new AppError('emoji-image-too-large');
  } finally {
    bitmap.close();
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new AppError('emoji-image-unreadable'));
    reader.readAsDataURL(file);
  });
}
