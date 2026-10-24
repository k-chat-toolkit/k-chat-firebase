import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { safeRedirect } from '@core/auth/auth.guards';
import { AuthService } from '@core/auth/auth.service';
import { ProfileService } from '@core/data/profile.service';
import { errorMessageKey } from '@core/errors/app-error';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/locales/en';
import { LIMITS } from '@core/limits';
import { LanguageSwitcher } from '@shared/ui/language-switcher/language-switcher';
import { nameValidators } from '@shared/utils/validators';

/** First sign-in: pick the display name others will see. */
@Component({
  selector: 'app-welcome-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, LanguageSwitcher],
  styles: `
    .centered {
      align-content: center;
      gap: 24px;
    }
    p {
      margin: 0 0 20px;
    }
  `,
  template: `
    <main class="centered">
      <section class="card" aria-labelledby="welcome-title">
        <h1 id="welcome-title">{{ t('welcome.title') }}</h1>
        <p class="muted">{{ t('welcome.body') }}</p>
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
          <button
            type="submit"
            class="btn btn-primary btn-block"
            [disabled]="name.invalid || busy()"
          >
            {{ t('welcome.submit') }}
          </button>
        </form>
        <div class="actions">
          <button type="button" class="btn btn-ghost btn-sm" (click)="useAnotherAccount()">
            {{ t('welcome.otherAccount') }}
          </button>
        </div>
      </section>
      <app-language-switcher />
    </main>
  `,
})
export class WelcomePage {
  private readonly auth = inject(AuthService);
  private readonly profiles = inject(ProfileService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly t = inject(I18nService).t;

  protected readonly maxLength = LIMITS.displayNameMaxLength;
  protected readonly busy = signal(false);
  protected readonly error = signal<TranslationKey | null>(null);

  /** Google accounts come with a name; start from it. */
  protected readonly name = new FormControl(
    (this.auth.user()?.displayName ?? '').trim().slice(0, LIMITS.displayNameMaxLength),
    { nonNullable: true, validators: nameValidators(LIMITS.displayNameMaxLength) },
  );

  protected async save(): Promise<void> {
    if (this.name.invalid) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.profiles.saveMyDisplayName(this.name.value.trim());
      await this.router.navigateByUrl(
        safeRedirect(this.route.snapshot.queryParamMap.get('redirect')),
      );
    } catch (error) {
      this.error.set(errorMessageKey(error));
    } finally {
      this.busy.set(false);
    }
  }

  protected async useAnotherAccount(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/sign-in');
  }
}
