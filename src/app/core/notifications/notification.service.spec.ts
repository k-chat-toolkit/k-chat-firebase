import { Timestamp } from 'firebase/firestore';
import type { LastMessage, Room } from '@core/models/room';
import { shouldNotify } from './notification.service';

const NOW = Date.UTC(2026, 9, 24, 12);

const group: Room = {
  id: 'g',
  type: 'group',
  name: 'Riders',
  ownerId: 'me',
  inviteCode: 'ABCD2345',
  memberIds: ['me', 'an'],
  lastMessage: null,
  lastActivityAt: null,
};
const direct: Room = {
  id: 'an_me',
  type: 'direct',
  memberIds: ['an', 'me'],
  lastMessage: null,
  lastActivityAt: null,
};

function message(overrides: Partial<LastMessage> = {}): LastMessage {
  return {
    id: 'm1',
    senderId: 'an',
    text: 'hello',
    createdAt: Timestamp.fromMillis(NOW - 1000),
    deleted: false,
    ...overrides,
  };
}

describe('shouldNotify', () => {
  it('announces any fresh message from someone else at "all", in a background tab', () => {
    expect(shouldNotify(group, message(), 'me', 'all', false, NOW)).toBe(true);
  });

  it('keeps quiet when off, when the tab is on screen, or for your own message', () => {
    expect(shouldNotify(group, message(), 'me', 'off', false, NOW)).toBe(false);
    expect(shouldNotify(group, message(), 'me', 'all', true, NOW)).toBe(false);
    expect(shouldNotify(group, message({ senderId: 'me' }), 'me', 'all', false, NOW)).toBe(false);
  });

  it('keeps quiet for a deleted or stale message', () => {
    const stale = message({ createdAt: Timestamp.fromMillis(NOW - 10 * 60_000) });
    expect(shouldNotify(group, message({ deleted: true }), 'me', 'all', false, NOW)).toBe(false);
    expect(shouldNotify(group, stale, 'me', 'all', false, NOW)).toBe(false);
  });

  it('at "mentions", announces direct messages and mentions only', () => {
    expect(shouldNotify(direct, message(), 'me', 'mentions', false, NOW)).toBe(true);
    expect(shouldNotify(group, message(), 'me', 'mentions', false, NOW)).toBe(false);
    const mention = message({ text: 'hi <@me>' });
    expect(shouldNotify(group, mention, 'me', 'mentions', false, NOW)).toBe(true);
  });
});
