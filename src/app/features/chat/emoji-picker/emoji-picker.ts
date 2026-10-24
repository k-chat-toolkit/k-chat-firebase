import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CustomEmojiService } from '@core/data/custom-emoji.service';
import { ProfileService } from '@core/data/profile.service';
import { RecentEmojiService } from '@core/data/recent-emoji.service';
import { I18nService } from '@core/i18n/i18n.service';
import type { TranslationKey } from '@core/i18n/locales/en';
import { customEmojiName } from '@core/models/custom-emoji';
import {
  customChoice,
  EMOJI_GROUPS,
  loadUnicodeEmoji,
  searchEmoji,
  unicodeChoice,
  type EmojiChoice,
  type EmojiGroup,
  type UnicodeEmoji,
} from '@shared/emoji/unicode-emoji';
import { Icon } from '@shared/ui/icon/icon';

interface Section {
  readonly id: string;
  readonly title: string;
  /** Shown on the section's tab. */
  readonly icon: string;
  readonly choices: readonly EmojiChoice[];
}

const GROUP_TITLES: Record<EmojiGroup, TranslationKey> = {
  0: 'emoji.group.smileys',
  1: 'emoji.group.people',
  3: 'emoji.group.nature',
  4: 'emoji.group.food',
  5: 'emoji.group.travel',
  6: 'emoji.group.activities',
  7: 'emoji.group.objects',
  8: 'emoji.group.symbols',
  9: 'emoji.group.flags',
};

const GROUP_ICONS: Record<EmojiGroup, string> = {
  0: '😀',
  1: '👋',
  3: '🐻',
  4: '🍔',
  5: '🚗',
  6: '⚽',
  7: '💡',
  8: '🔣',
  9: '🏁',
};

/** Matches the grid's CSS: arrow keys move by one cell, or by one row of this many. */
const COLUMNS = 9;
const MAX_RESULTS = 90;
const MARGIN_PX = 8;

/**
 * Slack's emoji picker: search, recent, custom, then every Unicode group. It floats
 * next to its `anchor` (a bottom sheet on a phone) and closes on Escape or a click
 * outside. The Unicode table loads on first open; custom emoji once per session.
 */
@Component({
  selector: 'app-emoji-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  host: {
    role: 'dialog',
    '[attr.aria-label]': "t('emoji.picker')",
    '[style.top.px]': 'position().top',
    '[style.left.px]': 'position().left',
    '(keydown.escape)': 'onEscape($event)',
  },
  templateUrl: './emoji-picker.html',
  styleUrl: './emoji-picker.css',
})
export class EmojiPicker {
  private readonly customEmoji = inject(CustomEmojiService);
  private readonly recentEmoji = inject(RecentEmojiService);
  private readonly profiles = inject(ProfileService);
  private readonly i18n = inject(I18nService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  protected readonly t = this.i18n.t;

  /** The button that opened the picker: the picker sits next to it. */
  readonly anchor = input.required<HTMLElement>();
  readonly picked = output<string>();
  readonly closed = output<void>();

  private readonly searchInput = viewChild.required<ElementRef<HTMLInputElement>>('search');
  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');

  protected readonly query = signal('');
  protected readonly hovered = signal<EmojiChoice | null>(null);
  protected readonly loadFailed = signal(false);
  protected readonly position = signal({ top: 0, left: 0 });
  private readonly unicode = signal<readonly UnicodeEmoji[] | null>(null);

  protected readonly loading = computed(() => this.unicode() === null && !this.loadFailed());

  private readonly groups = computed(() => {
    const byGroup = new Map<number, UnicodeEmoji[]>();
    for (const emoji of this.unicode() ?? []) {
      const list = byGroup.get(emoji.group);
      if (list) list.push(emoji);
      else byGroup.set(emoji.group, [emoji]);
    }
    return byGroup;
  });

  protected readonly sections = computed<Section[]>(() => {
    const locale = this.i18n.locale();
    const unicode = this.unicode() ?? [];
    const custom = this.customEmoji.catalog() ?? [];
    const query = this.query().trim();
    if (query) {
      return [
        {
          id: 'results',
          title: this.t('emoji.results'),
          icon: '',
          choices: searchEmoji(query, unicode, custom, locale, MAX_RESULTS),
        },
      ];
    }
    const sections: Section[] = [];
    const recent = this.recentChoices();
    if (recent.length > 0) {
      sections.push({ id: 'recent', title: this.t('emoji.recent'), icon: '🕘', choices: recent });
    }
    if (custom.length > 0) {
      sections.push({
        id: 'custom',
        title: this.t('emoji.custom'),
        icon: '⭐',
        choices: custom.map(customChoice),
      });
    }
    for (const group of EMOJI_GROUPS) {
      const list = this.groups().get(group);
      if (!list) continue;
      sections.push({
        id: `group-${group}`,
        title: this.t(GROUP_TITLES[group]),
        icon: GROUP_ICONS[group],
        choices: list.map((emoji) => unicodeChoice(emoji, locale)),
      });
    }
    return sections;
  });

  /** Every choice on screen by key, for the grid's delegated events. */
  private readonly byKey = computed(() => {
    const map = new Map<string, EmojiChoice>();
    for (const section of this.sections()) {
      for (const choice of section.choices) map.set(choice.key, choice);
    }
    return map;
  });

  /** The footer: the hovered emoji, else the first result of a search. */
  protected readonly preview = computed(() => {
    const hovered = this.hovered();
    if (hovered) return hovered;
    return this.query().trim() ? (this.sections()[0]?.choices[0] ?? null) : null;
  });

  protected readonly previewAddedBy = computed(() => {
    const uid = this.preview()?.createdBy;
    if (!uid) return null;
    const profile = this.profiles.profile(uid)();
    return profile === undefined ? '…' : (profile?.displayName ?? this.t('chat.unknownUser'));
  });

  constructor() {
    loadUnicodeEmoji().then(
      (list) => this.unicode.set(list),
      () => this.loadFailed.set(true),
    );
    // Without the list, the picker still offers every Unicode emoji.
    this.customEmoji.loadCatalog().catch(() => undefined);

    afterNextRender(() => {
      this.place();
      // On a touch screen, focusing would open the keyboard over the emoji.
      if (!this.document.defaultView?.matchMedia('(hover: none)').matches) {
        this.searchInput().nativeElement.focus();
      }
    });

    const view = this.document.defaultView;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (!this.host.nativeElement.contains(target) && !this.anchor().contains(target)) {
        this.closed.emit();
      }
    };
    const onResize = () => this.place();
    this.document.addEventListener('pointerdown', onPointerDown, true);
    view?.addEventListener('resize', onResize);
    inject(DestroyRef).onDestroy(() => {
      this.document.removeEventListener('pointerdown', onPointerDown, true);
      view?.removeEventListener('resize', onResize);
    });
  }

