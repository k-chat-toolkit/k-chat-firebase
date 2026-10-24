import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { CustomEmojiService } from '@core/data/custom-emoji.service';
import { ProfileService } from '@core/data/profile.service';
import { errorMessageKey } from '@core/errors/app-error';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/locales/en';
import { LIMITS } from '@core/limits';
import { EMOJI_NAME, suggestEmojiName, type CustomEmoji } from '@core/models/custom-emoji';
import { foldText, loadUnicodeEmoji } from '@shared/emoji/unicode-emoji';
import { ConfirmService } from '@shared/ui/confirm-dialog/confirm.service';
import { Icon } from '@shared/ui/icon/icon';
import {
  EMOJI_IMAGE_TYPES,
  EMOJI_SIZE_PX,
  prepareEmojiImage,
  type PreparedEmojiImage,
} from '@shared/utils/emoji-image';

type NameProblem = 'emoji.nameInvalid' | 'emoji.nameTaken' | 'emoji.nameStandard';

/**
 * The app's custom emoji: add one from an image, see who added each one, and
 * delete your own (an admin may delete any).
 */
@Component({
  selector: 'app-emoji-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  templateUrl: './emoji-page.html',
  styleUrl: './emoji-page.css',
})
export class EmojiPage {
  private readonly auth = inject(AuthService);
  private readonly customEmoji = inject(CustomEmojiService);
  private readonly profiles = inject(ProfileService);
  private readonly confirm = inject(ConfirmService);
  private readonly title = inject(Title);
  protected readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;

  protected readonly max = LIMITS.customEmojiMax;
  protected readonly nameMax = LIMITS.emojiNameMaxLength;
  protected readonly sizePx = EMOJI_SIZE_PX;
  protected readonly accept = EMOJI_IMAGE_TYPES.join(',');

  protected readonly catalog = this.customEmoji.catalog;
  protected readonly isAdmin = this.customEmoji.isAdmin;
  protected readonly listError = signal<TranslationKey | null>(null);

  protected readonly image = signal<PreparedEmojiImage | null>(null);
  protected readonly imageError = signal<TranslationKey | null>(null);
  protected readonly preparing = signal(false);
  protected readonly name = signal('');
  protected readonly saving = signal(false);
  protected readonly saveError = signal<TranslationKey | null>(null);
  protected readonly added = signal<string | null>(null);
  protected readonly filter = signal('');
  /** Slack refuses custom names that a standard emoji already uses; so does this page. */
  private readonly standardNames = signal<ReadonlySet<string>>(new Set());
  private nameTouched = false;

  protected readonly full = computed(() => (this.catalog()?.length ?? 0) >= this.max);

  protected readonly nameProblem = computed<NameProblem | null>(() => {
    const name = this.name();
    if (!name) return null;
    if (!EMOJI_NAME.test(name)) return 'emoji.nameInvalid';
    if (this.catalog()?.some((emoji) => emoji.name === name)) return 'emoji.nameTaken';
    if (this.standardNames().has(name)) return 'emoji.nameStandard';
    return null;
  });

  protected readonly canSave = computed(
    () =>
      this.image() !== null &&
      this.name() !== '' &&
      this.nameProblem() === null &&
      !this.saving() &&
      !this.full(),
  );

  protected readonly shown = computed(() => {
    const words = foldText(this.filter()).trim();
    const list = this.catalog() ?? [];
    return words ? list.filter((emoji) => emoji.name.includes(words)) : list;
  });

  constructor() {
    this.customEmoji
      .loadCatalog()
      .catch((error: unknown) => this.listError.set(errorMessageKey(error)));
    this.customEmoji.checkAdmin().catch(() => undefined);
    loadUnicodeEmoji().then(
      (list) => this.standardNames.set(new Set(list.flatMap((emoji) => emoji.shortcodes))),
      () => undefined,
    );

    effect(() => this.title.setTitle(`${this.t('emoji.title')} · ${this.t('app.name')}`));
    inject(DestroyRef).onDestroy(() => this.title.setTitle(this.t('app.name')));
  }

  protected async onFile(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    if (!file) return;
    this.imageError.set(null);
    this.saveError.set(null);
    this.added.set(null);
    this.preparing.set(true);
    try {
      this.image.set(await prepareEmojiImage(file, LIMITS.emojiImageMaxLength));
      if (!this.nameTouched || !this.name()) this.name.set(suggestEmojiName(file.name));
    } catch (error) {
      this.image.set(null);
      this.imageError.set(errorMessageKey(error));
    } finally {
      this.preparing.set(false);
      // Picking the same file again must fire `change` again.
      input.value = '';
    }
  }

  protected onName(value: string): void {
    this.nameTouched = true;
    this.added.set(null);
    this.name.set(value.trim().toLowerCase());
  }

  protected async save(): Promise<void> {
    const image = this.image();
    if (!image || !this.canSave()) return;
    const name = this.name();
    this.saving.set(true);
    this.saveError.set(null);
    try {
      await this.customEmoji.add(name, image.dataUrl);
      this.added.set(name);
      this.image.set(null);
      this.name.set('');
      this.nameTouched = false;
    } catch (error) {
      this.saveError.set(errorMessageKey(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected canDelete(emoji: CustomEmoji): boolean {
    return emoji.createdBy === this.auth.user()?.uid || this.isAdmin();
  }

  protected async remove(emoji: CustomEmoji): Promise<void> {
    const confirmed = await this.confirm.confirm({
      title: this.t('emoji.deleteTitle', { name: emoji.name }),
      body: this.t('emoji.deleteBody', { name: emoji.name }),
      confirmLabel: this.t('common.delete'),
      danger: true,
    });
    if (!confirmed) return;
    this.listError.set(null);
    try {
      await this.customEmoji.remove(emoji);
    } catch (error) {
      this.listError.set(errorMessageKey(error));
    }
  }

  /** "Added by An · Oct 24, 2026, 9:41 PM". */
  protected addedBy(emoji: CustomEmoji): string {
    const profile = this.profiles.profile(emoji.createdBy)();
    const name = profile === undefined ? '…' : (profile?.displayName ?? this.t('chat.unknownUser'));
    const date = emoji.createdAt ? this.i18n.formatDateTime(emoji.createdAt.toDate()) : '';
    return this.t('emoji.addedBy', { name, date });
  }
}
