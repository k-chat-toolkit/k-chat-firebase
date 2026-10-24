import { groupReactions } from './reactions';

describe('groupReactions', () => {
  it('groups by emoji and marks your own', () => {
    expect(groupReactions({ bob: ['👍', ':party:'], alice: ['👍'] }, 'alice')).toEqual([
      { key: ':party:', uids: ['bob'], mine: false },
      { key: '👍', uids: ['alice', 'bob'], mine: true },
    ]);
  });

  it('keeps the same order whoever reacts', () => {
    const before = groupReactions({ bob: ['👍', '🎉'] }, 'bob').map((group) => group.key);
    const after = groupReactions({ bob: ['👍', '🎉'], alice: ['🎉'] }, 'bob').map(
      (group) => group.key,
    );
    expect(after).toEqual(before);
  });

  it('returns nothing without reactions', () => {
    expect(groupReactions({}, 'alice')).toEqual([]);
  });
});
