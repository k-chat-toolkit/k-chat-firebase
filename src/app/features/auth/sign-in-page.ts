import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from '@env/environment';
import { safeRedirect } from '@core/auth/auth.guards';
import { AuthService } from '@core/auth/auth.service';
import { errorMessageKey } from '@core/errors/app-error';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/locales/en';
import { LanguageSwitcher } from '@shared/ui/language-switcher/language-switcher';

type Mode = 'sign-in' | 'sign-up' | 'reset';

/** Email and password, or Google. One page for signing in, signing up and resetting a password. */
@Component({
  selector: 'app-sign-in-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, LanguageSwitcher],
  templateUrl: './sign-in-page.html',
  styleUrl: './sign-in-page.css',
})
export class SignInPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly t = inject(I18nService).t;

  protected readonly usingEmulators = environment.emulators !== undefined;
  protected readonly mode = signal<Mode>('sign-in');
  protected readonly busy = signal(false);
  protected readonly error = signal<TranslationKey | null>(null);
  protected readonly resetSentTo = signal<string | null>(null);

  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected switchMode(mode: Mode): void {
    this.mode.set(mode);
    this.error.set(null);
    this.resetSentTo.set(null);
  }

  protected async submit(): Promise<void> {
    const { email, password } = this.form.getRawValue();
    const mode = this.mode();
    const emailControl = this.form.controls.email;
    if (emailControl.invalid || (mode !== 'reset' && this.form.controls.password.invalid)) {
      this.form.markAllAsTouched();
      this.error.set(emailControl.invalid ? 'errors.invalidEmail' : 'errors.weakPassword');
      return;
    }
    await this.run(async () => {
      if (mode === 'reset') {
        await this.auth.sendPasswordReset(email);
        this.resetSentTo.set(email.trim());
        return;
      }
      if (mode === 'sign-up') await this.auth.signUp(email, password);
      else await this.auth.signIn(email, password);
      await this.continue();
    });
  }

  protected async signInWithGoogle(): Promise<void> {
    await this.run(async () => {
      await this.auth.signInWithGoogle();
      await this.continue();
    });
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await action();
    } catch (error) {
      this.error.set(errorMessageKey(error));
    } finally {
      this.busy.set(false);
    }
  }

  private async continue(): Promise<void> {
    await this.router.navigateByUrl(
      safeRedirect(this.route.snapshot.queryParamMap.get('redirect')),
    );
  }
}
