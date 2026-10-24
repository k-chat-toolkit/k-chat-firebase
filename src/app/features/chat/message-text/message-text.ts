import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { Timestamp } from 'firebase/firestore';
import { AuthService } from '@core/auth/auth.service';
import { CustomEmojiService } from '@core/data/custom-emoji.service';
import { ProfileService } from '@core/data/profile.service';
import { I18nService } from '@core/i18n/i18n.service';
import { formatMessage, isJumboEmoji } from '@shared/utils/message-format';

/** The body of a message, with Slack's formatting. Nothing is ever rendered as HTML. */
@Component({
  selector: 'app-message-text',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.jumbo]': 'jumbo()' },
  templateUrl: './message-text.html',
  styleUrl: './message-text.css',
})
export class MessageText {
  private readonly customEmoji = inject(CustomEmojiService);
  private readonly profiles = inject(ProfileService);
  private readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;

  readonly text = input.required<string>();
  readonly editedAt = input<Timestamp | null>(null);

  protected readonly blocks = computed(() => formatMessage(this.text()));
  protected readonly jumbo = computed(() =>
    isJumboEmoji(this.text(), (name) => !!this.customEmoji.emoji(name)()),
  );

  /** A mentioned person's current name: one profile read per person per session. */
  protected mentionName(uid: string): string {
    const profile = this.profiles.profile(uid)();
    return profile === undefined ? '…' : (profile?.displayName ?? this.t('chat.unknownUser'));
  }

  protected isMe(uid: string): boolean {
    return uid === this.auth.user()?.uid;
  }

  /** The image of the custom emoji called `name`, or null to show the ":name:" text. */
  protected emojiImage(name: string): string | null {
    return this.customEmoji.emoji(name)()?.image ?? null;
  }
}
