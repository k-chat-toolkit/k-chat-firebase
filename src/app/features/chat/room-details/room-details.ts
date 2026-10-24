import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { ProfileService } from '@core/data/profile.service';
import { RoomService } from '@core/data/room.service';
import { errorMessageKey } from '@core/errors/app-error';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/locales/en';
import { LIMITS } from '@core/limits';
import type { Room } from '@core/models/room';
import { Avatar } from '@shared/ui/avatar/avatar';
import { ConfirmService } from '@shared/ui/confirm-dialog/confirm.service';
import { Icon } from '@shared/ui/icon/icon';
import { nameValidators } from '@shared/utils/validators';

type Copied = 'code' | 'link' | null;

/** The right-hand panel: invite, members, and the owner's tools. */
@Component({
  selector: 'app-room-details',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, Avatar, Icon],
  templateUrl: './room-details.html',
  styleUrl: './room-details.css',
})
export class RoomDetails {
  private readonly auth = inject(AuthService);
  private readonly rooms = inject(RoomService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  protected readonly profiles = inject(ProfileService);
  protected readonly t = inject(I18nService).t;

  readonly room = input.required<Room>();
  readonly closed = output();

  protected readonly busy = signal(false);
  protected readonly copied = signal<Copied>(null);
  protected readonly deletedCount = signal<number | null>(null);
  protected readonly error = signal<TranslationKey | null>(null);
  protected readonly maxLength = LIMITS.roomNameMaxLength;
  protected readonly name = new FormControl('', {
    nonNullable: true,
    validators: nameValidators(LIMITS.roomNameMaxLength),
  });

  protected readonly uid = computed(() => this.auth.user()?.uid ?? '');
  protected readonly group = computed(() => {
    const room = this.room();
    return room.type === 'group' ? room : null;
  });
  protected readonly isOwner = computed(() => this.group()?.ownerId === this.uid());
  protected readonly inviteLink = computed(() => {
    const code = this.group()?.inviteCode;
    return code ? `${this.document.location.origin}/join/${code}` : '';
  });
  /** You first, then the owner, then everyone else in join order. */
  protected readonly members = computed(() => {
    const room = this.room();
    const owner = room.type === 'group' ? room.ownerId : null;
    const me = this.uid();
    return [...room.memberIds].sort((a, b) => rank(a, me, owner) - rank(b, me, owner));
  });

  constructor() {
    effect(() => {
      const current = this.group()?.name;
      if (current !== undefined && this.name.pristine) this.name.setValue(current);
    });
  }

  protected nameOf(uid: string): string {
    const profile = this.profiles.profile(uid)();
    if (profile === undefined) return '…';
    return profile?.displayName ?? this.t('chat.unknownUser');
  }

  protected async copy(what: 'code' | 'link'): Promise<void> {
    const group = this.group();
    if (!group) return;
    await navigator.clipboard.writeText(what === 'code' ? group.inviteCode : this.inviteLink());
    this.copied.set(what);
    setTimeout(() => this.copied.set(null), 2000);
  }

  protected async rename(): Promise<void> {
    const group = this.group();
    if (!group || this.name.invalid) return;
    await this.run(async () => {
      await this.rooms.renameGroup(group.id, this.name.value.trim());
      this.name.markAsPristine();
    });
  }

  protected async resetCode(): Promise<void> {
    const group = this.group();
    if (!group) return;
    const confirmed = await this.confirm.confirm({
      title: this.t('details.resetTitle'),
      body: this.t('details.resetBody'),
      confirmLabel: this.t('details.resetCode'),
    });
    if (confirmed) await this.run(() => this.rooms.resetInvite(group));
  }

  protected async removeMember(memberId: string): Promise<void> {
    const group = this.group();
    if (!group) return;
    const confirmed = await this.confirm.confirm({
      title: this.t('details.removeTitle', { name: this.nameOf(memberId) }),
      body: this.t('details.removeBody'),
      confirmLabel: this.t('details.remove'),
      danger: true,
    });
    if (confirmed) await this.run(() => this.rooms.removeMember(group.id, memberId));
  }

  protected async leave(): Promise<void> {
    const group = this.group();
    if (!group) return;
    const confirmed = await this.confirm.confirm({
      title: this.t('details.leaveTitle', { name: group.name }),
      body: this.t('details.leaveBody'),
      confirmLabel: this.t('details.leave'),
      danger: true,
    });
    if (!confirmed) return;
    await this.run(async () => {
      // Leave the page first, so its listeners stop before access ends.
      await this.router.navigateByUrl('/');
      await this.rooms.leaveGroup(group.id);
    });
  }

  protected async deleteRoom(): Promise<void> {
    const group = this.group();
    if (!group) return;
    const confirmed = await this.confirm.confirm({
      title: this.t('details.deleteTitle', { name: group.name }),
      body: this.t('details.deleteBody'),
      confirmLabel: this.t('details.deleteRoom'),
      danger: true,
    });
    if (!confirmed) return;
    await this.run(async () => {
      this.deletedCount.set(0);
      await this.rooms.deleteGroup(group, (count) => this.deletedCount.set(count));
      await this.router.navigateByUrl('/');
    });
    this.deletedCount.set(null);
  }

  private async run(action: () => Promise<unknown>): Promise<void> {
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
}

function rank(uid: string, me: string, owner: string | null): number {
  if (uid === me) return 0;
  if (uid === owner) return 1;
  return 2;
}
