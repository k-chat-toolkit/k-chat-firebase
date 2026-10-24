import type { Locale } from '@core/i18n/i18n.service';
import { customEmojiKey, type CustomEmoji } from '@core/models/custom-emoji';

/** A row of unicode-emoji.json, written by `npm run emoji-data` (scripts/lib/emoji-data.mjs). */
type Row = readonly [
  emoji: string,
  group: number,
  shortcodes: string,
  enName: string,
  enKeywords: string,
  viName: string,
  viKeywords: string,
];

export interface UnicodeEmoji {
  readonly emoji: string;
  readonly group: number;
  /** Slack's names, such as "thumbsup" or "+1". */
  readonly shortcodes: readonly string[];
  readonly names: Readonly<Record<Locale, string>>;
  /** The names, folded for search. */
  readonly foldedNames: Readonly<Record<Locale, string>>;
  /** Shortcodes, names and keywords in both languages, folded for search. */
  readonly haystack: string;
}

/** Unicode's emoji groups, in picker order (group 2 holds components, left out of the data). */
export const EMOJI_GROUPS = [0, 1, 3, 4, 5, 6, 7, 8, 9] as const;

export type EmojiGroup = (typeof EMOJI_GROUPS)[number];

/** One emoji as the picker and the composer offer it, Unicode or custom. */
export interface EmojiChoice {
  /** What a message or reaction stores: the emoji itself, or ":name:" for a custom one. */
  readonly key: string;
  /** The Unicode emoji, or null for a custom one. */
  readonly emoji: string | null;
  /** The custom emoji's image, or null. */
  readonly image: string | null;
  /** "thumbsup", or a custom emoji's name. */
  readonly shortcode: string;
  /** The emoji's name in the UI language, or ":name:" for a custom one. */
  readonly label: string;
  /** Who added a custom emoji. */
  readonly createdBy: string | null;
}

let request: Promise<readonly UnicodeEmoji[]> | null = null;

/** The Unicode emoji table, loaded on first use as a lazy chunk (about 75 KB compressed). */
export function loadUnicodeEmoji(): Promise<readonly UnicodeEmoji[]> {
  request ??= import('./unicode-emoji.json').then(
    (module) => (module.default as unknown as Row[]).map(fromRow),
    (error: unknown) => {
      request = null;
      throw error;
    },
  );
  return request;
}

function fromRow([emoji, group, shortcodes, enName, enKeywords, viName, viKeywords]: Row) {
  return {
    emoji,
    group,
    shortcodes: shortcodes ? shortcodes.split(' ') : [],
    names: { en: enName, vi: viName },
    foldedNames: { en: foldText(enName), vi: foldText(viName) },
    haystack: foldText([shortcodes, enName, enKeywords, viName, viKeywords].join(' ')),
  };
}

/** Lowercase and without diacritics, so "Đồng ý" is found by typing "dong y". */
export function foldText(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').toLowerCase();
}

export function unicodeChoice(emoji: UnicodeEmoji, locale: Locale): EmojiChoice {
  return {
    key: emoji.emoji,
    emoji: emoji.emoji,
    image: null,
    shortcode: emoji.shortcodes[0] ?? '',
    label: emoji.names[locale],
    createdBy: null,
  };
}

export function customChoice(emoji: CustomEmoji): EmojiChoice {
  return {
    key: customEmojiKey(emoji.name),
    emoji: null,
    image: emoji.image,
    shortcode: emoji.name,
    label: customEmojiKey(emoji.name),
    createdBy: emoji.createdBy,
  };
}

/**
 * Emoji matching every word of `query`, best first: an exact shortcode, then a
 * shortcode that starts with the first word, then a name word that does.
 * Custom emoji are found by name only.
 */
export function searchEmoji(
  query: string,
  unicode: readonly UnicodeEmoji[],
  custom: readonly CustomEmoji[],
  locale: Locale,
  max: number,
): EmojiChoice[] {
  const words = foldText(query)
    .split(/[\s:]+/)
    .filter(Boolean);
  if (words.length === 0) return [];
  const found: { choice: EmojiChoice; score: number; order: number }[] = [];
  custom.forEach((emoji, order) => {
    const score = scoreMatch(words, [emoji.name], emoji.name, '');
    if (score > 0) found.push({ choice: customChoice(emoji), score: score + 0.5, order });
  });
  unicode.forEach((emoji, order) => {
    const score = scoreMatch(words, emoji.shortcodes, emoji.haystack, emoji.foldedNames[locale]);
    if (score > 0) found.push({ choice: unicodeChoice(emoji, locale), score, order });
  });
  return found
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, max)
    .map((item) => item.choice);
}

function scoreMatch(
  words: string[],
  shortcodes: readonly string[],
  haystack: string,
  name: string,
): number {
  if (!words.every((word) => haystack.includes(word))) return 0;
  const first = words[0];
  const startsAWord = (text: string) => text.split(/[\s_]+/).some((word) => word.startsWith(first));
  if (shortcodes.includes(first)) return 4;
  if (shortcodes.some((code) => code.startsWith(first)) || startsAWord(name)) return 3;
  if (startsAWord(haystack)) return 2;
  return 1;
}
