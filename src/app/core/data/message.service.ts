import { inject, Injectable, signal, type Signal, type WritableSignal } from '@angular/core';
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteField,
  doc,
  FieldPath,
  getDoc,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { AuthService } from '@core/auth/auth.service';
import { AppError } from '@core/errors/app-error';
import { FIRESTORE } from '@core/firebase/firebase.providers';
import { LIMITS } from '@core/limits';
import { messageFromSnapshot, type ChatMessage, type ReplyTarget } from '@core/models/chat-message';
import type { Room } from '@core/models/room';
import { MessageFeed } from './message-feed';

/** Message writes. Each one mirrors a branch of firestore.rules, named in its comment. */
@Injectable({ providedIn: 'root' })
export class MessageService {
  private readonly db = inject(FIRESTORE);
  private readonly auth = inject(AuthService);
  private readonly fetched = new Map<string, WritableSignal<ChatMessage | null | undefined>>();

  /** A feed for one room. The caller must `close()` it. */
  openFeed(roomId: string): MessageFeed {
    return new MessageFeed(this.db, roomId);
  }

  /**
   * One message, fetched once per session: the original of a reply when it is not
   * among the loaded pages. Undefined while loading, null if it is gone.
   * Rules: messages `allow get`.
   */
  message(roomId: string, id: string): Signal<ChatMessage | null | undefined> {
    const key = `${roomId}/${id}`;
    const known = this.fetched.get(key);
    if (known) return known;
    const entry = signal<ChatMessage | null | undefined>(undefined);
    this.fetched.set(key, entry);
    getDoc(doc(this.db, 'rooms', roomId, 'messages', id)).then(
      (snapshot) => entry.set(messageFromSnapshot(snapshot)),
      () => entry.set(null),
    );
    return entry;
  }

  /**
   * Sends a message, maybe as a reply, and refreshes the room's preview in one batch.
   * Rules: messages `allow create` (with isReplyTarget()) + rooms isNewMessageActivity().
   */
  async send(roomId: string, text: string, replyTo: ReplyTarget | null = null): Promise<void> {
    const senderId = this.auth.requireUid();
    const messageRef = doc(collection(this.db, 'rooms', roomId, 'messages'));
    const batch = writeBatch(this.db);
    batch.set(messageRef, {
      senderId,
      text,
      createdAt: serverTimestamp(),
      editedAt: null,
      deleted: false,
      replyTo: replyTo && { id: replyTo.id, senderId: replyTo.senderId },
    });
    batch.update(doc(this.db, 'rooms', roomId), {
      lastMessage: {
        id: messageRef.id,
        senderId,
        text,
        createdAt: serverTimestamp(),
        deleted: false,
      },
      lastActivityAt: serverTimestamp(),
    });
    await batch.commit();
  }

  /** Rules: messages isEdit(), plus isLastMessageSync() when it is the newest message. */
  async edit(room: Room, message: ChatMessage, text: string): Promise<void> {
    const batch = writeBatch(this.db);
    batch.update(doc(this.db, 'rooms', room.id, 'messages', message.id), {
      text,
      editedAt: serverTimestamp(),
    });
    this.syncPreview(batch, room, message, { text, deleted: false });
    await batch.commit();
  }

  /** Clears the text and keeps the message's place. Rules: isSoftDelete(). */
  async softDelete(room: Room, message: ChatMessage): Promise<void> {
    const batch = writeBatch(this.db);
    batch.update(doc(this.db, 'rooms', room.id, 'messages', message.id), {
      text: '',
      deleted: true,
    });
    this.syncPreview(batch, room, message, { text: '', deleted: true });
    await batch.commit();
  }

  /**
   * Adds your reaction, or takes it back if you already reacted with `key`.
   * Only the entry under your own uid changes. Rules: messages isReaction().
   */
  async toggleReaction(roomId: string, message: ChatMessage, key: string): Promise<void> {
    const uid = this.auth.requireUid();
    const mine = message.reactions[uid] ?? [];
    const ref = doc(this.db, 'rooms', roomId, 'messages', message.id);
    const field = new FieldPath('reactions', uid);
    if (mine.includes(key)) {
      await updateDoc(ref, field, mine.length === 1 ? deleteField() : arrayRemove(key));
    } else {
      if (mine.length >= LIMITS.messageReactionsPerUser) throw new AppError('too-many-reactions');
      await updateDoc(ref, field, arrayUnion(key));
    }
  }

  private syncPreview(
    batch: ReturnType<typeof writeBatch>,
    room: Room,
    message: ChatMessage,
    change: { text: string; deleted: boolean },
  ): void {
    const preview = room.lastMessage;
    if (!preview || preview.id !== message.id || !preview.createdAt) return;
    batch.update(doc(this.db, 'rooms', room.id), {
      lastMessage: { ...preview, ...change },
    });
  }
}
