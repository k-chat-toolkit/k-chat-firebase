// Shared fixtures for the security rules suite.
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, type Firestore } from 'firebase/firestore';
import limitsJson from '../limits.json' with { type: 'json' };

export const limits = limitsJson;

/** Matches the project of `npm run test:rules`, so the emulator UI shows the data. */
const PROJECT_ID = 'demo-k-chat';

export const ALICE = 'alice';
export const BOB = 'bob';
export const CAROL = 'carol';

/** A fixed time for seeded documents; writes under test use `serverTimestamp()`. */
export const SEEDED_AT = Timestamp.fromMillis(Date.UTC(2026, 0, 1));

export const ROOM_ID = 'room1';
export const INVITE_CODE = 'ABCD2345';

export function createTestEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
    },
  });
}

/** A Firestore client signed in as `uid`. */
export function dbAs(env: RulesTestEnvironment, uid: string): Firestore {
  return env.authenticatedContext(uid).firestore() as unknown as Firestore;
}

/** A Firestore client that is not signed in. */
export function guestDb(env: RulesTestEnvironment): Firestore {
  return env.unauthenticatedContext().firestore() as unknown as Firestore;
}

/** Writes fixtures with the rules switched off. */
export function seed(
  env: RulesTestEnvironment,
  write: (db: Firestore) => Promise<unknown>,
): Promise<void> {
  return env.withSecurityRulesDisabled(async (context) => {
    await write(context.firestore() as unknown as Firestore);
  });
}

export function profileData(displayName = 'Alice') {
  return { displayName, createdAt: SEEDED_AT, updatedAt: SEEDED_AT };
}

export function groupData(
  ownerId: string,
  memberIds: string[] = [ownerId],
  inviteCode = INVITE_CODE,
) {
  return {
    type: 'group',
    name: 'Riders',
    ownerId,
    memberIds,
    inviteCode,
    lastJoin: null,
    lastMessage: null,
    createdAt: SEEDED_AT,
    lastActivityAt: SEEDED_AT,
  };
}

export function directData(memberIds: [string, string]) {
  return {
    type: 'direct',
    memberIds,
    lastMessage: null,
    createdAt: SEEDED_AT,
    lastActivityAt: SEEDED_AT,
  };
}

export function inviteData(roomId: string, createdBy: string) {
  return { roomId, createdBy, createdAt: SEEDED_AT };
}

export function messageData(senderId: string, text = 'Hello') {
  return { senderId, text, createdAt: SEEDED_AT, editedAt: null, deleted: false, replyTo: null };
}

/** A 1×1 PNG, the smallest valid custom emoji image. */
export const EMOJI_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

export function emojiData(createdBy: string) {
  return { image: EMOJI_IMAGE, createdBy, createdAt: SEEDED_AT };
}

/** A string of `length` Vietnamese letters: several UTF-8 bytes, one character each. */
export function vietnameseText(length: number): string {
  return 'ệ'.repeat(length);
}
