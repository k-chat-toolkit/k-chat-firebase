import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { MessageService } from '@core/data/message.service';
import { ProfileService } from '@core/data/profile.service';
import { errorMessageKey } from '@core/errors/app-error';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/locales/en';
import { LIMITS } from '@core/limits';
import type { ChatMessage } from '@core/models/chat-message';
import type { Room } from '@core/models/room';
import { Avatar } from '@shared/ui/avatar/avatar';
import { ConfirmService } from '@shared/ui/confirm-dialog/confirm.service';
import { Icon } from '@shared/ui/icon/icon';
import { linkify } from '@shared/utils/text';

/** One message: avatar, name and time (unless compact), text, and edit/delete for your own. */
@Component({
  selector: 'app-message-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, Icon],
  host: {
    '[class.compact]': 'compact()',
    '[class.editing]': 'editing()',
    '[class.pending]': 'message().pending',
  },
  templateUrl: './message-item.html',
  styleUrl: './message-item.css',
})
export class MessageItem {
  private readonly auth = inject(AuthService);
  private readonly messages = inject(MessageService);
  private readonly profiles = inject(ProfileService);
  private readonly confirm = inject(ConfirmService);
  protected readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;

  readonly message = input.required<ChatMessage>();
  readonly room = input.required<Room>();
  /** Same sender as the message above, within a few minutes: no avatar or name. */
  readonly compact = input(false);

  private readonly editor = viewChild<ElementRef<HTMLTextAreaElement>>('editor');

  protected readonly maxLength = LIMITS.messageMaxLength;
  protected readonly editing = signal(false);
  protected readonly draft = signal('');
  protected readonly error = signal<TranslationKey | null>(null);

  protected readonly senderName = computed(() => {
    const profile = this.profiles.profile(this.message().senderId)();
    if (profile === undefined) return '…';
    return profile?.displayName ?? this.t('chat.unknownUser');
  });

  protected readonly mine = computed(() => this.message().senderId === this.auth.user()?.uid);
  protected readonly canChange = computed(
    () => this.mine() && !this.message().deleted && !this.message().pending,
  );
  protected readonly segments = computed(() => linkify(this.message().text));
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
  }

  protected startEdit(): void {
    this.draft.set(this.message().text);
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
    const text = this.draft().trim();
    if (!this.draftValid()) return;
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
