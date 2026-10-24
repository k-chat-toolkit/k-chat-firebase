import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { CustomEmojiService } from '@core/data/custom-emoji.service';
import type { MessageFeed } from '@core/data/message-feed';
import { MessageService } from '@core/data/message.service';
import { ProfileService } from '@core/data/profile.service';
import { RecentEmojiService } from '@core/data/recent-emoji.service';
import { errorMessageKey } from '@core/errors/app-error';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/locales/en';
import { LIMITS } from '@core/limits';
import type { ChatMessage } from '@core/models/chat-message';
import { customEmojiName } from '@core/models/custom-emoji';
import type { Room } from '@core/models/room';
import { Avatar } from '@shared/ui/avatar/avatar';
import { ConfirmService } from '@shared/ui/confirm-dialog/confirm.service';
import { Icon } from '@shared/ui/icon/icon';
import { decodeMentions, encodeMentions, mentionsUser } from '@shared/utils/mentions';
import { groupReactions, type ReactionGroup } from '@shared/utils/reactions';
import { singleLine } from '@shared/utils/text';
import { EmojiGlyph } from '../emoji-glyph/emoji-glyph';
import { EmojiPicker } from '../emoji-picker/emoji-picker';
import { MessageText } from '../message-text/message-text';

/** Names listed in a reaction's tooltip before "and N others". */
const REACTION_NAMES_SHOWN = 10;

/**
 * One message: avatar, name and time (unless compact), the message it replies to,
 * text, reactions, and a toolbar to react and reply, plus edit and delete for your own.
 */
