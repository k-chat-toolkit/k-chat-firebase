import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { ProfileService } from '@core/data/profile.service';
import { errorMessageKey } from '@core/errors/app-error';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/locales/en';
import { LIMITS } from '@core/limits';
import {
  NotificationService,
  type NotificationLevel,
} from '@core/notifications/notification.service';
import { Avatar } from '@shared/ui/avatar/avatar';
import { Icon } from '@shared/ui/icon/icon';
import { LanguageSwitcher } from '@shared/ui/language-switcher/language-switcher';
import { nameValidators } from '@shared/utils/validators';

@Component({
  selector: 'app-profile-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, Avatar, Icon, LanguageSwitcher],
  template: `
    <section class="page" aria-labelledby="profile-title">
      <a class="btn btn-ghost btn-sm back" routerLink="/"
        ><app-icon name="back" [size]="16" />{{ t('common.back') }}</a
      >
      <div class="identity">
        <app-avatar [uid]="uid()" [name]="profiles.me()?.displayName" [size]="56" />
        <div>
          <h1 id="profile-title">{{ profiles.me()?.displayName }}</h1>
          @if (email(); as email) {
            <p class="muted">{{ t('profile.signedInAs', { email }) }}</p>
          }
        </div>
      </div>

      @if (error(); as error) {
        <p class="alert alert-error" role="alert">{{ t(error) }}</p>
      }
      <form (submit)="$event.preventDefault(); save()">
        <div class="field">
          <label for="display-name">{{ t('profile.displayName') }}</label>
          <input
            id="display-name"
            class="input"
            [formControl]="name"
            [maxlength]="maxLength"
            autocomplete="nickname"
          />
        </div>
        <div class="actions">
          <button
            type="submit"
            class="btn btn-primary"
            [disabled]="name.invalid || name.pristine || busy()"
          >
            {{ t('common.save') }}
          </button>
          @if (saved()) {
            <span class="muted saved" role="status">{{ t('profile.saved') }}</span>
          }
        </div>
      </form>

      <h2>{{ t('common.language') }}</h2>
      <app-language-switcher />

      <fieldset class="notifications">
        <legend>{{ t('profile.notifications') }}</legend>
        <p class="hint">{{ t('profile.notificationsBody') }}</p>
        @if (notifications.permission() === 'unsupported') {
          <p class="alert alert-info">{{ t('profile.notifyUnsupported') }}</p>
        } @else {
          @for (option of levels; track option.level) {
            <label class="choice">
              <input
                type="radio"
                name="notification-level"
                [value]="option.level"
                [checked]="notifications.level() === option.level"
                (change)="setLevel(option.level)"
              />
              {{ t(option.label) }}
            </label>
          }
          @if (notifications.permission() === 'denied' && notifications.level() !== 'off') {
            <p class="alert alert-error" role="alert">{{ t('profile.notifyDenied') }}</p>
          }
        }
      </fieldset>

      <h2 class="visually-hidden">{{ t('profile.signOut') }}</h2>
      <div class="actions sign-out">
        <button type="button" class="btn" (click)="signOut()">
          <app-icon name="signOut" [size]="16" />{{ t('profile.signOut') }}
        </button>
      </div>
    </section>
  `,
  styles: `
    .back {
      margin: 0 0 12px -10px;
    }
    .identity {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
    }
    .identity p {
      margin: 4px 0 0;
    }
    h2 {
      margin: 32px 0 12px;
      font-size: 16px;
    }
    .saved {
      align-self: center;
    }
    .notifications {
      margin: 32px 0 0;
      padding: 0;
      border: 0;
    }
    .notifications legend {
      margin-bottom: 4px;
      padding: 0;
      font-size: 16px;
      font-weight: 700;
    }
    .notifications .hint {
      margin: 0 0 12px;
    }
    .choice {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      cursor: pointer;
    }
    .notifications .alert {
      margin: 8px 0 0;
    }
    .sign-out {
      margin-top: 40px;
    }
  `,
})
export class ProfilePage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly profiles = inject(ProfileService);
  protected readonly notifications = inject(NotificationService);
  protected readonly t = inject(I18nService).t;

  protected readonly maxLength = LIMITS.displayNameMaxLength;
  protected readonly levels: readonly { level: NotificationLevel; label: TranslationKey }[] = [
    { level: 'off', label: 'profile.notifyOff' },
    { level: 'mentions', label: 'profile.notifyMentions' },
    { level: 'all', label: 'profile.notifyAll' },
  ];
  protected readonly busy = signal(false);
  protected readonly saved = signal(false);
  protected readonly error = signal<TranslationKey | null>(null);
  protected readonly name = new FormControl('', {
    nonNullable: true,
    validators: nameValidators(LIMITS.displayNameMaxLength),
  });

  constructor() {
    // Show the stored name until the user starts typing.
    effect(() => {
      const current = this.profiles.me()?.displayName;
      if (current !== undefined && this.name.pristine) this.name.setValue(current);
    });
  }

  protected uid(): string {
    return this.auth.user()?.uid ?? '';
  }

  protected email(): string | null {
    return this.auth.user()?.email ?? null;
  }

  protected async save(): Promise<void> {
    if (this.name.invalid) return;
    this.busy.set(true);
    this.saved.set(false);
    this.error.set(null);
    try {
      await this.profiles.saveMyDisplayName(this.name.value.trim());
      this.name.markAsPristine();
      this.saved.set(true);
    } catch (error) {
      this.error.set(errorMessageKey(error));
    } finally {
      this.busy.set(false);
    }
  }

  protected setLevel(level: NotificationLevel): void {
    void this.notifications.setLevel(level);
  }

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/sign-in');
  }
}
