import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { RoomService } from '@core/data/room.service';
import { errorMessageKey } from '@core/errors/app-error';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/locales/en';

/** /dm/:userId opens, or creates, the 1-to-1 room with that user, then shows it. */
@Component({
  selector: 'app-open-direct-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <section class="page">
      @if (error(); as error) {
        <p class="alert alert-error" role="alert">{{ t(error) }}</p>
        <a class="btn" routerLink="/">{{ t('common.back') }}</a>
      } @else {
        <p class="muted" role="status">{{ t('direct.opening') }}</p>
      }
    </section>
  `,
})
export class OpenDirectPage {
  private readonly rooms = inject(RoomService);
  private readonly router = inject(Router);
  protected readonly t = inject(I18nService).t;

  readonly userId = input.required<string>();

  protected readonly error = signal<TranslationKey | null>(null);

  constructor() {
    effect(() => {
      const userId = this.userId();
      this.error.set(null);
      this.rooms.openDirect(userId).then(
        (roomId) => this.router.navigate(['/r', roomId], { replaceUrl: true }),
        (error: unknown) => this.error.set(errorMessageKey(error)),
      );
    });
  }
}
