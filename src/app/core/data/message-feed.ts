import { computed, signal } from '@angular/core';
import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  type Firestore,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { LIMITS } from '@core/limits';
import { compareMessages, messageFromSnapshot, type ChatMessage } from '@core/models/chat-message';

/**
 * The messages of one open room.
 *
 * - One realtime listener on the newest page (LIMITS.messagePageSize messages).
 * - Older pages are fetched once, on demand, and do not update live.
 *
 * A message that drops out of the live page because newer ones arrived is a
 * "removed" change; the feed keeps it, since messages are never removed while
 * the room exists (deleting only clears the text).
 */
export class MessageFeed {
  private readonly byId = signal<ReadonlyMap<string, ChatMessage>>(new Map());
  private readonly loadingOlderState = signal(false);
  private readonly hasOlderState = signal(true);
  private readonly readyState = signal(false);
  private readonly errorState = signal<unknown>(null);

  private oldest: QueryDocumentSnapshot | null = null;
  private readonly unsubscribe: Unsubscribe;

  /** Oldest first. */
  readonly messages = computed(() => [...this.byId().values()].sort(compareMessages));
  readonly loadingOlder = this.loadingOlderState.asReadonly();
  readonly hasOlder = this.hasOlderState.asReadonly();
  /** True once the server (not just the local cache) has answered. */
  readonly ready = this.readyState.asReadonly();
  readonly error = this.errorState.asReadonly();

  constructor(
    private readonly db: Firestore,
    readonly roomId: string,
  ) {
    const newest = query(
      this.messagesRef(),
      orderBy('createdAt', 'desc'),
      limit(LIMITS.messagePageSize),
    );
    // Metadata changes matter here: they say when the server has confirmed the cached
    // page (even if nothing changed) and when a sent message stops being pending.
    this.unsubscribe = onSnapshot(
      newest,
      { includeMetadataChanges: true },
      (snapshot) => {
        const next = new Map(this.byId());
        for (const change of snapshot.docChanges({ includeMetadataChanges: true })) {
          if (change.type === 'removed') continue;
          const message = messageFromSnapshot(change.doc);
          if (message) next.set(message.id, message);
        }
        this.byId.set(next);
        // Until the server answers, the cache may hold fewer messages: keep moving the cursor.
        if (!this.readyState() && snapshot.docs.length > 0) {
          this.oldest = snapshot.docs[snapshot.docs.length - 1];
        }
        if (!snapshot.metadata.fromCache) {
          if (!this.readyState() && snapshot.size < LIMITS.messagePageSize) {
            this.hasOlderState.set(false);
          }
          this.readyState.set(true);
        }
      },
      (error) => this.errorState.set(error),
    );
  }

  /** Fetches the page before the oldest loaded message. */
  async loadOlder(): Promise<void> {
    if (!this.oldest || this.loadingOlderState() || !this.hasOlderState()) return;
    this.loadingOlderState.set(true);
    try {
      const page = await getDocs(
        query(
          this.messagesRef(),
          orderBy('createdAt', 'desc'),
          startAfter(this.oldest),
          limit(LIMITS.messagePageSize),
        ),
      );
      const next = new Map(this.byId());
      for (const document of page.docs) {
        const message = messageFromSnapshot(document);
        if (message) next.set(message.id, message);
      }
      this.byId.set(next);
      if (page.docs.length > 0) this.oldest = page.docs[page.docs.length - 1];
      if (page.size < LIMITS.messagePageSize) this.hasOlderState.set(false);
    } catch (error) {
      this.errorState.set(error);
    } finally {
      this.loadingOlderState.set(false);
    }
  }

  /** Stops the realtime listener. Call it when the room closes. */
  close(): void {
    this.unsubscribe();
  }

  private messagesRef() {
    return collection(this.db, 'rooms', this.roomId, 'messages');
  }
}
