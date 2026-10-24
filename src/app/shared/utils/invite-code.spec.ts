import { LIMITS } from '@core/limits';
import {
  generateInviteCode,
  inviteCodeFromInput,
  isInviteCode,
  normalizeInviteCode,
} from './invite-code';

describe('invite codes', () => {
  it('generates codes of the configured length and alphabet', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateInviteCode();
      expect(code).toHaveLength(LIMITS.inviteCodeLength);
      expect(isInviteCode(code)).toBe(true);
    }
  });

  it('maps random bytes onto the alphabet', () => {
    const alphabet = LIMITS.inviteCodeAlphabet;
    const code = generateInviteCode((size) => new Uint8Array(size).fill(alphabet.length + 1));
    expect(code).toBe(alphabet[1].repeat(LIMITS.inviteCodeLength));
  });

  it('normalizes what people type', () => {
    expect(normalizeInviteCode(' k7qm-2xpa ')).toBe('K7QM2XPA');
    expect(normalizeInviteCode('k7qm 2xpa')).toBe('K7QM2XPA');
  });

  it('refuses look-alike symbols and wrong lengths', () => {
    expect(isInviteCode('K7QM2XP0')).toBe(false); // zero is not in the alphabet
    expect(isInviteCode('K7QM2XPAA')).toBe(false);
    expect(isInviteCode('')).toBe(false);
  });

  it('reads a code from a full invite link', () => {
    expect(inviteCodeFromInput('https://my-chat.web.app/join/k7qm2xpa?x=1')).toBe('K7QM2XPA');
    expect(inviteCodeFromInput('K7QM2XPA')).toBe('K7QM2XPA');
  });
});
