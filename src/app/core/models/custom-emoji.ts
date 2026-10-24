import { Timestamp, type DocumentSnapshot } from 'firebase/firestore';
import { LIMITS } from '@core/limits';

/** customEmoji/{name}: an image anyone in the app can use as ":name:". */
export interface CustomEmoji {
  readonly name: string;
  /** A data URL: the Spark plan has no Cloud Storage. */
  readonly image: string;
  readonly createdBy: string;
  readonly createdAt: Timestamp | null;
}

/** Same rule as isEmojiName() in firestore.rules. */
export const EMOJI_NAME = new RegExp(`^[a-z0-9_-]{1,${LIMITS.emojiNameMaxLength}}$`);

/** How a custom emoji is written in message text and stored as a reaction. */
export function customEmojiKey(name: string): string {
  return `:${name}:`;
}

/** The name in a ":name:" key, or null when the key is a Unicode emoji. */
export function customEmojiName(key: string): string | null {
  const match = /^:([a-z0-9_-]+):$/.exec(key);
  return match ? match[1] : null;
}

export function customEmojiFromSnapshot(snapshot: DocumentSnapshot): CustomEmoji | null {
  const data = snapshot.data({ serverTimestamps: 'estimate' });
  if (!data) return null;
  const createdAt = data['createdAt'];
  return {
    name: snapshot.id,
    image: String(data['image'] ?? ''),
    createdBy: String(data['createdBy'] ?? ''),
    createdAt: createdAt instanceof Timestamp ? createdAt : null,
  };
}

/** A valid name from a file name: "Party Parrot (1).gif" → "party_parrot_1". */
export function suggestEmojiName(fileName: string): string {
  return fileName
    .replace(/\.[^.]*$/, '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^[_-]+|[_-]+$/g, '')
    .slice(0, LIMITS.emojiNameMaxLength);
}
