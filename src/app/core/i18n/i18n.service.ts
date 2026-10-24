import { DOCUMENT } from '@angular/common';
import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { en, type TranslationKey, type Translations } from './locales/en';
import { vi } from './locales/vi';

export type Locale = 'en' | 'vi';

export const LOCALES: readonly Locale[] = ['en', 'vi'];

const TABLES: Record<Locale, Translations> = { en, vi };

const STORAGE_KEY = 'k-chat.locale';

export type TranslationParams = Readonly<Record<string, string | number>>;

/** Fills `{name}` placeholders. Unknown placeholders are left as they are. */
export function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/** The saved choice, else the browser's first language we support, else English. */
export function detectLocale(saved: string | null, browserLanguages: readonly string[]): Locale {
  if (saved && (LOCALES as readonly string[]).includes(saved)) return saved as Locale;
  for (const language of browserLanguages) {
    const base = language.toLowerCase().split('-')[0];
    if ((LOCALES as readonly string[]).includes(base)) return base as Locale;
  }
  return 'en';
}

function readSavedLocale(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Runtime translations: switching the language re-renders at once, with no reload.
 * Templates call `t('key')`; because `t` reads the `locale` signal, every view that
 * uses it updates when the locale changes.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly document = inject(DOCUMENT);

  readonly locale = signal<Locale>(
    detectLocale(readSavedLocale(), this.document.defaultView?.navigator.languages ?? []),
  );

  private readonly timeFormat = computed(
    () => new Intl.DateTimeFormat(this.locale(), { hour: 'numeric', minute: '2-digit' }),
  );
  private readonly dayFormat = computed(
    () =>
      new Intl.DateTimeFormat(this.locale(), { weekday: 'long', month: 'long', day: 'numeric' }),
  );
  private readonly fullDayFormat = computed(
    () => new Intl.DateTimeFormat(this.locale(), { dateStyle: 'full' }),
  );
  private readonly dateTimeFormat = computed(
    () => new Intl.DateTimeFormat(this.locale(), { dateStyle: 'medium', timeStyle: 'short' }),
  );
  private readonly listFormat = computed(
    () => new Intl.ListFormat(this.locale(), { type: 'conjunction' }),
  );

  constructor() {
    effect(() => {
      const locale = this.locale();
      this.document.documentElement.lang = locale;
      try {
        localStorage.setItem(STORAGE_KEY, locale);
      } catch {
        // Storage can be blocked (private mode); the choice then lasts for this visit only.
      }
    });
  }

  /**
   * Translates `key` in the current locale. Bound, so it can be handed to templates.
   * `{app}` is always available: the app's name, so renaming the app is one edit.
   */
  readonly t = (key: TranslationKey, params?: TranslationParams): string => {
    const table = TABLES[this.locale()];
    return interpolate(table[key], { app: table['app.name'], ...params });
  };

  setLocale(locale: Locale): void {
    this.locale.set(locale);
  }

  /** "9:41 AM" or "09:41", by locale. */
  formatTime(date: Date): string {
    return this.timeFormat().format(date);
  }

  /** "Today", "Yesterday", "Monday, October 20", or a full date in another year. */
  formatDay(date: Date, now = new Date()): string {
    const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
    if (days === 0) return this.t('chat.today');
    if (days === 1) return this.t('chat.yesterday');
    return date.getFullYear() === now.getFullYear()
      ? this.dayFormat().format(date)
      : this.fullDayFormat().format(date);
  }

  /** "Oct 24, 2026, 9:41 AM", for tooltips. */
  formatDateTime(date: Date): string {
    return this.dateTimeFormat().format(date);
  }

  /** "An, Bình, and Chi" or "An, Bình và Chi", by locale. */
  formatList(items: readonly string[]): string {
    return this.listFormat().format(items);
  }
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}
