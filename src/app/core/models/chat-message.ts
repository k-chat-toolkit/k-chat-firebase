import { Timestamp, type DocumentSnapshot } from 'firebase/firestore';

/** The message a reply answers: its id, and its sender so a reply to you shows without a read. */
export interface ReplyTarget {
  readonly id: string;
  readonly senderId: string;
}

/** rooms/{roomId}/messages/{messageId}. */
export interface ChatMessage {
  readonly id: string;
  readonly senderId: string;
  readonly text: string;
  /** Exact server time; an estimate while the write is pending. */
  readonly createdAt: Timestamp;
  readonly editedAt: Timestamp | null;
  readonly deleted: boolean;
  readonly replyTo: ReplyTarget | null;
  /** Each person's reactions, by uid: Unicode emoji, or ":name:" for custom ones. */
  readonly reactions: Readonly<Record<string, readonly string[]>>;
  /** Written locally, not yet confirmed by the server. */
  readonly pending: boolean;
}

export function messageFromSnapshot(snapshot: DocumentSnapshot): ChatMessage | null {
  const data = snapshot.data({ serverTimestamps: 'estimate' });
  if (!data) return null;
  const createdAt = data['createdAt'];
  const editedAt = data['editedAt'];
  return {
    id: snapshot.id,
    senderId: String(data['senderId']),
    text: String(data['text'] ?? ''),
    createdAt: createdAt instanceof Timestamp ? createdAt : Timestamp.now(),
    editedAt: editedAt instanceof Timestamp ? editedAt : null,
    deleted: data['deleted'] === true,
    replyTo: replyTargetFrom(data['replyTo']),
    reactions: reactionsFrom(data['reactions']),
    pending: snapshot.metadata.hasPendingWrites,
  };
}

function replyTargetFrom(value: unknown): ReplyTarget | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  return typeof data['id'] === 'string' && typeof data['senderId'] === 'string'
    ? { id: data['id'], senderId: data['senderId'] }
    : null;
}

function reactionsFrom(value: unknown): Record<string, readonly string[]> {
  const reactions: Record<string, readonly string[]> = {};
  if (!value || typeof value !== 'object') return reactions;
  for (const [uid, keys] of Object.entries(value)) {
    if (!Array.isArray(keys)) continue;
    const valid = keys.filter((key): key is string => typeof key === 'string');
    if (valid.length > 0) reactions[uid] = valid;
  }
  return reactions;
}

/** Oldest first; ties (same millisecond) fall back to the id so the order is stable. */
export function compareMessages(a: ChatMessage, b: ChatMessage): number {
  const byTime = a.createdAt.toMillis() - b.createdAt.toMillis();
  if (byTime !== 0) return byTime;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
