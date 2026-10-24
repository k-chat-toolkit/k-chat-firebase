import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { RoomService } from '@core/data/room.service';
import { errorMessageKey } from '@core/errors/app-error';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/locales/en';
import { LIMITS } from '@core/limits';
import { Icon } from '@shared/ui/icon/icon';
import { nameValidators } from '@shared/utils/validators';

@Component({
  selector: 'app-create-room-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, Icon],
  template: `
    <section class="page" aria-labelledby="create-title">
      <a class="btn btn-ghost btn-sm back" routerLink="/"
        ><app-icon name="back" [size]="16" />{{ t('common.back') }}</a
      >
      <h1 id="create-title">{{ t('createRoom.title') }}</h1>
      @if (error(); as error) {
        <p class="alert alert-error" role="alert">{{ t(error) }}</p>
      }
      <form (submit)="$event.preventDefault(); create()">
        <div class="field">
          <label for="room-name">{{ t('createRoom.name') }}</label>
          <input
            id="room-name"
            class="input"
            [formControl]="name"
            [maxlength]="maxLength"
            [placeholder]="t('createRoom.placeholder')"
            autocomplete="off"
          />
          <span class="hint">{{ t('createRoom.hint') }}</span>
        </div>
        <button type="submit" class="btn btn-primary" [disabled]="name.invalid || busy()">
          {{ t('createRoom.submit') }}
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
export class CreateRoomPage {
  private readonly rooms = inject(RoomService);
  private readonly router = inject(Router);
  protected readonly t = inject(I18nService).t;

  protected readonly maxLength = LIMITS.roomNameMaxLength;
  protected readonly busy = signal(false);
  protected readonly error = signal<TranslationKey | null>(null);
  protected readonly name = new FormControl('', {
    nonNullable: true,
    validators: nameValidators(LIMITS.roomNameMaxLength),
  });

  protected async create(): Promise<void> {
    if (this.name.invalid) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const roomId = await this.rooms.createGroup(this.name.value.trim());
      await this.router.navigate(['/r', roomId], { queryParams: { details: 1 } });
    } catch (error) {
      this.error.set(errorMessageKey(error));
    } finally {
      this.busy.set(false);
    }
  }
}
