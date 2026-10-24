import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { Timestamp } from 'firebase/firestore';
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
  protected readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;

  readonly text = input.required<string>();
  readonly editedAt = input<Timestamp | null>(null);

  protected readonly blocks = computed(() => formatMessage(this.text()));
  protected readonly jumbo = computed(() => isJumboEmoji(this.text()));
}