  protected onSearch(value: string): void {
    this.query.set(value);
    this.hovered.set(null);
    this.scroller().nativeElement.scrollTop = 0;
  }

  protected onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.isComposing) {
      event.preventDefault();
      const first = this.sections()[0]?.choices[0];
      if (first) this.pick(first);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.cells()[0]?.focus();
    }
  }

  protected showSection(id: string): void {
    const section = this.scroller().nativeElement.querySelector(`[data-section="${id}"]`);
    section?.scrollIntoView({ block: 'start' });
  }

  /** One listener for the whole grid instead of three per emoji. */
  protected onGridClick(event: Event): void {
    const choice = this.choiceAt(event.target);
    if (choice) this.pick(choice);
  }

  protected onGridHover(event: Event): void {
    const choice = this.choiceAt(event.target);
    if (choice) this.hovered.set(choice);
  }

  protected onGridKeydown(event: KeyboardEvent): void {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -COLUMNS, ArrowDown: COLUMNS }[event.key];
    if (step === undefined) return;
    const cells = this.cells();
    const index = cells.indexOf(event.target as HTMLButtonElement);
    if (index === -1) return;
    event.preventDefault();
    const next = index + step;
    if (next < 0) this.searchInput().nativeElement.focus();
    else cells[Math.min(next, cells.length - 1)]?.focus();
  }

  protected onEscape(event: Event): void {
    event.stopPropagation();
    this.closed.emit();
  }

  private pick(choice: EmojiChoice): void {
    this.recentEmoji.use(choice.key);
    this.picked.emit(choice.key);
  }

  private choiceAt(target: EventTarget | null): EmojiChoice | undefined {
    const cell = (target as HTMLElement | null)?.closest<HTMLElement>('[data-key]');
    return cell ? this.byKey().get(cell.dataset['key'] ?? '') : undefined;
  }

  private cells(): HTMLButtonElement[] {
    return [...this.scroller().nativeElement.querySelectorAll<HTMLButtonElement>('[data-key]')];
  }

  /** Recent keys still valid: a custom emoji may have been deleted since. */
  private recentChoices(): EmojiChoice[] {
    const unicode = new Map((this.unicode() ?? []).map((emoji) => [emoji.emoji, emoji]));
    const custom = new Map((this.customEmoji.catalog() ?? []).map((emoji) => [emoji.name, emoji]));
    const locale = this.i18n.locale();
    const choices: EmojiChoice[] = [];
    for (const key of this.recentEmoji.recent()) {
      const name = customEmojiName(key);
      const customEmoji = name ? custom.get(name) : undefined;
      const unicodeEmoji = name ? undefined : unicode.get(key);
      if (customEmoji) choices.push(customChoice(customEmoji));
      else if (unicodeEmoji) choices.push(unicodeChoice(unicodeEmoji, locale));
    }
    return choices;
  }

  /**
   * Above the anchor when there is room, else below. Its left edge lines up with the
   * anchor's, unless that runs off the window: then its right edge does.
   */
  private place(): void {
    const view = this.document.defaultView;
    if (!view) return;
    const anchor = this.anchor().getBoundingClientRect();
    const { offsetWidth: width, offsetHeight: height } = this.host.nativeElement;
    let top = anchor.top - height - MARGIN_PX;
    if (top < MARGIN_PX) {
      top = Math.min(anchor.bottom + MARGIN_PX, view.innerHeight - height - MARGIN_PX);
    }
    let left = anchor.left;
    if (left + width > view.innerWidth - MARGIN_PX) left = anchor.right - width;
    left = Math.min(left, view.innerWidth - width - MARGIN_PX);
    this.position.set({ top: Math.max(top, MARGIN_PX), left: Math.max(left, MARGIN_PX) });
  }
}
