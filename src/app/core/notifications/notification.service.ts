import { DOCUMENT } from '@angular/common';
import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { ProfileService } from '@core/data/profile.service';
import { RoomService } from '@core/data/room.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { LastMessage, Room } from '@core/models/room';
import { decodeMentions, mentionsUser } from '@shared/utils/mentions';
import { singleLine } from '@shared/utils/text';

export type NotificationLevel = 'off' | 'mentions' | 'all';

export type NotificationPermissionState = NotificationPermission | 'unsupported';

const STORAGE_KEY = 'k-chat.notifications';

/** A message older than this when it arrives (say, after a reconnect) is not announced. */
const FRESH_MS = 2 * 60_000;
const BODY_MAX_LENGTH = 140;

/**
 * Whether a room's new last message deserves a notification: someone else's,
 * fresh, while the tab is in the background, and wanted at `level` ("mentions"
 * means direct messages and messages that mention you).
 */
export function shouldNotify(
  room: Room,
  last: LastMessage,
  uid: string,
  level: NotificationLevel,
  tabVisible: boolean,
  now: number,
): boolean {
  if (level === 'off' || tabVisible) return false;
  if (last.senderId === uid || last.deleted || !last.createdAt) return false;
  if (now - last.createdAt.toMillis() > FRESH_MS) return false;
  return level === 'all' || room.type === 'direct' || mentionsUser(last.text, uid);
}

/**
 * Desktop notifications for new messages while the app is open in a background
 * tab. They come from the room list's listener, so they cost no extra read.
 * Push notifications with the app closed would need a server (Cloud Functions,
 * which needs the Blaze plan), so they are not offered.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly auth = inject(AuthService);
  private readonly rooms = inject(RoomService);
  private readonly profiles = inject(ProfileService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly document = inject(DOCUMENT);

  private readonly levelState = signal<NotificationLevel>(loadLevel());
  private readonly permissionState = signal<NotificationPermissionState>(currentPermission());
  /** The last message id seen per room. The first sight of a room never notifies. */
  private readonly seen = new Map<string, string>();
  private seenFor: string | null = null;

  /** This browser's choice; it is not synced to other devices. */
  readonly level = this.levelState.asReadonly();
  readonly permission = this.permissionState.asReadonly();

  constructor() {
    effect(() => {
      const rooms = this.rooms.rooms();
      const uid = this.auth.user()?.uid;
      if (rooms && uid) untracked(() => this.check(rooms, uid));
    });
  }

  /** Asks the browser for permission first when needed: call it from a click. */
  async setLevel(level: NotificationLevel): Promise<void> {
    // Read again: the person may have changed it in the site settings since.
    this.permissionState.set(currentPermission());
    if (level !== 'off' && this.permissionState() === 'default') {
      this.permissionState.set(await Notification.requestPermission());
    }
    this.levelState.set(level);
    try {
      localStorage.setItem(STORAGE_KEY, level);
    } catch {
      // Storage can be blocked (private mode); the choice then lasts for this visit only.
    }
  }

  private check(rooms: readonly Room[], uid: string): void {
    if (this.seenFor !== uid) {
      this.seen.clear();
      this.seenFor = uid;
    }
    const level = this.levelState();
    const allowed = this.permissionState() === 'granted';
    const visible = this.document.visibilityState === 'visible';
    for (const room of rooms) {
      const last = room.lastMessage;
      if (!last) continue;
      const previous = this.seen.get(room.id);
      this.seen.set(room.id, last.id);
      if (previous === undefined || previous === last.id || !allowed) continue;
      if (shouldNotify(room, last, uid, level, visible, Date.now())) this.show(room, last);
    }
  }

  private show(room: Room, last: LastMessage): void {
    const sender = this.profiles.cachedName(last.senderId) ?? this.i18n.t('chat.unknownUser');
    const text = singleLine(decodeMentions(last.text, (uid) => this.profiles.cachedName(uid)));
    const short = text.length > BODY_MAX_LENGTH ? `${text.slice(0, BODY_MAX_LENGTH)}…` : text;
    const title = room.type === 'group' ? `#${room.name}` : sender;
    const body =
      room.type === 'group' ? this.i18n.t('preview.theirs', { name: sender, text: short }) : short;
    // The tag makes a newer notification for the same room replace the older one.
    const notification = new Notification(title, { body, tag: room.id, icon: '/favicon.ico' });
    notification.onclick = () => {
      this.document.defaultView?.focus();
      void this.router.navigate(['/r', room.id]);
      notification.close();
    };
  }
}

function loadLevel(): NotificationLevel {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'mentions' || saved === 'all' ? saved : 'off';
  } catch {
    return 'off';
  }
}

function currentPermission(): NotificationPermissionState {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}
