import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { Sidebar } from './sidebar/sidebar';

/**
 * The signed-in shell: the sidebar on the left, the open page on the right.
 * On a phone only one of the two shows: the sidebar on the home page, the page otherwise.
 */
@Component({
  selector: 'app-workspace-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, Sidebar],
  host: { '[class.at-home]': 'atHome()' },
  styles: `
    :host {
      display: grid;
      grid-template-columns: 260px minmax(0, 1fr);
      height: 100dvh;
      overflow: hidden;
    }
    main {
      min-width: 0;
      min-height: 0;
      overflow-y: auto;
      background: var(--surface);
    }
    @media (max-width: 767px) {
      :host {
        grid-template-columns: minmax(0, 1fr);
      }
      :host(.at-home) main,
      :host(:not(.at-home)) app-sidebar {
        display: none;
      }
    }
  `,
  template: `
    <app-sidebar />
    <main>
      <router-outlet />
    </main>
  `,
})
export class WorkspaceLayout {
  private readonly router = inject(Router);

  protected readonly atHome = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.isHome()),
    ),
    { initialValue: this.isHome() },
  );

  private isHome(): boolean {
    return this.router.url.split(/[?#]/)[0] === '/';
  }
}
