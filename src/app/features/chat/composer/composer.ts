import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { BACKEND_CAPABILITIES } from '@core/backend/backend-capabilities';
import { CustomEmojiService } from '@core/data/custom-emoji.service';
import { ProfileService } from '@core/data/profile.service';
import { RecentEmojiService } from '@core/data/recent-emoji.service';
import { I18nService } from '@core/i18n/i18n.service';
import { LIMITS } from '@core/limits';
import {
  foldText,
  loadUnicodeEmoji,
  searchEmoji,
  type UnicodeEmoji,
} from '@shared/emoji/unicode-emoji';
import { Avatar } from '@shared/ui/avatar/avatar';
import { Icon } from '@shared/ui/icon/icon';
import { applyFormat, type FormatKind } from '@shared/utils/composer-format';
import { encodeMentions, type MentionCandidate } from '@shared/utils/mentions';
import { EmojiPicker } from '../emoji-picker/emoji-picker';

/** Show the character counter once this few characters are left. */
const COUNTER_THRESHOLD = 200;
const MAX_HEIGHT_PX = 240;
const MAX_SUGGESTIONS = 8;

/** ":" then at least two name characters, at the start or after a space: ":thu". */
const EMOJI_TRIGGER = /(?:^|\s)(:([a-z0-9_+-]{2,}))$/;
/** "@" then the start of a name, which may hold spaces: "@An Ng". */
const MENTION_TRIGGER = /(?:^|[\s([{"'])(@([\p{L}\p{N}_.' -]{0,30}))$/u;

/** The message being replied to, as the bar above the box shows it. */
export interface ReplyPreview {
  readonly name: string;
  readonly text: string;
}

/** One line of the autocomplete list: an emoji, or a member to mention. */
interface Suggestion {
  /** The emoji's key, or the member's uid: unique in the list. */
  readonly id: string;
  /** What replaces the typed ":thu" or "@An". */
  readonly insert: string;
  readonly label: string;
  readonly detail: string;
  readonly emoji: string | null;
  readonly image: string | null;
  /** Set for a member: their avatar is shown. */
  readonly uid: string | null;
}

/** The ":thu" or "@An" being typed: where it sits in the text, and what to search for. */
interface Trigger {
  readonly kind: 'emoji' | 'mention';
  readonly start: number;
  readonly end: number;
  readonly query: string;
}

/**
 * The message box. Enter sends, Shift+Enter adds a line; typing with an IME is left alone.
 * The emoji button opens the picker; ":thu" suggests emoji and "@An" suggests members,
 * as in Slack. A mention is stored as "<@uid>" but shown as "@Name" while typing.
 */
@Component({
  selector: 'app-composer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, Icon, EmojiPicker],
  templateUrl: './composer.html',
  styleUrl: './composer.css',
})
export class Composer {
  private readonly auth = inject(AuthService);
  private readonly customEmoji = inject(CustomEmojiService);
  private readonly profiles = inject(ProfileService);
  private readonly recentEmoji = inject(RecentEmojiService);
  private readonly i18n = inject(I18nService);
  protected readonly capabilities = inject(BACKEND_CAPABILITIES);
  protected readonly t = this.i18n.t;

  readonly placeholder = input('');
  /** The room's members, offered after "@". */
  readonly memberIds = input<readonly string[]>([]);
  readonly replyTo = input<ReplyPreview | null>(null);
  readonly send = output<string>();
  readonly cancelReply = output<void>();
  /** ArrowUp in an empty box: edit your last message. */
  readonly editLast = output<void>();

  private readonly textarea = viewChild.required<ElementRef<HTMLTextAreaElement>>('textarea');

  protected readonly text = signal('');
  /** People picked from the list for this draft: they win over namesakes when encoding. */
  private readonly picked = signal<readonly MentionCandidate[]>([]);

  /** The text as it will be stored, with "<@uid>" tokens. */
  private readonly encoded = computed(() =>
    encodeMentions(this.text().trim(), [...this.picked(), ...this.knownMembers()]),
  );
  protected readonly left = computed(() => LIMITS.messageMaxLength - this.encoded().length);
  protected readonly showCounter = computed(() => this.left() < COUNTER_THRESHOLD);
  protected readonly canSend = computed(() => this.encoded().length > 0 && this.left() >= 0);

  protected readonly pickerAnchor = signal<HTMLElement | null>(null);
  private readonly trigger = signal<Trigger | null>(null);
  /** Escape hides the list until the trigger moves. */
  private readonly dismissedAt = signal<number | null>(null);
  private readonly unicode = signal<readonly UnicodeEmoji[] | null>(null);
  protected readonly activeIndex = signal(0);

  protected readonly suggestions = computed<Suggestion[]>(() => {
    const trigger = this.trigger();
    if (!trigger || this.dismissedAt() === trigger.start) return [];
    return trigger.kind === 'emoji'
      ? this.emojiSuggestions(trigger.query)
      : this.memberSuggestions(trigger.query);
  });

  protected readonly activeOptionId = computed(() =>
    this.suggestions().length > 0 ? `composer-option-${this.activeIndex()}` : null,
  );

  focus(): void {
    this.textarea().nativeElement.focus();
  }

  protected onInput(value: string): void {
    this.text.set(value);
    this.resize();
    this.updateTrigger();
  }

  protected onKeydown(event: KeyboardEvent): void {
    const suggestions = this.suggestions();
    if (suggestions.length > 0) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        this.activeIndex.update(
          (index) => (index + step + suggestions.length) % suggestions.length,
        );
        return;
      }
      if ((event.key === 'Enter' || event.key === 'Tab') && !event.isComposing) {
        event.preventDefault();
        this.apply(suggestions[this.activeIndex()] ?? suggestions[0]);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        this.dismissedAt.set(this.trigger()?.start ?? null);
        return;
      }
    }
    if (event.key === 'ArrowUp' && this.text() === '' && !event.isComposing) {
      event.preventDefault();
      this.editLast.emit();
      return;
    }
    if (event.key === 'Escape' && this.replyTo()) {
      event.preventDefault();
      this.cancelReply.emit();
      return;
    }
    // `isComposing` is true while an input method (e.g. Vietnamese Telex on macOS) builds a word.
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      this.submit();
    }
  }

  /** The caret moved without typing (a click, or arrow keys): the trigger may have changed. */
  protected onCaretMove(event?: KeyboardEvent): void {
    if (event && !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    this.updateTrigger();
  }

  protected apply(suggestion: Suggestion): void {
    const trigger = this.trigger();
    if (!trigger) return;
    this.replace(trigger.start, trigger.end, `${suggestion.insert} `);
    if (suggestion.uid) {
      const pick = { uid: suggestion.uid, name: suggestion.label };
      this.picked.update((list) => [pick, ...list.filter((item) => item.uid !== pick.uid)]);
    } else {
      this.recentEmoji.use(suggestion.id);
    }
  }

  protected togglePicker(anchor: HTMLElement): void {
    this.pickerAnchor.update((open) => (open === anchor ? null : anchor));
  }

  protected closePicker(): void {
    this.pickerAnchor.set(null);
    this.focus();
  }

  /** Inserts a picked emoji at the caret; a custom one is written as ":name:". */
  protected insertPicked(key: string): void {
    const element = this.textarea().nativeElement;
    const before = element.value.slice(0, element.selectionStart);
    const spacer = key.startsWith(':') && before !== '' && !/\s$/.test(before) ? ' ' : '';
    this.replace(element.selectionStart, element.selectionEnd, spacer + key);
    this.closePicker();
  }

  protected submit(): void {
    if (!this.canSend()) return;
    this.send.emit(this.encoded());
    this.text.set('');
    this.picked.set([]);
    this.trigger.set(null);
    const element = this.textarea().nativeElement;
    element.value = '';
    this.resize();
    element.focus();
  }

  /** Members whose names this session already knows: encoding never costs a read. */
  private knownMembers(): MentionCandidate[] {
    const members: MentionCandidate[] = [];
    for (const uid of this.memberIds()) {
      const name = this.profiles.cachedName(uid);
      if (name) members.push({ uid, name });
    }
    return members;
  }

  private emojiSuggestions(query: string): Suggestion[] {
    const choices = searchEmoji(
      query,
      this.unicode() ?? [],
      this.customEmoji.catalog() ?? [],
      this.i18n.locale(),
      MAX_SUGGESTIONS,
    );
    return choices.map((choice) => ({
      id: choice.key,
      insert: choice.emoji ?? choice.key,
      label: choice.shortcode ? `:${choice.shortcode}:` : choice.label,
      detail: choice.emoji ? choice.label : '',
      emoji: choice.emoji,
      image: choice.image,
      uid: null,
    }));
  }

  /** Members whose name has a word starting with the query, then any containing it. */
  private memberSuggestions(query: string): Suggestion[] {
    const me = this.auth.user()?.uid;
    const folded = foldText(query.trim());
    const ranked: { suggestion: Suggestion; rank: number }[] = [];
    for (const uid of this.memberIds()) {
      if (uid === me) continue;
      // Asking for every member's profile happens only once "@" is typed.
      const name = this.profiles.profile(uid)()?.displayName;
      if (!name) continue;
      const foldedName = foldText(name);
      const rank = foldedName.startsWith(folded)
        ? 0
        : foldedName.split(/\s+/).some((word) => word.startsWith(folded))
          ? 1
          : foldedName.includes(folded)
            ? 2
            : -1;
      if (rank < 0) continue;
      const suggestion = { id: uid, insert: `@${name}`, label: name, detail: '', uid };
      ranked.push({ suggestion: { ...suggestion, emoji: null, image: null }, rank });
    }
    return ranked
      .sort((a, b) => a.rank - b.rank || a.suggestion.label.localeCompare(b.suggestion.label))
      .slice(0, MAX_SUGGESTIONS)
      .map((item) => item.suggestion);
  }

  /** Applies Slack-style formatting (bold, italic, strike, code, quote) to selection. */
  format(kind: FormatKind): void {
    const element = this.textarea().nativeElement;
    const start = element.selectionStart ?? 0;
    const end = element.selectionEnd ?? 0;
    const result = applyFormat(this.text(), start, end, kind);
    this.text.set(result.text);
    element.value = result.text;
    this.resize();
    element.focus();
    element.setSelectionRange(result.selectionStart, result.selectionEnd);
    this.updateTrigger();
  }

  /** Inserts a "@" token at cursor and focuses to trigger member autocomplete. */
  insertMention(): void {
    const element = this.textarea().nativeElement;
    const start = element.selectionStart ?? 0;
    const end = element.selectionEnd ?? 0;
    const current = this.text();
    const before = current.slice(0, start);
    const after = current.slice(end);
    const needsSpace = before.length > 0 && !/\s$/.test(before);
    const token = needsSpace ? ' @' : '@';
    const nextText = before + token + after;
    this.text.set(nextText);
    element.value = nextText;
    this.resize();
    element.focus();
    const nextPos = start + token.length;
    element.setSelectionRange(nextPos, nextPos);
    this.updateTrigger();
  }

  private replace(start: number, end: number, insert: string): void {
    const element = this.textarea().nativeElement;
    element.setRangeText(insert, start, end, 'end');
    this.onInput(element.value);
    element.focus();
  }

  private updateTrigger(): void {
    const element = this.textarea().nativeElement;
    const caret = element.selectionStart;
    const before = caret === element.selectionEnd ? element.value.slice(0, caret) : null;
    const emoji = before === null ? null : EMOJI_TRIGGER.exec(before);
    const mention = before === null || emoji ? null : MENTION_TRIGGER.exec(before);
    const match = emoji ?? mention;
    if (!match) {
      this.trigger.set(null);
      return;
    }
    const start = caret - match[1].length;
    if (this.trigger()?.start !== start) this.activeIndex.set(0);
    this.trigger.set({ kind: emoji ? 'emoji' : 'mention', start, end: caret, query: match[2] });
    if (emoji) this.loadEmojiData();
  }

  /** The tables load on the first ":thu": a message without one costs no read. */
  private loadEmojiData(): void {
    if (this.unicode() === null) {
      loadUnicodeEmoji().then(
        (list) => this.unicode.set(list),
        () => undefined,
      );
    }
    this.customEmoji.loadCatalog().catch(() => undefined);
  }

  private resize(): void {
    const element = this.textarea().nativeElement;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, MAX_HEIGHT_PX)}px`;
  }
}
