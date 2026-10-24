import { inject, Injectable } from '@angular/core';
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { AuthService } from '@core/auth/auth.service';
import { FIRESTORE } from '@core/firebase/firebase.providers';
import type { ChatMessage } from '@core/models/chat-message';
import type { Room } from '@core/models/room';
import { MessageFeed } from './message-feed';

/** Message writes. Each one mirrors a branch of firestore.rules, named in its comment. */
@Injectable({ providedIn: 'root' })
export class MessageService {
  private readonly db = inject(FIRESTORE);
  private readonly auth = inject(AuthService);

  /** A feed for one room. The caller must `close()` it. */
  openFeed(roomId: string): MessageFeed {
    return new MessageFeed(this.db, roomId);
  }

  /**
   * Sends a message and refreshes the room's preview in one batch.
   * Rules: messages `allow create` + rooms isNewMessageActivity().
   */
  async send(roomId: string, text: string): Promise<void> {
    const senderId = this.auth.requireUid();
    const messageRef = doc(collection(this.db, 'rooms', roomId, 'messages'));
    const batch = writeBatch(this.db);
    batch.set(messageRef, {
      senderId,
      text,
      createdAt: serverTimestamp(),
      editedAt: null,
      deleted: false,
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
