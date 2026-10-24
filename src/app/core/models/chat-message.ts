import { Timestamp, type DocumentSnapshot } from 'firebase/firestore';

/** rooms/{roomId}/messages/{messageId}. */
export interface ChatMessage {
  readonly id: string;
  readonly senderId: string;
  readonly text: string;
  /** Exact server time; an estimate while the write is pending. */
  readonly createdAt: Timestamp;
  readonly editedAt: Timestamp | null;
  readonly deleted: boolean;
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
    pending: snapshot.metadata.hasPendingWrites,
  };
}

/** Oldest first; ties (same millisecond) fall back to the id so the order is stable. */
export function compareMessages(a: ChatMessage, b: ChatMessage): number {
  const byTime = a.createdAt.toMillis() - b.createdAt.toMillis();
  if (byTime !== 0) return byTime;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
