import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CustomEmojiService } from '@core/data/custom-emoji.service';
import { RecentEmojiService } from '@core/data/recent-emoji.service';
import { I18nService } from '@core/i18n/i18n.service';
import { LIMITS } from '@core/limits';
import { loadUnicodeEmoji, searchEmoji, type UnicodeEmoji } from '@shared/emoji/unicode-emoji';
import { Icon } from '@shared/ui/icon/icon';
import { EmojiPicker } from '../emoji-picker/emoji-picker';

/** Show the character counter once this few characters are left. */
const COUNTER_THRESHOLD = 200;
const MAX_HEIGHT_PX = 240;
const MAX_SUGGESTIONS = 8;

/** ":" then at least two name characters, at the start or after a space: ":thu". */
const EMOJI_TRIGGER = /(?:^|\s)(:([a-z0-9_+-]{2,}))$/;

/** One line of the autocomplete list. */
interface Suggestion {
  /** The emoji's key: unique in the list. */
  readonly id: string;
  /** What replaces the typed ":thu". */
  readonly insert: string;
  readonly label: string;
  readonly detail: string;
  readonly emoji: string | null;
  readonly image: string | null;
}

/** The ":thu" being typed: where it sits in the text, and what to search for. */
interface Trigger {
  readonly start: number;
  readonly end: number;
  readonly query: string;
}

/**
 * The message box. Enter sends, Shift+Enter adds a line; typing with an IME is left alone.
 * The emoji button opens the picker; typing ":thu" suggests emoji, as in Slack.
 */
@Component({
  selector: 'app-composer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, EmojiPicker],
  templateUrl: './composer.html',
  styleUrl: './composer.css',
})
export class Composer {
  private readonly customEmoji = inject(CustomEmojiService);
  private readonly recentEmoji = inject(RecentEmojiService);
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;

  readonly placeholder = input('');
  readonly send = output<string>();

  private readonly textarea = viewChild.required<ElementRef<HTMLTextAreaElement>>('textarea');

  protected readonly text = signal('');
  protected readonly left = computed(() => LIMITS.messageMaxLength - this.text().length);
  protected readonly showCounter = computed(() => this.left() < COUNTER_THRESHOLD);
  protected readonly canSend = computed(() => this.text().trim().length > 0 && this.left() >= 0);

  protected readonly pickerAnchor = signal<HTMLElement | null>(null);
  private readonly trigger = signal<Trigger | null>(null);
  /** Escape hides the list until the trigger moves. */
  private readonly dismissedAt = signal<number | null>(null);
  private readonly unicode = signal<readonly UnicodeEmoji[] | null>(null);
  protected readonly activeIndex = signal(0);

  protected readonly suggestions = computed<Suggestion[]>(() => {
    const trigger = this.trigger();
    if (!trigger || this.dismissedAt() === trigger.start) return [];
    const choices = searchEmoji(
      trigger.query,
      this.unicode() ?? [],
      this.customEmoji.catalog() ?? [],
      this.i18n.locale(),
      MAX_SUGGESTIONS,
    );
    return choices.map((choice) => ({
      id: choice.key,
      insert: choice.emoji ?? choice.key,
      label: choice.shortcode ? `:${choice.shortcode}:` : choice.label,
      detail: choice.emoji ? choice.label : '',
      emoji: choice.emoji,
      image: choice.image,
    }));
  });

  protected readonly activeOptionId = computed(() =>
    this.suggestions().length > 0 ? `composer-option-${this.activeIndex()}` : null,
  );

  protected onInput(value: string): void {
    this.text.set(value);
    this.resize();
    this.updateTrigger();
  }

  protected onKeydown(event: KeyboardEvent): void {
    const suggestions = this.suggestions();
    if (suggestions.length > 0) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        this.activeIndex.update(
          (index) => (index + step + suggestions.length) % suggestions.length,
        );
        return;
      }
      if ((event.key === 'Enter' || event.key === 'Tab') && !event.isComposing) {
        event.preventDefault();
        this.apply(suggestions[this.activeIndex()] ?? suggestions[0]);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        this.dismissedAt.set(this.trigger()?.start ?? null);
        return;
      }
    }
    // `isComposing` is true while an input method (e.g. Vietnamese Telex on macOS) builds a word.
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      this.submit();
    }
  }

  /** The caret moved without typing (a click, or arrow keys): the trigger may have changed. */
  protected onCaretMove(event?: KeyboardEvent): void {
    if (event && !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    this.updateTrigger();
  }

  protected apply(suggestion: Suggestion): void {
    const trigger = this.trigger();
    if (!trigger) return;
    this.replace(trigger.start, trigger.end, `${suggestion.insert} `);
    this.recentEmoji.use(suggestion.id);
  }

  protected togglePicker(anchor: HTMLElement): void {
    this.pickerAnchor.update((open) => (open === anchor ? null : anchor));
  }

  protected closePicker(): void {
    this.pickerAnchor.set(null);
    this.textarea().nativeElement.focus();
  }

  /** Inserts a picked emoji at the caret; a custom one is written as ":name:". */
  protected insertPicked(key: string): void {
    const element = this.textarea().nativeElement;
    const before = element.value.slice(0, element.selectionStart);
    const spacer = key.startsWith(':') && before !== '' && !/\s$/.test(before) ? ' ' : '';
    this.replace(element.selectionStart, element.selectionEnd, spacer + key);
    this.closePicker();
  }

  protected submit(): void {
    if (!this.canSend()) return;
    this.send.emit(this.text().trim());
    this.text.set('');
    this.trigger.set(null);
    const element = this.textarea().nativeElement;
    element.value = '';
    this.resize();
    element.focus();
  }

  private replace(start: number, end: number, insert: string): void {
    const element = this.textarea().nativeElement;
    element.setRangeText(insert, start, end, 'end');
    this.onInput(element.value);
    element.focus();
  }

  private updateTrigger(): void {
    const element = this.textarea().nativeElement;
    const caret = element.selectionStart;
    const match =
      caret === element.selectionEnd ? EMOJI_TRIGGER.exec(element.value.slice(0, caret)) : null;
    if (!match) {
      this.trigger.set(null);
      return;
    }
    const start = caret - match[1].length;
    if (this.trigger()?.start !== start) this.activeIndex.set(0);
    this.trigger.set({ start, end: caret, query: match[2] });
    this.loadEmojiData();
  }

  /** The tables load on the first ":thu": a message without one costs no read. */
  private loadEmojiData(): void {
    if (this.unicode() === null) {
      loadUnicodeEmoji().then(
        (list) => this.unicode.set(list),
        () => undefined,
      );
    }
    this.customEmoji.loadCatalog().catch(() => undefined);
  }

  private resize(): void {
    const element = this.textarea().nativeElement;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, MAX_HEIGHT_PX)}px`;
  }
}
