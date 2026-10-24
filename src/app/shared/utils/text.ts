/** A piece of message text: plain text, or a link the UI may render as an anchor. */
export type TextSegment =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'link'; readonly text: string; readonly href: string };

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"']+/gi;
// Characters that usually end a sentence rather than a URL.
const TRAILING_PUNCTUATION = /[.,;:!?)\]]+$/;

/**
 * Splits text into plain parts and http(s) links. Templates render the parts
 * with interpolation and `[href]`, never as HTML, so a message cannot inject markup.
 */
export function linkify(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index;
    let url = match[0];
    const trailing = TRAILING_PUNCTUATION.exec(url)?.[0] ?? '';
    url = url.slice(0, url.length - trailing.length);
    if (start > last) segments.push({ kind: 'text', text: text.slice(last, start) });
    segments.push({ kind: 'link', text: url, href: url });
    last = start + url.length;
  }
  if (last < text.length) segments.push({ kind: 'text', text: text.slice(last) });
  return segments;
}

/** Up to two initials for an avatar: "Nguyễn Văn An" → "NA", "alice" → "A". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = [...words[0]][0] ?? '';
  const last = words.length > 1 ? ([...words[words.length - 1]][0] ?? '') : '';
  return (first + last).toLocaleUpperCase();
}

/** A stable hue (0-359) for a uid, so each person keeps one avatar color. */
export function hueFor(uid: string): number {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = (hash * 31 + uid.charCodeAt(i)) >>> 0;
  return hash % 360;
}

/** Collapses whitespace so a preview fits on one line. */
export function singleLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
