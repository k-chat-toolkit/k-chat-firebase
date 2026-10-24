import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  viewChild,
} from '@angular/core';
import type { MessageFeed } from '@core/data/message-feed';
import { I18nService } from '@core/i18n/i18n.service';
import type { ChatMessage } from '@core/models/chat-message';
import type { Room } from '@core/models/room';
import { Icon } from '@shared/ui/icon/icon';
import { MessageItem } from '../message-item/message-item';

/** Messages from one sender within this window share one header, as in Slack. */
const GROUPING_WINDOW_MS = 5 * 60_000;

/** How close to an edge (in pixels) counts as "at the bottom" or "at the top". */
const EDGE_PX = 120;

type Row =
  | { readonly kind: 'day'; readonly key: string; readonly label: string }
  | {
      readonly kind: 'message';
      readonly key: string;
      readonly message: ChatMessage;
      readonly compact: boolean;
    };

@Component({
  selector: 'app-message-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, MessageItem],
  templateUrl: './message-list.html',
  styleUrl: './message-list.css',
})
export class MessageList {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;

  readonly room = input.required<Room>();
  readonly feed = input.required<MessageFeed>();
  readonly displayName = input('');

  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');

  /** Follow new messages while the reader is at the bottom; leave them alone when scrolled up. */
  private stickToBottom = true;
  private previousFirstKey: string | undefined;
  private previousHeight = 0;

  protected readonly rows = computed<Row[]>(() => {
    const rows: Row[] = [];
    let previous: ChatMessage | null = null;
    let previousDay = '';
    for (const message of this.feed().messages()) {
      const date = message.createdAt.toDate();
      const day = date.toDateString();
      if (day !== previousDay) {
        rows.push({ kind: 'day', key: `day-${day}`, label: this.i18n.formatDay(date) });
        previousDay = day;
        previous = null;
      }
      const compact =
        previous !== null &&
        previous.senderId === message.senderId &&
        message.createdAt.toMillis() - previous.createdAt.toMillis() < GROUPING_WINDOW_MS;
      rows.push({ kind: 'message', key: message.id, message, compact });
      previous = message;
    }
    return rows;
  });

  constructor() {
    afterRenderEffect(() => {
      const rows = this.rows();
      const element = this.scroller().nativeElement;
      const firstKey = rows.find((row) => row.kind === 'message')?.key;
      if (this.stickToBottom) {
        element.scrollTop = element.scrollHeight;
      } else if (this.previousFirstKey && firstKey !== this.previousFirstKey) {
        // Older messages were added above: keep the visible ones where they were.
        element.scrollTop += element.scrollHeight - this.previousHeight;
      }
      this.previousFirstKey = firstKey;
      this.previousHeight = element.scrollHeight;
    });
  }

  scrollToBottom(): void {
    this.stickToBottom = true;
    const element = this.scroller().nativeElement;
    element.scrollTop = element.scrollHeight;
  }

  protected onScroll(): void {
    const element = this.scroller().nativeElement;
    this.stickToBottom = element.scrollHeight - element.scrollTop - element.clientHeight < EDGE_PX;
    if (element.scrollTop < EDGE_PX) this.loadOlder();
  }

  protected loadOlder(): void {
    const feed = this.feed();
    if (feed.hasOlder() && !feed.loadingOlder() && feed.ready()) {
      this.stickToBottom = false;
      void feed.loadOlder();
    }
  }
}
