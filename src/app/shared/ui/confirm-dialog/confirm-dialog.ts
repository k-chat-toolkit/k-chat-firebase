import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { I18nService } from '@core/i18n/i18n.service';
import { ConfirmService } from './confirm.service';

/**
 * The modal behind ConfirmService. Mounted once, in the root component.
 * Each button answers directly; Escape (the dialog's `cancel` event) answers "no".
 */
@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './confirm-dialog.css',
  template: `
    <dialog #dialog aria-labelledby="confirm-title" (cancel)="answer($event, false)">
      @if (confirm.pending(); as question) {
        <h2 id="confirm-title">{{ question.title }}</h2>
        <p>{{ question.body }}</p>
        <div class="buttons">
          <button type="button" class="btn" autofocus (click)="answer($event, false)">
            {{ t('common.cancel') }}
          </button>
          <button
            type="button"
            class="btn"
            [class.btn-danger]="question.danger"
            [class.btn-primary]="!question.danger"
            (click)="answer($event, true)"
          >
            {{ question.confirmLabel }}
          </button>
        </div>
      }
    </dialog>
  `,
})
export class ConfirmDialog {
  protected readonly confirm = inject(ConfirmService);
  protected readonly t = inject(I18nService).t;
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    // The service owns the state; the element follows it.
    effect(() => {
      const element = this.dialog().nativeElement;
      const open = this.confirm.pending() !== null;
      if (open && !element.open) element.showModal();
      if (!open && element.open) element.close();
    });
  }

  protected answer(event: Event, confirmed: boolean): void {
    event.preventDefault();
    this.confirm.answer(confirmed);
  }
}
