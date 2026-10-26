export type FormatKind = 'bold' | 'italic' | 'strike' | 'code' | 'codeblock' | 'quote';

export interface FormatResult {
  readonly text: string;
  readonly selectionStart: number;
  readonly selectionEnd: number;
}

/**
 * Applies Slack-style formatting delimiters to a textarea selection.
 *
 * When text is selected, wraps it in the delimiter.
 * When nothing is selected, inserts a pair of delimiters with the cursor positioned inside.
 */
export function applyFormat(
  text: string,
  start: number,
  end: number,
  kind: FormatKind,
): FormatResult {
  const safeStart = Math.max(0, Math.min(start, text.length));
  const safeEnd = Math.max(safeStart, Math.min(end, text.length));

  const before = text.slice(0, safeStart);
  const selected = text.slice(safeStart, safeEnd);
  const after = text.slice(safeEnd);

  switch (kind) {
    case 'bold':
      return wrap(before, selected, after, safeStart, safeEnd, '*');
    case 'italic':
      return wrap(before, selected, after, safeStart, safeEnd, '_');
    case 'strike':
      return wrap(before, selected, after, safeStart, safeEnd, '~');
    case 'code':
      return wrap(before, selected, after, safeStart, safeEnd, '`');
    case 'codeblock': {
      if (selected.length > 0) {
        const insertion = '```\n' + selected + '\n```';
        return {
          text: before + insertion + after,
          selectionStart: safeStart + insertion.length,
          selectionEnd: safeStart + insertion.length,
        };
      }
      const placeholder = '```\n\n```';
      return {
        text: before + placeholder + after,
        selectionStart: safeStart + 4, // Inside the block: after "```\n"
        selectionEnd: safeStart + 4,
      };
    }
    case 'quote': {
      if (selected.length > 0) {
        const quoted = selected
          .split('\n')
          .map((line) => '> ' + line)
          .join('\n');
        return {
          text: before + quoted + after,
          selectionStart: safeStart + quoted.length,
          selectionEnd: safeStart + quoted.length,
        };
      }
      const prefix = '> ';
      return {
        text: before + prefix + after,
        selectionStart: safeStart + prefix.length,
        selectionEnd: safeStart + prefix.length,
      };
    }
  }
}

function wrap(
  before: string,
  selected: string,
  after: string,
  start: number,
  end: number,
  marker: string,
): FormatResult {
  if (selected.length > 0) {
    const wrapped = marker + selected + marker;
    return {
      text: before + wrapped + after,
      selectionStart: start + wrapped.length,
      selectionEnd: start + wrapped.length,
    };
  }
  const emptyPair = marker + marker;
  return {
    text: before + emptyPair + after,
    selectionStart: start + marker.length,
    selectionEnd: start + marker.length,
  };
}
