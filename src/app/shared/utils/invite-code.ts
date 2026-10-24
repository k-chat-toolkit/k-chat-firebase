import { LIMITS } from '@core/limits';

/**
 * A random invite code, e.g. "K7QM2XPA". The default alphabet drops 0/O and
 * 1/I/L so a code read aloud or typed from a screenshot is hard to get wrong.
 * With 32 symbols and 8 places a code has 40 bits: guessing one is not
 * practical, and invites can be fetched one by one but never listed.
 */
export function generateInviteCode(random: (size: number) => Uint8Array = randomBytes): string {
  const alphabet = LIMITS.inviteCodeAlphabet;
  // Bytes at or above the largest multiple of the alphabet size are skipped,
  // so every symbol is equally likely.
  const usable = 256 - (256 % alphabet.length);
  let code = '';
  while (code.length < LIMITS.inviteCodeLength) {
    for (const byte of random(LIMITS.inviteCodeLength)) {
      if (byte < usable && code.length < LIMITS.inviteCodeLength) {
        code += alphabet[byte % alphabet.length];
      }
    }
  }
  return code;
}

/** Uppercases and strips spaces and dashes, so "k7qm 2xpa" or "K7QM-2XPA" both work. */
export function normalizeInviteCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]+/g, '');
}

export function isInviteCode(code: string): boolean {
  if (code.length !== LIMITS.inviteCodeLength) return false;
  return [...code].every((symbol) => LIMITS.inviteCodeAlphabet.includes(symbol));
}

/** Accepts a bare code or a full invite link such as https://example.web.app/join/K7QM2XPA. */
export function inviteCodeFromInput(input: string): string {
  const match = /\/join\/([^/?#\s]+)/.exec(input);
  return normalizeInviteCode(match ? match[1] : input);
}

function randomBytes(size: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(size));
}
