import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { RoomService } from '@core/data/room.service';
import { errorMessageKey } from '@core/errors/app-error';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/locales/en';
import { LIMITS } from '@core/limits';
import { Icon } from '@shared/ui/icon/icon';
import { inviteCodeFromInput } from '@shared/utils/invite-code';

/** Join by typing a code, or by opening an invite link (/join/:code), which fills it in. */
@Component({
  selector: 'app-join-room-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, Icon],
  template: `
    <section class="page" aria-labelledby="join-title">
      <a class="btn btn-ghost btn-sm back" routerLink="/"
        ><app-icon name="back" [size]="16" />{{ t('common.back') }}</a
      >
      <h1 id="join-title">{{ t('joinRoom.title') }}</h1>
      @if (error(); as error) {
        <p class="alert alert-error" role="alert">{{ t(error, { length: codeLength }) }}</p>
      }
      <form (submit)="$event.preventDefault(); join()">
        <div class="field">
          <label for="invite-code">{{ t('joinRoom.code') }}</label>
          <input
            id="invite-code"
            class="input input-code"
            [formControl]="codeInput"
            placeholder="K7QM2XPA"
            autocomplete="off"
            autocapitalize="characters"
            spellcheck="false"
          />
          <span class="hint">{{ t('joinRoom.hint') }}</span>
        </div>
        <button type="submit" class="btn btn-primary" [disabled]="codeInput.invalid || busy()">
          {{ t('joinRoom.submit') }}
        </button>
      </form>
    </section>
  `,
  styles: `
    .back {
      margin: 0 0 12px -10px;
    }
    h1 {
      margin-bottom: 20px;
    }
  `,
})
export class JoinRoomPage {
  private readonly rooms = inject(RoomService);
  private readonly router = inject(Router);
  protected readonly t = inject(I18nService).t;

  /** From the route /join/:code. */
  readonly code = input<string>();

  protected readonly codeLength = LIMITS.inviteCodeLength;
  protected readonly busy = signal(false);
  protected readonly error = signal<TranslationKey | null>(null);
  protected readonly codeInput = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });

  constructor() {
    effect(() => {
      const code = this.code();
      if (code) this.codeInput.setValue(inviteCodeFromInput(code));
    });
  }

  protected async join(): Promise<void> {
    const code = inviteCodeFromInput(this.codeInput.value);
    this.busy.set(true);
    this.error.set(null);
    try {
      const roomId = await this.rooms.joinWithCode(code);
      await this.router.navigate(['/r', roomId]);
    } catch (error) {
      this.error.set(errorMessageKey(error));
    } finally {
      this.busy.set(false);
    }
  }
}
