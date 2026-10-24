// Turns the emojibase-data package into the small table the emoji picker loads.
// The package is a dev dependency: only the generated file ships with the app.

/** Newer emoji are still missing from the fonts of many phones and computers. */
export const MAX_EMOJI_VERSION = 15;

/** Group 2 holds skin tone and hair components, which are not emoji on their own. */
const COMPONENT_GROUP = 2;

const RGI_EMOJI = /^\p{RGI_Emoji}$/v;
const VARIATION_SELECTOR = new RegExp(String.fromCodePoint(0xfe0f), 'g');

/**
 * emojibase adds U+FE0F (emoji style) even to characters that are emoji by default,
 * such as 👍. Unicode's recommended form drops it there, and only that form is the
 * same string as the emoji people type, so a reaction or a "jumbo" check matches it.
 */
export function recommendedForm(emoji) {
  if (RGI_EMOJI.test(emoji)) return emoji;
  const bare = emoji.replace(VARIATION_SELECTOR, '');
  return RGI_EMOJI.test(bare) ? bare : emoji;
}

/**
 * One row per emoji, in Unicode's order:
 * [emoji, group, Slack shortcodes, English name, English keywords, Vietnamese name, Vietnamese keywords].
 * Lists are joined with spaces to keep the file small.
 *
 * @param {object} input
 * @param {Array<{hexcode: string, unicode: string, label: string, group?: number, order?: number, tags?: string[]}>} input.en
 * @param {Array<{hexcode: string, label: string, tags?: string[]}>} input.vi
 * @param {Record<string, string | string[]>} input.shortcodes Slack's (iamcal) shortcodes by hexcode.
 * @param {Record<string, string[]>} input.versions hexcodes by emoji version.
 */
export function buildEmojiRows({ en, vi, shortcodes, versions }) {
  const tooNew = new Set(
    Object.entries(versions)
      .filter(([version]) => Number(version) > MAX_EMOJI_VERSION)
      .flatMap(([, hexcodes]) => hexcodes),
  );
  const vietnamese = new Map(vi.map((entry) => [entry.hexcode, entry]));
  return en
    .filter(
      (entry) =>
        entry.group !== undefined && entry.group !== COMPONENT_GROUP && !tooNew.has(entry.hexcode),
    )
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((entry) => {
      const codes = shortcodes[entry.hexcode] ?? [];
      const local = vietnamese.get(entry.hexcode);
      return [
        recommendedForm(entry.unicode),
        entry.group,
        (Array.isArray(codes) ? codes : [codes]).join(' '),
        entry.label,
        (entry.tags ?? []).join(' '),
        local?.label ?? entry.label,
        (local?.tags ?? []).join(' '),
      ];
    });
}

/** One row per line, so an upgrade shows up as a readable diff. */
export function renderEmojiFile(rows) {
  return `[\n${rows.map((row) => JSON.stringify(row)).join(',\n')}\n]\n`;
}
