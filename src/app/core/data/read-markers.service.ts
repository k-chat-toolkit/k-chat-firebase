import { computed, inject, Injectable, signal } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import type { Room } from '@core/models/room';

const STORAGE_PREFIX = 'k-chat.read.';

type Markers = Readonly<Record<string, number>>;

/**
 * Unread markers, kept in this browser's localStorage instead of Firestore:
 * marking a room as read costs no write and no quota. The trade-off is that
 * another device does not know what you have read here.
 */
@Injectable({ providedIn: 'root' })
export class ReadMarkersService {
  private readonly auth = inject(AuthService);
  /** Markers per uid, loaded from storage once and kept in memory. */
  private readonly byUser = signal<ReadonlyMap<string, Markers>>(new Map());

  private readonly markers = computed((): Markers => {
    const uid = this.auth.user()?.uid;
    if (!uid) return {};
    return this.byUser().get(uid) ?? load(uid);
  });

  /** True when someone else posted in `room` after you last opened it. */
  isUnread(room: Room): boolean {
    const uid = this.auth.user()?.uid;
    const last = room.lastMessage;
    if (!uid || !last || last.senderId === uid || !last.createdAt) return false;
    return last.createdAt.toMillis() > (this.markers()[room.id] ?? 0);
  }

  /** Remembers that you have seen everything in `room` up to its newest message. */
  markRead(room: Room): void {
    const uid = this.auth.user()?.uid;
    const seenUpTo = room.lastMessage?.createdAt?.toMillis();
    if (!uid || seenUpTo === undefined) return;
    const markers = this.markers();
    if ((markers[room.id] ?? 0) >= seenUpTo) return;
    const next = { ...markers, [room.id]: seenUpTo };
    this.byUser.update((all) => new Map(all).set(uid, next));
    save(uid, next);
  }
}

function load(uid: string): Markers {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_PREFIX + uid) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Markers) : {};
  } catch {
    return {};
  }
}

function save(uid: string, markers: Markers): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + uid, JSON.stringify(markers));
  } catch {
    // Storage can be blocked (private mode); the markers then last for this visit only.
  }
}
