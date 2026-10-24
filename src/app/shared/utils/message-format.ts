import { linkify } from './text';

/** Bold, italic and strikethrough can nest, so every styled piece carries all three. */
export interface InlineStyle {
  readonly bold: boolean;
  readonly italic: boolean;
  readonly strike: boolean;
}

/** A piece of a line. Templates render each kind with interpolation, never as HTML. */
export type Inline =
  | { readonly kind: 'text'; readonly text: string; readonly style: InlineStyle }
  | {
      readonly kind: 'link';
      readonly text: string;
      readonly href: string;
      readonly style: InlineStyle;
    }
  | { readonly kind: 'code'; readonly text: string };

export type Block =
  | { readonly kind: 'paragraph'; readonly inlines: readonly Inline[] }
  | { readonly kind: 'quote'; readonly inlines: readonly Inline[] }
  | { readonly kind: 'code'; readonly text: string };

const PLAIN: InlineStyle = { bold: false, italic: false, strike: false };

const FENCE = /```([^]*?)```/g;
const QUOTE_LINE = /^>[ \t]?/;
const INLINE_CODE = /`([^`\n]+)`/g;

/**
 * Slack's rule for `*bold*`, `_italic_` and `~strike~`: the opening marker follows the
 * start or a non-word character and comes before a non-space; the closing one comes
 * after a non-space and before a non-word character. So `snake_case_name` and `2*3*4`
 * stay as they are, and a style never spans lines.
 */
const STYLE_SPAN = /(^|[^\p{L}\p{N}])([*_~])(?=\S)([^\n]*?\S)\2(?![\p{L}\p{N}])/u;

const STYLE_KEY = { '*': 'bold', _: 'italic', '~': 'strike' } as const;

/**
 * Links are swapped for private-use characters while styles are parsed, so a `_` inside
 * a URL is never read as a marker and a style can still wrap a whole link.
 */
const PLACEHOLDER_FIRST = 0xe000;
const PLACEHOLDER_LAST = 0xe7ff;
const PLACEHOLDER_RANGE = new RegExp(
  `[${String.fromCharCode(PLACEHOLDER_FIRST)}-${String.fromCharCode(PLACEHOLDER_LAST)}]`,
  'g',
);
const REPLACEMENT_CHARACTER = String.fromCharCode(0xfffd);

/**
 * Parses message text with Slack's formatting: ``` code blocks ```, `> ` quotes,
 * `inline code`, *bold*, _italic_, ~strike~ and http(s) links. Anything that does
 * not form valid markup stays as typed.
 */
export function formatMessage(text: string): Block[] {
  const blocks: Block[] = [];
  let last = 0;
  for (const match of text.matchAll(FENCE)) {
    const code = match[1].replace(/^\n/, '').replace(/\n$/, '');
    if (code.trim() === '') continue;
    addLines(blocks, trimFenceNewlines(text.slice(last, match.index)));
    blocks.push({ kind: 'code', text: code });
    last = match.index + match[0].length;
  }
  addLines(blocks, trimFenceNewlines(text.slice(last)));
  return blocks;
}

/** The newline right next to a fence belongs to the fence, not to the text around it. */
function trimFenceNewlines(text: string): string {
  return text.replace(/^\n/, '').replace(/\n$/, '');
}

/** Groups lines into quotes (lines starting with `>`) and paragraphs. */
function addLines(blocks: Block[], text: string): void {
  if (text.trim() === '') return;
  let quote: boolean | null = null;
  let lines: string[] = [];
  const flush = () => {
    if (quote === null) return;
    const body = lines.join('\n');
    if (body.trim() !== '') {
      blocks.push({ kind: quote ? 'quote' : 'paragraph', inlines: parseInline(body) });
    }
    lines = [];
  };
  for (const line of text.split('\n')) {
    const isQuote = QUOTE_LINE.test(line);
    if (isQuote !== quote) {
      flush();
      quote = isQuote;
    }
    lines.push(isQuote ? line.replace(QUOTE_LINE, '') : line);
  }
  flush();
}

function parseInline(text: string): Inline[] {
  const inlines: Inline[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE_CODE)) {
    inlines.push(...styled(text.slice(last, match.index)));
    inlines.push({ kind: 'code', text: match[1] });
    last = match.index + match[0].length;
  }
  inlines.push(...styled(text.slice(last)));
  return mergeText(inlines);
}

type Atom = Extract<Inline, { kind: 'link' }>;

function styled(text: string): Inline[] {
  if (text === '') return [];
  const atoms: Omit<Atom, 'style'>[] = [];
  let masked = '';
  for (const piece of linkify(text.replace(PLACEHOLDER_RANGE, REPLACEMENT_CHARACTER))) {
    if (piece.kind === 'link') {
      masked += String.fromCharCode(PLACEHOLDER_FIRST + atoms.length);
      atoms.push(piece);
    } else {
      masked += piece.text;
    }
  }
  return applyStyles(masked, PLAIN, atoms);
}

function applyStyles(text: string, style: InlineStyle, atoms: Omit<Atom, 'style'>[]): Inline[] {
  const out: Inline[] = [];
  let rest = text;
  for (let match = STYLE_SPAN.exec(rest); match; match = STYLE_SPAN.exec(rest)) {
    const start = match.index + match[1].length;
    out.push(...unmask(rest.slice(0, start), style, atoms));
    const key = STYLE_KEY[match[2] as keyof typeof STYLE_KEY];
    out.push(...applyStyles(match[3], { ...style, [key]: true }, atoms));
    rest = rest.slice(match.index + match[0].length);
  }
  out.push(...unmask(rest, style, atoms));
  return out;
}

/** Puts the links back in place of their placeholders. */
function unmask(text: string, style: InlineStyle, atoms: Omit<Atom, 'style'>[]): Inline[] {
  const out: Inline[] = [];
  let plain = '';
  for (const char of text) {
    const index = char.charCodeAt(0) - PLACEHOLDER_FIRST;
    const atom = index >= 0 && index < atoms.length ? atoms[index] : undefined;
    if (atom) {
      if (plain) out.push({ kind: 'text', text: plain, style });
      plain = '';
      out.push({ ...atom, style });
    } else {
      plain += char;
    }
  }
  if (plain) out.push({ kind: 'text', text: plain, style });
  return out;
}

function sameStyle(a: InlineStyle, b: InlineStyle): boolean {
  return a.bold === b.bold && a.italic === b.italic && a.strike === b.strike;
}

function mergeText(inlines: Inline[]): Inline[] {
  const out: Inline[] = [];
  for (const inline of inlines) {
    const previous = out[out.length - 1];
    if (
      previous?.kind === 'text' &&
      inline.kind === 'text' &&
      sameStyle(previous.style, inline.style)
    ) {
      out[out.length - 1] = { ...previous, text: previous.text + inline.text };
    } else {
      out.push(inline);
    }
  }
  return out;
}

/** Built at run time: the `v` flag is newer than the TypeScript target. */
const EMOJI = new RegExp('\\p{RGI_Emoji}', 'gv');
const EMOJI_OR_SPACE = new RegExp('^(?:\\p{RGI_Emoji}|\\s)+$', 'v');

/** Slack shows a message of up to this many emoji, and nothing else, in a large size. */
export const JUMBO_EMOJI_MAX = 23;

/** True when the text is only emoji (at most JUMBO_EMOJI_MAX) and spaces. */
export function isJumboEmoji(text: string): boolean {
  if (!EMOJI_OR_SPACE.test(text)) return false;
  const count = text.match(EMOJI)?.length ?? 0;
  return count > 0 && count <= JUMBO_EMOJI_MAX;
}
