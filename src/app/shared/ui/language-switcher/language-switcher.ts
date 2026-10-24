import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { I18nService, LOCALES } from '@core/i18n/i18n.service';
import { Icon } from '@shared/ui/icon/icon';

/** EN | VI toggle. `tone="dark"` fits the sidebar. */
@Component({
  selector: 'app-language-switcher',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  host: { '[class.dark]': 'tone() === "dark"' },
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--text-muted);
    }
    :host(.dark) {
      color: var(--sidebar-text);
    }
    .options {
      display: inline-flex;
      padding: 2px;
      border: 1px solid currentColor;
      border-radius: 6px;
    }
    button {
      padding: 1px 8px;
      border: 0;
      border-radius: 4px;
      background: transparent;
      color: inherit;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
    button[aria-pressed='true'] {
      background: currentColor;
    }
    button[aria-pressed='true'] span {
      color: var(--surface);
    }
    :host(.dark) button[aria-pressed='true'] span {
      color: var(--sidebar-bg);
    }
  `,
  template: `
    <app-icon name="globe" [size]="16" />
    <div class="options" role="group" [attr.aria-label]="i18n.t('common.language')">
      @for (locale of locales; track locale) {
        <button
          type="button"
          [attr.aria-pressed]="i18n.locale() === locale"
          [attr.lang]="locale"
          [attr.title]="i18n.t(locale === 'en' ? 'locale.en' : 'locale.vi')"
          (click)="i18n.setLocale(locale)"
        >
          <span>{{ locale.toUpperCase() }}</span>
        </button>
      }
    </div>
  `,
})
export class LanguageSwitcher {
  readonly tone = input<'light' | 'dark'>('light');

  protected readonly i18n = inject(I18nService);
  protected readonly locales = LOCALES;
}
