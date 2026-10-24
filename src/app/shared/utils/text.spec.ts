import { directMemberIds, directRoomId } from './direct-room-id';
import { hueFor, initials, linkify, singleLine } from './text';

describe('linkify', () => {
  it('splits text around http(s) links', () => {
    expect(linkify('see https://example.com/a?b=1 now')).toEqual([
      { kind: 'text', text: 'see ' },
      { kind: 'link', text: 'https://example.com/a?b=1', href: 'https://example.com/a?b=1' },
      { kind: 'text', text: ' now' },
    ]);
  });

  it('leaves sentence punctuation out of the link', () => {
    const segments = linkify('Map: https://maps.example.com/x).');
    expect(segments[1]).toEqual({
      kind: 'link',
      text: 'https://maps.example.com/x',
      href: 'https://maps.example.com/x',
    });
    expect(segments[2]).toEqual({ kind: 'text', text: ').' });
  });

  it('never turns other schemes into links', () => {
    expect(linkify('javascript:alert(1) and data:text/html,x')).toEqual([
      { kind: 'text', text: 'javascript:alert(1) and data:text/html,x' },
    ]);
  });

  it('keeps plain text as one segment', () => {
    expect(linkify('xin chào')).toEqual([{ kind: 'text', text: 'xin chào' }]);
  });
});

describe('initials', () => {
  it('takes the first letters of the first and last words', () => {
    expect(initials('Nguyễn Văn An')).toBe('NA');
    expect(initials('alice')).toBe('A');
    expect(initials('   ')).toBe('?');
  });

  it('keeps a whole emoji', () => {
    expect(initials('🏍️ Rider')).toBe('🏍R');
  });
});

describe('hueFor', () => {
  it('is stable and in range', () => {
    expect(hueFor('uid-1')).toBe(hueFor('uid-1'));
    expect(hueFor('uid-1')).toBeGreaterThanOrEqual(0);
    expect(hueFor('uid-1')).toBeLessThan(360);
  });
});

describe('singleLine', () => {
  it('collapses whitespace', () => {
    expect(singleLine(' a\n\n b  c ')).toBe('a b c');
  });
});

describe('direct room ids', () => {
  it('is the same id from either side', () => {
    expect(directRoomId('bob', 'alice')).toBe('alice_bob');
    expect(directRoomId('alice', 'bob')).toBe('alice_bob');
    expect(directMemberIds('bob', 'alice')).toEqual(['alice', 'bob']);
  });
});
