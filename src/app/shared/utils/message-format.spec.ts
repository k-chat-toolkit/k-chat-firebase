import { formatMessage, isJumboEmoji, type InlineStyle } from './message-format';

const PLAIN: InlineStyle = { bold: false, italic: false, strike: false };
const BOLD: InlineStyle = { ...PLAIN, bold: true };
const ITALIC: InlineStyle = { ...PLAIN, italic: true };

function text(value: string, style = PLAIN) {
  return { kind: 'text', text: value, style };
}

describe('formatMessage', () => {
  it('keeps plain text as one paragraph, line breaks included', () => {
    expect(formatMessage('xin chào\nbạn')).toEqual([
      { kind: 'paragraph', inlines: [text('xin chào\nbạn')] },
    ]);
  });

  it('reads *bold*, _italic_ and ~strike~, nested too', () => {
    expect(formatMessage('a *b* _c_ ~d~ *_e_*')[0]).toEqual({
      kind: 'paragraph',
      inlines: [
        text('a '),
        text('b', BOLD),
        text(' '),
        text('c', ITALIC),
        text(' '),
        text('d', { ...PLAIN, strike: true }),
        text(' '),
        text('e', { ...PLAIN, bold: true, italic: true }),
      ],
    });
  });

  it('leaves markers inside words, around spaces or across lines alone', () => {
    for (const input of ['snake_case_name', '2*3*4', '* not bold *', '*one\ntwo*', '**']) {
      expect(formatMessage(input)).toEqual([{ kind: 'paragraph', inlines: [text(input)] }]);
    }
  });

  it('never reads a marker inside a link, and can style the whole link', () => {
    const url = 'https://example.com/_b_/c';
    expect(formatMessage(`*see ${url}*`)[0]).toEqual({
      kind: 'paragraph',
      inlines: [text('see ', BOLD), { kind: 'link', text: url, href: url, style: BOLD }],
    });
    expect(formatMessage(`go ${url}`)[0]).toEqual({
      kind: 'paragraph',
      inlines: [text('go '), { kind: 'link', text: url, href: url, style: PLAIN }],
    });
  });

  it('keeps inline code verbatim', () => {
    expect(formatMessage('run `npm *test*` now')[0]).toEqual({
      kind: 'paragraph',
      inlines: [text('run '), { kind: 'code', text: 'npm *test*' }, text(' now')],
    });
  });

  it('splits code blocks out of the text around them', () => {
    expect(formatMessage('before\n```\nconst a = 1;\n  *b*\n```\nafter')).toEqual([
      { kind: 'paragraph', inlines: [text('before')] },
      { kind: 'code', text: 'const a = 1;\n  *b*' },
      { kind: 'paragraph', inlines: [text('after')] },
    ]);
  });

  it('leaves an unclosed or empty fence as text', () => {
    expect(formatMessage('```not closed')).toEqual([
      { kind: 'paragraph', inlines: [text('```not closed')] },
    ]);
    expect(formatMessage('``````')).toEqual([{ kind: 'paragraph', inlines: [text('``````')] }]);
  });

  it('reads :name: tokens as custom emoji, even inside a style', () => {
    expect(formatMessage('hi :party_parrot: *:tada:*')[0]).toEqual({
      kind: 'paragraph',
      inlines: [
        text('hi '),
        { kind: 'emoji', text: ':party_parrot:', name: 'party_parrot', style: PLAIN },
        text(' '),
        { kind: 'emoji', text: ':tada:', name: 'tada', style: BOLD },
      ],
    });
  });

  it('leaves times and uppercase names as text', () => {
    expect(formatMessage('at 10:30 :Party:')).toEqual([
      { kind: 'paragraph', inlines: [text('at 10:30 :Party:')] },
    ]);
  });

  it('groups lines starting with > into a quote', () => {
    expect(formatMessage('> one\n>two\nreply')).toEqual([
      { kind: 'quote', inlines: [text('one\ntwo')] },
      { kind: 'paragraph', inlines: [text('reply')] },
    ]);
  });

  it('keeps private-use placeholders out of user text', () => {
    const placeholder = String.fromCharCode(0xe000);
    const replacement = String.fromCharCode(0xfffd);
    expect(formatMessage(`a${placeholder}b`)).toEqual([
      { kind: 'paragraph', inlines: [text(`a${replacement}b`)] },
    ]);
  });
});

describe('isJumboEmoji', () => {
  it('accepts a few emoji with spaces, including joined sequences and flags', () => {
    expect(isJumboEmoji('🎉')).toBe(true);
    expect(isJumboEmoji('👍🏽 🇻🇳 👨‍👩‍👧')).toBe(true);
  });

  it('counts custom emoji that exist, and refuses unknown names', () => {
    const exists = (name: string) => name === 'party';
    expect(isJumboEmoji(':party: 🎉', exists)).toBe(true);
    expect(isJumboEmoji(':party::party:', exists)).toBe(true);
    expect(isJumboEmoji(':party: :nope:', exists)).toBe(false);
    expect(isJumboEmoji(':party:')).toBe(false);
  });

  it('refuses text, digits and too many emoji', () => {
    expect(isJumboEmoji('ok 🎉')).toBe(false);
    expect(isJumboEmoji('123')).toBe(false);
    expect(isJumboEmoji('🎉'.repeat(24))).toBe(false);
    expect(isJumboEmoji('   ')).toBe(false);
  });
});
