import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterOutlet,
} from '@angular/router';
import { filter, map } from 'rxjs';
import { I18nService } from '@core/i18n/i18n.service';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, ConfirmDialog],
  styles: `
    .progress {
      position: fixed;
      inset: 0 0 auto;
      z-index: 20;
      height: 3px;
      overflow: hidden;
    }
    .progress::after {
      content: '';
      display: block;
      width: 40%;
      height: 100%;
      background: var(--sidebar-active-bg);
      animation: slide 1s ease-in-out infinite;
    }
    @keyframes slide {
      from {
        transform: translateX(-100%);
      }
      to {
        transform: translateX(250%);
      }
    }
    .boot {
      display: grid;
      place-items: center;
      height: 100dvh;
      color: var(--text-muted);
    }
  `,
  template: `
    @if (navigating()) {
      <div class="progress" role="progressbar" [attr.aria-label]="t('common.loading')"></div>
    }
    @if (!started()) {
      <p class="boot">{{ t('common.loading') }}</p>
    }
    <router-outlet />
    <app-confirm-dialog />
  `,
})
export class App {
  private readonly router = inject(Router);
  protected readonly t = inject(I18nService).t;

  private readonly navigationEvents = this.router.events.pipe(
    filter(
      (event) =>
        event instanceof NavigationStart ||
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError,
    ),
  );

  /** A navigation is running, e.g. a guard is waiting for the session or the profile. */
  protected readonly navigating = toSignal(
    this.navigationEvents.pipe(map((event) => event instanceof NavigationStart)),
    { initialValue: true },
  );

  /** The first page has rendered; until then the screen would otherwise be blank. */
  protected readonly started = toSignal(
    this.navigationEvents.pipe(
      filter((event) => !(event instanceof NavigationStart)),
      map(() => true),
    ),
    { initialValue: false },
  );
}