@Component({
  selector: 'app-message-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, Icon, MessageText, EmojiGlyph, EmojiPicker],
  host: {
    '[class.compact]': 'compact()',
    '[class.editing]': 'editing()',
    '[class.pending]': 'message().pending',
    '[class.active]': 'active() || pickerAnchor() !== null',
    '[class.mentioned]': 'mentioned()',
    '[class.highlighted]': 'highlighted()',
    '[attr.data-message-id]': 'message().id',
    '(click)': 'onTap($event)',
  },
  templateUrl: './message-item.html',
  styleUrl: './message-item.css',
})
export class MessageItem {
  private readonly auth = inject(AuthService);
  private readonly messages = inject(MessageService);
  private readonly profiles = inject(ProfileService);
  private readonly confirm = inject(ConfirmService);
  private readonly recentEmoji = inject(RecentEmojiService);
  private readonly customEmoji = inject(CustomEmojiService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  protected readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;

  readonly message = input.required<ChatMessage>();
  readonly room = input.required<Room>();
  /** The open room's messages, where the original of a reply usually is. */
  readonly feed = input.required<MessageFeed>();
  /** Same sender as the message above, within a few minutes: no avatar or name. */
  readonly compact = input(false);
  /** Flashed after a jump from a reply. */
  readonly highlighted = input(false);

  readonly replyRequested = output<ChatMessage>();
  /** The id of the original message, when its quote is clicked. */
  readonly jumpRequested = output<string>();

  private readonly editor = viewChild<ElementRef<HTMLTextAreaElement>>('editor');

  protected readonly maxLength = LIMITS.messageMaxLength;
  protected readonly editing = signal(false);
  protected readonly draft = signal('');
  protected readonly error = signal<TranslationKey | null>(null);
  /** On a touch screen, where nothing hovers, a tap shows the toolbar. */
  protected readonly active = signal(false);
  /** The button the emoji picker opened from, while it is open. */
  protected readonly pickerAnchor = signal<HTMLElement | null>(null);
  protected readonly quickReactions = computed(() =>
    this.recentEmoji.quickReactions((key) => {
      const name = customEmojiName(key);
      return name === null || this.customEmoji.emoji(name)() !== null;
    }),
  );

  protected readonly senderName = computed(() => {
    const profile = this.profiles.profile(this.message().senderId)();
    if (profile === undefined) return '…';
    return profile?.displayName ?? this.t('chat.unknownUser');
  });

  protected readonly mine = computed(() => this.message().senderId === this.auth.user()?.uid);
  protected readonly canChange = computed(
    () => this.mine() && !this.message().deleted && !this.message().pending,
  );
  protected readonly canReact = computed(() => !this.message().deleted && !this.message().pending);
  protected readonly reactions = computed(() =>
    groupReactions(this.message().reactions, this.auth.user()?.uid ?? ''),
  );

  /** Mentions you, or replies to a message of yours: highlighted, as in Slack. */
  protected readonly mentioned = computed(() => {
    const uid = this.auth.user()?.uid ?? '';
    const message = this.message();
    if (message.deleted || message.senderId === uid) return false;
    return mentionsUser(message.text, uid) || message.replyTo?.senderId === uid;
  });

  /** The original of a reply: undefined while loading, null if it is gone. */
  protected readonly quoted = computed(() => {
    const reply = this.message().replyTo;
    if (!reply) return null;
    return this.feed().find(reply.id) ?? this.messages.message(this.room().id, reply.id)();
  });
  protected readonly time = computed(() => this.i18n.formatTime(this.message().createdAt.toDate()));
  protected readonly fullTime = computed(() =>
    this.i18n.formatDateTime(this.message().createdAt.toDate()),
  );
  protected readonly draftValid = computed(() => {
    const text = this.draft();
    return text.trim().length > 0 && text.length <= LIMITS.messageMaxLength;
  });

  constructor() {
    // The editor exists only while editing: focus it as soon as it renders, cursor at the end.
    effect(() => {
      const editor = this.editor()?.nativeElement;
      if (!editor) return;
      editor.focus();
      editor.setSelectionRange(editor.value.length, editor.value.length);
    });

    // A tap elsewhere hides the toolbar again.
    const onPointerDown = (event: PointerEvent) => {
      if (!this.host.nativeElement.contains(event.target as Node)) this.active.set(false);
    };
    effect((onCleanup) => {
      if (!this.active()) return;
      this.document.addEventListener('pointerdown', onPointerDown, true);
      onCleanup(() => this.document.removeEventListener('pointerdown', onPointerDown, true));
    });
  }

  protected onTap(event: MouseEvent): void {
    if (!this.document.defaultView?.matchMedia('(hover: none)').matches) return;
    if ((event.target as Element).closest('a, button, textarea, input')) return;
    this.active.update((active) => !active);
  }

  protected async react(key: string): Promise<void> {
    this.error.set(null);
    const adding = !this.reactions().some((group) => group.key === key && group.mine);
    try {
      await this.messages.toggleReaction(this.room().id, this.message(), key);
      if (adding) this.recentEmoji.use(key);
    } catch (error) {
      this.error.set(errorMessageKey(error));
    }
  }

  protected togglePicker(anchor: HTMLElement): void {
    this.pickerAnchor.update((open) => (open === anchor ? null : anchor));
  }

  protected closePicker(): void {
    this.pickerAnchor()?.focus();
    this.pickerAnchor.set(null);
  }

  protected onPicked(key: string): void {
    this.closePicker();
    const alreadyMine = this.reactions().some((group) => group.key === key && group.mine);
    // Picking an emoji you already reacted with keeps it, unlike clicking its chip.
    if (!alreadyMine) void this.react(key);
  }

  protected nameOf(uid: string): string {
    const profile = this.profiles.profile(uid)();
    return profile === undefined ? '…' : (profile?.displayName ?? this.t('chat.unknownUser'));
  }

  /** One line of the original, with names in place of mention tokens. */
  protected snippet(text: string): string {
    return singleLine(decodeMentions(text, (uid) => this.profiles.cachedName(uid)));
  }

  /** "An, Bình and you reacted with 🎉". */
  protected reactionTitle(group: ReactionGroup): string {
    const uid = this.auth.user()?.uid;
    const names = group.uids.slice(0, REACTION_NAMES_SHOWN).map((id) => {
      if (id === uid) return this.t('reactions.you');
      const profile = this.profiles.profile(id)();
      return profile === undefined ? '…' : (profile?.displayName ?? this.t('chat.unknownUser'));
    });
    const others = group.uids.length - names.length;
    const list = this.i18n.formatList(names);
    return others > 0
      ? this.t('reactions.summaryMore', { names: list, count: others, emoji: group.key })
      : this.t('reactions.summary', { names: list, emoji: group.key });
  }

  protected startEdit(): void {
    this.draft.set(decodeMentions(this.message().text, (uid) => this.profiles.cachedName(uid)));
    this.error.set(null);
    this.editing.set(true);
  }

  protected cancelEdit(): void {
    this.editing.set(false);
  }

  protected onEditorKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelEdit();
    } else if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      void this.saveEdit();
    }
  }

  protected async saveEdit(): Promise<void> {
    if (!this.draftValid()) return;
    const members = this.room().memberIds.map((uid) => ({
      uid,
      name: this.profiles.cachedName(uid) ?? '',
    }));
    const text = encodeMentions(this.draft().trim(), members);
    if (text === this.message().text) {
      this.editing.set(false);
      return;
    }
    try {
      await this.messages.edit(this.room(), this.message(), text);
      this.editing.set(false);
    } catch (error) {
      this.error.set(errorMessageKey(error));
    }
  }

  protected async remove(): Promise<void> {
    const confirmed = await this.confirm.confirm({
      title: this.t('chat.deleteTitle'),
      body: this.t('chat.deleteBody'),
      confirmLabel: this.t('chat.delete'),
      danger: true,
    });
    if (!confirmed) return;
    try {
      await this.messages.softDelete(this.room(), this.message());
    } catch (error) {
      this.error.set(errorMessageKey(error));
    }
  }
}
