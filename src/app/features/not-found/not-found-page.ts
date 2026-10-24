import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '@core/i18n/i18n.service';

@Component({
  selector: 'app-not-found-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <main class="centered">
      <section class="card">
        <h1>{{ t('notFound.title') }}</h1>
        <div class="actions">
          <a class="btn btn-primary" routerLink="/">{{ t('notFound.home') }}</a>
        </div>
      </section>
    </main>
  `,
})
export class NotFoundPage {
  protected readonly t = inject(I18nService).t;
}
