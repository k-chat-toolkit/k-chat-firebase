import { decodeMentions, encodeMentions, mentionsUser } from './mentions';

const members = [
  { uid: 'u1', name: 'An' },
  { uid: 'u2', name: 'An Nguyễn' },
  { uid: 'u3', name: 'Bình' },
];

describe('encodeMentions', () => {
  it("turns a member's exact name after @ into a token", () => {
    expect(encodeMentions('hi @Bình, ok?', members)).toBe('hi <@u3>, ok?');
    expect(encodeMentions('@An đi không', members)).toBe('<@u1> đi không');
  });

  it('prefers the longer name', () => {
    expect(encodeMentions('cc @An Nguyễn', members)).toBe('cc <@u2>');
  });

  it('leaves partial names, emails and unknown people alone', () => {
    for (const text of ['@Anh ơi', 'an@example.com', '@Chi', 'no at sign']) {
      expect(encodeMentions(text, members)).toBe(text);
    }
  });

  it('lets the caller choose between people with the same name', () => {
    const twins = [
      { uid: 'picked', name: 'Linh' },
      { uid: 'other', name: 'Linh' },
    ];
    expect(encodeMentions('@Linh', twins)).toBe('<@picked>');
  });
});

describe('decodeMentions', () => {
  it('shows names in place of tokens', () => {
    const names: Record<string, string> = { u1: 'An', u3: 'Bình' };
    expect(decodeMentions('<@u1> và <@u3>', (uid) => names[uid])).toBe('@An và @Bình');
  });

  it('keeps a token whose name is unknown', () => {
    expect(decodeMentions('hi <@u9>', () => null)).toBe('hi <@u9>');
  });
});

describe('mentionsUser', () => {
  it('finds a token for the uid only', () => {
    expect(mentionsUser('hi <@u1>', 'u1')).toBe(true);
    expect(mentionsUser('hi <@u12>', 'u1')).toBe(false);
    expect(mentionsUser('hi', '')).toBe(false);
  });
});
