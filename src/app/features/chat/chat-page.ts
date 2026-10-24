import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { fromEvent, map, of, switchMap } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import type { MessageFeed } from '@core/data/message-feed';
import { MessageService } from '@core/data/message.service';
import { ProfileService } from '@core/data/profile.service';
import { ReadMarkersService } from '@core/data/read-markers.service';
import { RoomService } from '@core/data/room.service';
import { errorMessageKey, isPermissionDenied } from '@core/errors/app-error';
import { PageTitleService } from '@core/notifications/page-title.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/locales/en';
import type { ChatMessage } from '@core/models/chat-message';
import { directPartnerId, type Room } from '@core/models/room';
import { Avatar } from '@shared/ui/avatar/avatar';
import { Icon } from '@shared/ui/icon/icon';
import { decodeMentions } from '@shared/utils/mentions';
import { singleLine } from '@shared/utils/text';
import { Composer, type ReplyPreview } from './composer/composer';
import { MessageList } from './message-list/message-list';
import { RoomDetails } from './room-details/room-details';

/** One room: header, messages, composer and, on demand, the details panel. */
@Component({
  selector: 'app-chat-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Avatar, Icon, Composer, MessageList, RoomDetails],
  templateUrl: './chat-page.html',
  styleUrl: './chat-page.css',
})
export class ChatPage {
  private readonly auth = inject(AuthService);
  private readonly rooms = inject(RoomService);
  private readonly messages = inject(MessageService);
  private readonly profiles = inject(ProfileService);
  private readonly readMarkers = inject(ReadMarkersService);
  private readonly pageTitle = inject(PageTitleService);
  private readonly document = inject(DOCUMENT);
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;

  /** Whether this browser tab is the one on screen. */
  private readonly tabVisible = toSignal(
    fromEvent(this.document, 'visibilitychange').pipe(
      map(() => this.document.visibilityState === 'visible'),
    ),
    { initialValue: this.document.visibilityState === 'visible' },
  );

  /** From the route /r/:roomId. */
  readonly roomId = input.required<string>();
  /** `?details=1` opens the details panel, e.g. right after creating a room. */
  readonly details = input<string>();

  private readonly messageList = viewChild(MessageList);
  private readonly composer = viewChild(Composer);

  protected readonly showDetails = signal(false);
  protected readonly sendError = signal<TranslationKey | null>(null);
  protected readonly feed = signal<MessageFeed | null>(null);
  /** The message the next one answers, while replying. */
  protected readonly replyingTo = signal<ChatMessage | null>(null);

  protected readonly replyPreview = computed<ReplyPreview | null>(() => {
    const message = this.replyingTo();
    if (!message) return null;
    const profile = this.profiles.profile(message.senderId)();
    const name = profile === undefined ? '…' : (profile?.displayName ?? this.t('chat.unknownUser'));
    const text = singleLine(decodeMentions(message.text, (uid) => this.profiles.cachedName(uid)));
    return { name, text };
  });

  /** The id to watch on its own when the room is not in the sidebar's list. */
  private readonly missingId = computed(() => {
    const list = this.rooms.rooms();
    if (list === undefined) return null;
    const id = this.roomId();
    return list.some((room) => room.id === id) ? null : id;
  });

  private readonly fallbackRoom = toSignal(
    toObservable(this.missingId).pipe(
      switchMap((id) => (id ? this.rooms.watchRoom(id) : of(undefined))),
    ),
    { initialValue: undefined },
  );

  protected readonly room = computed<Room | null | undefined>(
    () => this.rooms.findRoom(this.roomId()) ?? this.fallbackRoom(),
  );

  protected readonly gone = computed(
    () => this.room() === null || isPermissionDenied(this.feed()?.error()),
  );

  protected readonly uid = computed(() => this.auth.user()?.uid ?? '');

  protected readonly partnerId = computed(() => {
    const room = this.room();
    return room?.type === 'direct' ? directPartnerId(room, this.uid()) : null;
  });

  protected readonly displayName = computed(() => {
    const room = this.room();
    if (!room) return '';
    if (room.type === 'group') return room.name;
    const partner = this.partnerId();
    return (partner && this.profiles.profile(partner)()?.displayName) || '…';
  });

  protected readonly placeholder = computed(() => {
    const room = this.room();
    const name = this.displayName();
    return room?.type === 'group'
      ? this.t('chat.placeholderGroup', { name })
      : this.t('chat.placeholderDirect', { name });
  });

  protected readonly memberLabel = computed(() => {
    const count = this.room()?.memberIds.length ?? 0;
    return count === 1 ? this.t('chat.memberCountOne') : this.t('chat.memberCount', { count });
  });

  constructor() {
    // One live feed per open room; switching rooms closes the previous listener.
    effect((onCleanup) => {
      const feed = this.messages.openFeed(this.roomId());
      this.feed.set(feed);
      this.sendError.set(null);
      this.replyingTo.set(null);
      onCleanup(() => feed.close());
    });

    effect(() => {
      if (this.details()) this.showDetails.set(true);
    });

    // Seeing the room marks it as read, including messages that arrive while it is on
    // screen. A message that arrives while the tab is in the background stays unread.
    effect(() => {
      const room = this.room();
      if (room && this.tabVisible()) untracked(() => this.readMarkers.markRead(room));
    });

    effect(() => {
      const name = this.displayName();
      const prefix = this.room()?.type === 'group' ? '#' : '';
      this.pageTitle.set(name ? `${prefix}${name}` : null);
    });
    inject(DestroyRef).onDestroy(() => this.pageTitle.set(null));
  }

  protected toggleDetails(): void {
    this.showDetails.update((open) => !open);
  }

  /** ArrowUp in an empty box edits your last message, as in Slack. */
  protected editLast(): void {
    this.messageList()?.editLastOwn(this.uid());
  }

  protected focusComposer(): void {
    this.composer()?.focus();
  }

  protected startReply(message: ChatMessage): void {
    this.replyingTo.set(message);
    this.composer()?.focus();
  }

  protected async send(text: string): Promise<void> {
    this.sendError.set(null);
    this.messageList()?.scrollToBottom();
    const replyTo = this.replyingTo();
    this.replyingTo.set(null);
    try {
      await this.messages.send(this.roomId(), text, replyTo);
    } catch (error) {
      this.sendError.set(errorMessageKey(error));
    }
  }
}
