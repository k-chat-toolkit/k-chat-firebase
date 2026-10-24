import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '@core/i18n/i18n.service';
import { Icon } from '@shared/ui/icon/icon';

/** What the content pane shows before a room is picked. */
@Component({
  selector: 'app-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  styles: `
    :host {
      display: grid;
      place-items: center;
      height: 100%;
      padding: 24px;
      text-align: center;
    }
    .badge {
      display: inline-grid;
      place-items: center;
      width: 64px;
      height: 64px;
      margin-bottom: 16px;
      border-radius: 16px;
      background: var(--surface-muted);
      color: var(--text-muted);
    }
    h1 {
      font-size: 22px;
    }
    p {
      max-width: 380px;
      margin: 8px auto 20px;
    }
    .actions {
      justify-content: center;
    }
  `,
  template: `
    <div>
      <span class="badge"><app-icon name="message" [size]="32" /></span>
      <h1>{{ t('home.title') }}</h1>
      <p class="muted">{{ t('home.body') }}</p>
      <div class="actions">
        <a class="btn btn-primary" routerLink="/new">{{ t('sidebar.createRoom') }}</a>
        <a class="btn" routerLink="/join">{{ t('sidebar.joinRoom') }}</a>
      </div>
    </div>
  `,
})
export class HomePage {
  protected readonly t = inject(I18nService).t;
}
