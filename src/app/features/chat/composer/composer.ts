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
import { I18nService } from '@core/i18n/i18n.service';
import { LIMITS } from '@core/limits';
import { Icon } from '@shared/ui/icon/icon';

/** Show the character counter once this few characters are left. */
const COUNTER_THRESHOLD = 200;
const MAX_HEIGHT_PX = 240;

/** The message box. Enter sends, Shift+Enter adds a line; typing with an IME is left alone. */
@Component({
  selector: 'app-composer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  templateUrl: './composer.html',
  styleUrl: './composer.css',
})
export class Composer {
  protected readonly t = inject(I18nService).t;

  readonly placeholder = input('');
  readonly send = output<string>();

  private readonly textarea = viewChild.required<ElementRef<HTMLTextAreaElement>>('textarea');

  protected readonly text = signal('');
  protected readonly left = computed(() => LIMITS.messageMaxLength - this.text().length);
  protected readonly showCounter = computed(() => this.left() < COUNTER_THRESHOLD);
  protected readonly canSend = computed(() => this.text().trim().length > 0 && this.left() >= 0);

  protected onInput(value: string): void {
    this.text.set(value);
    this.resize();
  }

  protected onKeydown(event: KeyboardEvent): void {
    // `isComposing` is true while an input method (e.g. Vietnamese Telex on macOS) builds a word.
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      this.submit();
    }
  }

  protected submit(): void {
    if (!this.canSend()) return;
    this.send.emit(this.text().trim());
    this.text.set('');
    const element = this.textarea().nativeElement;
    element.value = '';
    this.resize();
    element.focus();
  }

  private resize(): void {
    const element = this.textarea().nativeElement;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, MAX_HEIGHT_PX)}px`;
  }
}
